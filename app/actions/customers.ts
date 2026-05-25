"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function getCustomersAction(params?: { search?: string; city?: string; status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const { search = "", city = "", status = "" } = params || {};

    let rbacFilter = {};
    if (userPayload.role === "MarketingExecutive") {
      rbacFilter = { assignedUserId: userPayload.id };
    } else if (userPayload.role === "Customer") {
      rbacFilter = { email: userPayload.email };
    }

    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          rbacFilter,
          search
            ? {
                OR: [
                  { name: { contains: search } },
                  { customerCode: { contains: search } },
                ],
              }
            : {},
          city ? { city: { contains: city } } : {},
          status ? { status: status as any } : {},
        ],
      },
      include: {
        subscriptions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: customers };
  } catch (error) {
    console.error("GET Customers Error:", error);
    return { success: false, message: "Failed to fetch customers" };
  }
}

export async function createCustomerAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { customerCode, name, email, phone, city, status, assignedUserId } = data;

    if (!customerCode || !name) {
      return { success: false, message: "Customer Code and Name are required" };
    }

    const finalAssignedUserId = userPayload.role === "MarketingExecutive" 
      ? userPayload.id 
      : assignedUserId || null;

    const existingCustomer = await prisma.customer.findUnique({
      where: { customerCode },
    });

    if (existingCustomer) {
      return { success: false, message: "Customer Code must be unique" };
    }

    const newCustomer = await prisma.customer.create({
      data: {
        customerCode,
        name,
        email,
        phone,
        city,
        status: status || "Active",
        assignedUserId: finalAssignedUserId,
      },
    });

    // Auto-create User account for the customer if email is provided
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash("Welcome@123", 10);
        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "Customer",
          },
        });
      }
    }

    await logAudit(
      userPayload.id,
      "Customer",
      "Create",
      `Created customer ${customerCode} (${name})`
    );

    return { success: true, data: newCustomer, message: "Customer created successfully" };
  } catch (error) {
    console.error("POST Customer Error:", error);
    return { success: false, message: "Failed to create customer" };
  }
}
