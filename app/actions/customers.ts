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

    // Fetch portal users to check activation status
    const customerEmails = customers.map(c => c.email).filter(Boolean) as string[];
    const portalUsers = await prisma.user.findMany({
      where: {
        email: { in: customerEmails },
        userType: "customer",
      },
      select: {
        email: true,
        isActive: true,
        isFirstLogin: true,
        passwordSetAt: true,
      }
    });

    // A portal is considered "activated" if the user exists, is active, and has either logged in or set a password.
    const activatedEmails = new Set(
      portalUsers
        .filter(u => u.isActive && (!u.isFirstLogin || u.passwordSetAt !== null))
        .map(u => u.email)
    );

    // Serialize dates to strings so client components can receive them safely
    const serialized = customers.map((c) => ({
      ...c,
      hasActivatedPortal: c.email ? activatedEmails.has(c.email) : false,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      subscriptions: c.subscriptions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
      })),
    }));

    return { success: true, data: serialized };
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

    let { customerCode, name, email, phone, city, status, assignedUserId } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;

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

    if (email) {
      const existingEmail = await prisma.customer.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return { success: false, message: "A customer with this email address already exists." };
      }
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

    return { success: true, data: { ...newCustomer, createdAt: newCustomer.createdAt.toISOString(), updatedAt: newCustomer.updatedAt.toISOString() }, message: "Customer created successfully" };
  } catch (error) {
    console.error("POST Customer Error:", error);
    return { success: false, message: "Failed to create customer" };
  }
}

export async function updateCustomerAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    let { id, customerCode, name, email, phone, city, status, assignedUserId } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;

    if (!id || !customerCode || !name) {
      return { success: false, message: "ID, Customer Code and Name are required" };
    }

    const finalAssignedUserId = userPayload.role === "MarketingExecutive" 
      ? userPayload.id 
      : assignedUserId || null;

    if (email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email, id: { not: id } },
      });
      if (existingEmail) {
        return { success: false, message: "A customer with this email address already exists." };
      }
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        city,
        status,
        assignedUserId: finalAssignedUserId,
      },
    });

    await logAudit(
      userPayload.id,
      "Customer",
      "Update",
      `Updated customer ${customerCode} (${name})`
    );

    return { success: true, data: { ...updatedCustomer, createdAt: updatedCustomer.createdAt.toISOString(), updatedAt: updatedCustomer.updatedAt.toISOString() }, message: "Customer updated successfully" };
  } catch (error) {
    console.error("PUT Customer Error:", error);
    return { success: false, message: "Failed to update customer" };
  }
}

export async function deleteCustomersAction(customerIds: string[]) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Only Admins and Leads can delete customers" };
    }

    if (!customerIds || customerIds.length === 0) {
      return { success: false, message: "No customers selected for deletion" };
    }

    // Get the customers first so we can extract their emails to delete associated portal users
    const customersToDelete = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, email: true, name: true, customerCode: true }
    });

    const emailsToDelete = customersToDelete
      .map(c => c.email)
      .filter((e): e is string => e !== null);

    // Delete in a transaction to prevent partial orphans
    await prisma.$transaction(async (tx) => {
      // 1. Delete Subscriptions
      await tx.subscription.deleteMany({ where: { customerId: { in: customerIds } } });
      
      // 2. Delete Marketing Visits
      await tx.marketingVisit.deleteMany({ where: { customerId: { in: customerIds } } });
      
      // 3. Delete Customer Visits
      await tx.customerVisit.deleteMany({ where: { customerId: { in: customerIds } } });
      
      // 4. Delete Follow Ups
      await tx.followUp.deleteMany({ where: { customerId: { in: customerIds } } });
      
      // 5. Delete Customer records
      await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
      
      // 6. Delete associated portal user accounts safely
      if (emailsToDelete.length > 0) {
        // Find the portal users to be deleted
        const portalUsers = await tx.user.findMany({
          where: { email: { in: emailsToDelete }, userType: "customer" },
          select: { id: true }
        });
        
        const portalUserIds = portalUsers.map(u => u.id);

        if (portalUserIds.length > 0) {
          // Clean up relations for the User record to avoid foreign key errors
          await tx.passwordResetToken.deleteMany({ where: { userId: { in: portalUserIds } } });
          
          // AuditLog userId is optional, we can set it to null to preserve the log history
          await tx.auditLog.updateMany({
            where: { userId: { in: portalUserIds } },
            data: { userId: null }
          });
          
          // Finally, delete the User records
          await tx.user.deleteMany({
            where: { id: { in: portalUserIds } }
          });
        }
      }
    });

    await logAudit(
      userPayload.id,
      "Customer",
      "Delete",
      `Deleted ${customerIds.length} customers and their associated records`
    );

    return { success: true, message: `Successfully deleted ${customerIds.length} customers` };
  } catch (error) {
    console.error("DELETE Customers Error:", error);
    return { success: false, message: "Failed to delete customers" };
  }
}
