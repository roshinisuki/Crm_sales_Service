"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, computeDiff } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { buildScope, checkRecordScope } from "@/lib/scopes";

export async function getCustomersAction(params?: { search?: string; city?: string; status?: string; leadSource?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { search = "", city = "", status = "", leadSource = "" } = params || {};

    const scope = buildScope(userPayload, "Customer");
    if (userPayload.role === "Customer") {
      scope.email = userPayload.email;
    }

    const customers = await prisma.customer.findMany({
      where: {
        ...scope,
        AND: [
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
          leadSource ? { leadSource: leadSource as any } : {},
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

    // A portal is considered "activated" if the user exists and is active, even if they haven't set a password yet.
    // This prevents the "Activate Portal" button from showing up repeatedly after the invite is sent.
    const activatedEmails = new Set(
      portalUsers
        .filter(u => u.isActive)
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

export async function getCustomerByIdAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        subscriptions: true,
        followUps: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedUser: { select: { id: true, name: true, email: true } },
            completedBy: { select: { id: true, name: true, email: true } }
          }
        },
        marketingVisits: {
          orderBy: { createdAt: "desc" },
          include: { executive: { select: { name: true } } }
        },
        customerVisits: {
          orderBy: { createdAt: "desc" },
          include: { host: { select: { name: true } } }
        },
        deals: {
          orderBy: { updatedAt: "desc" },
          include: { 
            assignedUser: { select: { name: true } },
            stageHistories: {
              orderBy: { changedAt: "desc" },
              include: { changedBy: { select: { name: true } } }
            }
          }
        },
        callLogs: {
          orderBy: { timestamp: "desc" },
          include: { user: { select: { name: true } } }
        }
      },
    });

    if (!customer) {
      return { success: false, message: "Customer not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Soft delete check
    if (customer.deletedAt && !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Customer not found (deleted)." };
    }

    if (userPayload.role === "Customer" && customer.email !== userPayload.email) {
      return { success: false, message: "Unauthorized access." };
    }

    const serialized = {
      ...customer,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      subscriptions: customer.subscriptions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
      })),
      followUps: customer.followUps.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        nextMeetingDate: f.nextMeetingDate.toISOString(),
        dueDate: f.dueDate ? f.dueDate.toISOString() : null,
        reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
        completedAt: f.completedAt?.toISOString() || null,
      })),
      marketingVisits: customer.marketingVisits.map(v => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt?.toISOString() || null,
        checkIn: v.checkIn ? v.checkIn.toISOString() : null,
        checkOut: v.checkOut?.toISOString() || null,
      })),
      customerVisits: customer.customerVisits.map(v => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        checkInTime: v.checkInTime.toISOString(),
        checkOutTime: v.checkOutTime?.toISOString() || null,
      })),
      deals: customer.deals.map(d => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        expectedCloseDate: d.expectedCloseDate.toISOString(),
        stageHistories: d.stageHistories.map(sh => ({
          ...sh,
          changedAt: sh.changedAt.toISOString()
        }))
      })),
      callLogs: customer.callLogs.map(c => ({
        ...c,
        timestamp: c.timestamp.toISOString(),
      })),
    };

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET Customer Error:", error);
    return { success: false, message: "Failed to fetch customer details" };
  }
}

export async function createCustomerAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    let { customerCode, name, email, phone, city, status, assignedUserId, leadSource } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;

    if (!name) {
      return { success: false, message: "Customer Name is required" };
    }

    if (!customerCode || customerCode.trim() === "") {
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        customerCode = `CUST-M${randomDigits}`;
        const existing = await prisma.customer.findFirst({
          where: { customerCode, companyId: userPayload.companyId },
        });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        customerCode = `CUST-M${Date.now().toString().slice(-5)}`;
      }
    }

    const finalAssignedUserId = userPayload.role === "SalesExecutive" 
      ? userPayload.id 
      : assignedUserId || null;

    const existingCustomer = await prisma.customer.findFirst({
      where: { customerCode, companyId: userPayload.companyId },
    });

    if (existingCustomer) {
      return { success: false, message: "Customer Code must be unique within company" };
    }

    if (email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email, companyId: userPayload.companyId },
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
        leadSource: leadSource || null,
        companyId: userPayload.companyId,
      },
    });

    // Auto-create User account for the customer if email is provided
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { email, companyId: userPayload.companyId }
      });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash("Welcome@123", 10);
        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "Customer",
            userType: "customer",
            companyId: userPayload.companyId,
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
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    let { id, customerCode, name, email, phone, city, status, assignedUserId, leadSource } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;

    if (!id || !customerCode || !name) {
      return { success: false, message: "ID, Customer Code and Name are required" };
    }

    const currentCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!currentCustomer) {
      return { success: false, message: "Customer not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, currentCustomer, "Customer")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const oldEmail = currentCustomer.email;

    const finalAssignedUserId = userPayload.role === "SalesExecutive" 
      ? userPayload.id 
      : assignedUserId || null;

    if (email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email, id: { not: id }, companyId: userPayload.companyId, deletedAt: null },
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
        leadSource: leadSource || null,
      },
    });

    if (oldEmail && oldEmail !== email && email) {
      const portalUser = await prisma.user.findFirst({
        where: { email: oldEmail, userType: "customer", companyId: userPayload.companyId },
      });
      if (portalUser) {
        await prisma.user.update({
          where: { id: portalUser.id },
          data: { email },
        });
      }
    }

    // Compute state-diff for audit trail
    const { before, after } = computeDiff(
      { name: currentCustomer.name, email: currentCustomer.email, phone: currentCustomer.phone, city: currentCustomer.city, status: currentCustomer.status, assignedUserId: currentCustomer.assignedUserId },
      { name: updatedCustomer.name, email: updatedCustomer.email, phone: updatedCustomer.phone, city: updatedCustomer.city, status: updatedCustomer.status, assignedUserId: updatedCustomer.assignedUserId }
    );

    await logAudit(
      userPayload.id,
      "Customer",
      "Update",
      `Updated customer ${customerCode} (${name})`,
      {
        resourceId:    id,
        previousState: Object.keys(before).length ? before : null,
        newState:      Object.keys(after).length  ? after  : null,
        severity:      "WARN",
      }
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
    if (!userPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    if (!customerIds || customerIds.length === 0) {
      return { success: false, message: "No customers selected for deletion" };
    }

    // Get the customers first so we can verify tenant access
    const customersToDelete = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        companyId: userPayload.companyId
      },
      select: { id: true, email: true, name: true, customerCode: true }
    });

    if (customersToDelete.length === 0) {
      return { success: false, message: "No matching customers found or access denied." };
    }

    const verifiedIds = customersToDelete.map(c => c.id);
    const emailsToDelete = customersToDelete
      .map(c => c.email)
      .filter((e): e is string => e !== null);

    if (userPayload.role === "SuperAdmin") {
      // Permanent Hard Delete for SuperAdmin
      await prisma.$transaction(async (tx) => {
        await tx.subscription.deleteMany({ where: { customerId: { in: verifiedIds } } });
        await tx.marketingVisit.deleteMany({ where: { customerId: { in: verifiedIds } } });
        await tx.customerVisit.deleteMany({ where: { customerId: { in: verifiedIds } } });
        await tx.followUp.deleteMany({ where: { customerId: { in: verifiedIds } } });
        await tx.customer.deleteMany({ where: { id: { in: verifiedIds } } });
        
        if (emailsToDelete.length > 0) {
          const portalUsers = await tx.user.findMany({
            where: { email: { in: emailsToDelete }, userType: "customer" },
            select: { id: true }
          });
          const portalUserIds = portalUsers.map(u => u.id);
          if (portalUserIds.length > 0) {
            await tx.passwordResetToken.deleteMany({ where: { userId: { in: portalUserIds } } });
            await tx.notification.deleteMany({ where: { userId: { in: portalUserIds } } });
            await tx.notificationPreference.deleteMany({ where: { userId: { in: portalUserIds } } });
            await tx.auditLog.updateMany({
              where: { userId: { in: portalUserIds } },
              data: { userId: null }
            });
            await tx.user.deleteMany({ where: { id: { in: portalUserIds } } });
          }
        }
      });

      await logAudit(
        userPayload.id,
        "Customer",
        "Delete_Permanent",
        `Permanently deleted ${verifiedIds.length} customers and their associated records`
      );
    } else {
      // Soft Delete for Admin / SalesManager
      await prisma.customer.updateMany({
        where: { id: { in: verifiedIds } },
        data: {
          deletedAt: new Date(),
          deletedById: userPayload.id
        }
      });

      await logAudit(
        userPayload.id,
        "Customer",
        "Delete",
        `Soft-deleted ${verifiedIds.length} customers`
      );
    }

    return { success: true, message: `Successfully deleted ${verifiedIds.length} customers` };
  } catch (error) {
    console.error("DELETE Customers Error:", error);
    return { success: false, message: "Failed to delete customers" };
  }
}

export async function restoreCustomersAction(customerIds: string[]) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    if (!customerIds || customerIds.length === 0) {
      return { success: false, message: "No customers selected for restore" };
    }

    await prisma.customer.updateMany({
      where: {
        id: { in: customerIds },
        companyId: userPayload.companyId
      },
      data: {
        deletedAt: null,
        deletedById: null
      }
    });

    await logAudit(
      userPayload.id,
      "Customer",
      "Restore",
      `Restored ${customerIds.length} customers`
    );

    return { success: true, message: `Successfully restored ${customerIds.length} customers` };
  } catch (error) {
    console.error("RESTORE Customers Error:", error);
    return { success: false, message: "Failed to restore customers" };
  }
}
