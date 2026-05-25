import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const city = searchParams.get("city") || "";
    const status = searchParams.get("status") || "";

    // RBAC base filter
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

    return apiSuccess(customers);
  } catch (error) {
    console.error("GET Customers Error:", error);
    return apiError("Failed to fetch customers", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const { customerCode, name, email, phone, city, status, assignedUserId } = await request.json();

    if (!customerCode || !name) {
      return apiError("Customer Code and Name are required");
    }

    // Executives cannot assign themselves or others
    const finalAssignedUserId = userPayload.role === "MarketingExecutive" 
      ? userPayload.id 
      : assignedUserId || null;

    const existingCustomer = await prisma.customer.findUnique({
      where: { customerCode },
    });

    if (existingCustomer) {
      return apiError("Customer Code must be unique");
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
      userPayload?.id || null,
      "Customer",
      "Create",
      `Created customer ${customerCode} (${name})`
    );

    return apiSuccess(newCustomer, "Customer created successfully", 201);
  } catch (error) {
    console.error("POST Customer Error:", error);
    return apiError("Failed to create customer", 500);
  }
}
