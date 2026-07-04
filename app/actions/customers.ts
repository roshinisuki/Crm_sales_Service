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
        contacts: {
          where: { deletedAt: null },
          orderBy: { isPrimary: "desc" },
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        rfqs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
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
        checkInTime: v.checkInTime?.toISOString() || null,
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

    let { customerCode, name, email, phone, city, status, assignedUserId, leadSource, gstNumber, accountType, industryType, billingAddress, shippingAddress, creditLimit, creditTermsDays } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;
    gstNumber = gstNumber?.trim() || null;

    if (!name) {
      return { success: false, message: "Customer Name is required" };
    }

    if (!leadSource || leadSource.trim() === "") {
      return { success: false, message: "Lead Source is required" };
    }

    // GSTIN validation (15-char format) - optional but unique if provided
    if (gstNumber) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!gstinRegex.test(gstNumber)) {
        return { success: false, message: "Invalid GSTIN format. Expected 15 characters: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric" };
      }
      const existingGst = await prisma.customer.findFirst({
        where: { gstNumber, companyId: userPayload.companyId },
      });
      if (existingGst) {
        return { success: false, message: "GSTIN must be unique within company" };
      }
    }

    // Generate ACC-NNNNN format if not provided
    if (!customerCode || customerCode.trim() === "") {
      const count = await prisma.customer.count({ where: { companyId: userPayload.companyId } });
      customerCode = `ACC-${String(count + 1).padStart(5, "0")}`;
    } else {
      // Validate provided format
      const accCodeRegex = /^ACC-\d{5}$/;
      if (!accCodeRegex.test(customerCode)) {
        return { success: false, message: "Customer Code must be in format ACC-NNNNN" };
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
        status: status || "Prospect",
        assignedUserId: finalAssignedUserId,
        leadSource: leadSource,
        companyId: userPayload.companyId,
        // V2 fields
        gstNumber,
        accountType: accountType || "Prospect",
        industryType,
        billingAddress,
        shippingAddress,
        creditLimit: creditLimit ?? 0,
        creditTermsDays: creditTermsDays ?? 30,
      },
    });

    // Insert account_status_history for initial status
    await prisma.accountStatusHistory.create({
      data: {
        customerId: newCustomer.id,
        fromStatus: null,
        toStatus: newCustomer.status,
        changedById: userPayload.id,
        changedAt: new Date(),
      },
    });

    // Portal user creation removed - portal access should only be granted explicitly
    // via "Activate Portal" button or when a deal is marked as Won
    // This prevents automatic portal access with hardcoded passwords

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

    let { id, customerCode, name, email, phone, city, status, assignedUserId, leadSource, gstNumber, accountType, industryType, billingAddress, shippingAddress, creditLimit, creditTermsDays } = data;

    // Normalize empty strings to null for unique constraints
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    city = city?.trim() || null;
    gstNumber = gstNumber?.trim() || null;

    if (!id || !customerCode || !name) {
      return { success: false, message: "ID, Customer Code and Name are required" };
    }

    if (!leadSource || leadSource.trim() === "") {
      return { success: false, message: "Lead Source is required" };
    }

    const currentCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!currentCustomer) {
      return { success: false, message: "Customer not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, currentCustomer, "Customer")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // GSTIN validation if changed
    if (gstNumber && gstNumber !== currentCustomer.gstNumber) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!gstinRegex.test(gstNumber)) {
        return { success: false, message: "Invalid GSTIN format" };
      }
      const existingGst = await prisma.customer.findFirst({
        where: { gstNumber, id: { not: id }, companyId: userPayload.companyId },
      });
      if (existingGst) {
        return { success: false, message: "GSTIN must be unique within company" };
      }
    }

    // Credit limit change validation (Admin only)
    const creditLimitChanged = creditLimit !== undefined && creditLimit !== currentCustomer.creditLimit;
    const creditTermsChanged = creditTermsDays !== undefined && creditTermsDays !== currentCustomer.creditTermsDays;
    if ((creditLimitChanged || creditTermsChanged) && userPayload.role !== "Admin") {
      return { success: false, message: "Only Admin role can modify credit limits" };
    }

    // Status change validation - block Inactive if open deals exist
    const statusChanged = status !== undefined && status !== currentCustomer.status;
    if (statusChanged && status === "Inactive") {
      // Check for open opportunities (not Won/Lost)
      const openDeals = await prisma.deal.count({
        where: {
          customerId: id,
          status: { notIn: ["Won", "Lost"] },
        },
      });
      // Check for pending RFQs
      const pendingRfqs = await prisma.rFQ.count({
        where: {
          customerId: id,
          status: { not: "Closed" },
          deletedAt: null,
        },
      });
      // Check for pending quotations
      const pendingQuotations = await prisma.quotation.count({
        where: {
          customerId: id,
          status: { notIn: ["Accepted", "Rejected", "Expired", "Cancelled"] },
          deletedAt: null,
        },
      });

      if (openDeals > 0 || pendingRfqs > 0 || pendingQuotations > 0) {
        return { success: false, message: "Cannot deactivate account with open opportunities, pending RFQs, or pending quotations" };
      }
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
        status: status !== undefined ? status : currentCustomer.status,
        assignedUserId: finalAssignedUserId,
        leadSource: leadSource !== undefined ? leadSource : currentCustomer.leadSource,
        // V2 fields
        ...(gstNumber !== undefined && { gstNumber }),
        ...(accountType !== undefined && { accountType }),
        ...(industryType !== undefined && { industryType }),
        ...(billingAddress !== undefined && { billingAddress }),
        ...(shippingAddress !== undefined && { shippingAddress }),
        ...(creditLimit !== undefined && { creditLimit }),
        ...(creditTermsDays !== undefined && { creditTermsDays }),
      },
    });

    // Insert account_credit_history on credit change
    if (creditLimitChanged || creditTermsChanged) {
      await prisma.accountCreditHistory.create({
        data: {
          customerId: id,
          oldCreditLimit: currentCustomer.creditLimit,
          newCreditLimit: updatedCustomer.creditLimit,
          oldTermsDays: currentCustomer.creditTermsDays,
          newTermsDays: updatedCustomer.creditTermsDays,
          approvedById: userPayload.id,
          changedAt: new Date(),
        },
      });
    }

    // Insert account_status_history on status change
    if (statusChanged) {
      await prisma.accountStatusHistory.create({
        data: {
          customerId: id,
          fromStatus: currentCustomer.status,
          toStatus: updatedCustomer.status,
          changedById: userPayload.id,
          changedAt: new Date(),
        },
      });
    }

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

    // Compute state-diff for audit trail (including V2 fields)
    const { before, after } = computeDiff(
      {
        name: currentCustomer.name,
        email: currentCustomer.email,
        phone: currentCustomer.phone,
        city: currentCustomer.city,
        status: currentCustomer.status,
        assignedUserId: currentCustomer.assignedUserId,
        gstNumber: currentCustomer.gstNumber,
        accountType: currentCustomer.accountType,
        industryType: currentCustomer.industryType,
        billingAddress: currentCustomer.billingAddress,
        shippingAddress: currentCustomer.shippingAddress,
        creditLimit: currentCustomer.creditLimit,
        creditTermsDays: currentCustomer.creditTermsDays,
      },
      {
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        city: updatedCustomer.city,
        status: updatedCustomer.status,
        assignedUserId: updatedCustomer.assignedUserId,
        gstNumber: updatedCustomer.gstNumber,
        accountType: updatedCustomer.accountType,
        industryType: updatedCustomer.industryType,
        billingAddress: updatedCustomer.billingAddress,
        shippingAddress: updatedCustomer.shippingAddress,
        creditLimit: updatedCustomer.creditLimit,
        creditTermsDays: updatedCustomer.creditTermsDays,
      }
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
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
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
      await prisma.$transaction(async (tx) => {
        // Soft delete the customer
        await tx.customer.updateMany({
          where: { id: { in: verifiedIds } },
          data: {
            deletedAt: new Date(),
            deletedById: userPayload.id
          }
        });

        // Deactivate linked portal users
        if (emailsToDelete.length > 0) {
          const portalUsers = await tx.user.findMany({
            where: { email: { in: emailsToDelete }, userType: "customer" },
            select: { id: true }
          });
          const portalUserIds = portalUsers.map(u => u.id);
          if (portalUserIds.length > 0) {
            await tx.user.updateMany({
              where: { id: { in: portalUserIds } },
              data: { isActive: false }
            });
          }
        }
      });

      await logAudit(
        userPayload.id,
        "Customer",
        "Delete",
        `Soft-deleted ${verifiedIds.length} customers and deactivated their portal users`
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
