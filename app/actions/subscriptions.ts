"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildScope, checkRecordScope } from "@/lib/scopes";

export async function getSubscriptionsAction(params?: { customerId?: string; status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, status } = params || {};

    const scope = buildScope(userPayload, "Subscription");
    if (userPayload.role === "SalesExecutive") {
      scope.customer = { assignedUserId: userPayload.id };
    } else if (userPayload.role === "Customer") {
      scope.customer = { email: userPayload.email };
    }

    // 2. Query with adapted filter status (since 'Expiring' is dynamic, query as Active)
    const expiringFilter = status === "Expiring";
    const statusQuery = expiringFilter ? "Active" : status;

    const subscriptions = await prisma.subscription.findMany({
      where: {
        ...scope,
        AND: [
          customerId ? { customerId } : {},
          statusQuery ? { status: statusQuery as any } : {},
        ],
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = subscriptions.map((s) => {
      let finalStatus = s.status as string;
      
      if (s.status === "Active") {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        if (s.endDate <= in30Days && s.endDate >= new Date()) {
          finalStatus = "Expiring";
        }
      }

      return {
        ...s,
        status: finalStatus as any,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
      };
    });

    const filteredData = expiringFilter
      ? serialized.filter(s => s.status === "Expiring")
      : serialized;

    return { success: true, data: filteredData };
  } catch (error) {
    console.error("GET Subscriptions Error:", error);
    return { success: false, message: "Failed to fetch subscriptions" };
  }
}

export async function createSubscriptionAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, planName, startDate, endDate, status, notes } = data;

    if (!customerId || !planName || !startDate || !endDate) {
      return { success: false, message: "customerId, planName, startDate and endDate are required" };
    }

    // Verify Customer scope
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const subscription = await prisma.subscription.create({
      data: {
        customerId,
        planName,
        startDate:  new Date(startDate),
        endDate:    new Date(endDate),
        status:     status || "Active",
        notes:      notes || null,
        companyId:  userPayload.companyId,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

    // Automatically update customer status to Active if subscription is Active
    if (status === "Active" || !status) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { status: "ActiveCustomer" }
      });
    }

    await logAudit(
      userPayload.id,
      "subscription",
      "create",
      `Subscription created for customer ${customerId}: ${planName}`
    );

    return { success: true, message: "Subscription created successfully", data: subscription };
  } catch (error) {
    console.error("POST Subscription Error:", error);
    return { success: false, message: "Failed to create subscription" };
  }
}

export async function updateSubscriptionAction(id: string, data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, message: "Subscription not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, existing, "Subscription")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const { planName, startDate, endDate, status, notes } = data;

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        planName,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        notes,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "subscription",
      "update",
      `Subscription updated for customer ${subscription.customerId}: ${planName || 'status changed'}`
    );

    return { success: true, message: "Subscription updated successfully", data: subscription };
  } catch (error) {
    console.error("PUT Subscription Error:", error);
    return { success: false, message: "Failed to update subscription" };
  }
}

export async function renewSubscriptionAction(data: {
  oldSubscriptionId: string;
  planName: string;
  startDate: string;
  endDate: string;
  notes?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { oldSubscriptionId, planName, startDate, endDate, notes } = data;
    if (!oldSubscriptionId || !planName || !startDate || !endDate) {
      return { success: false, message: "All fields are required for renewal." };
    }

    // 1. Fetch old subscription details
    const oldSub = await prisma.subscription.findUnique({
      where: { id: oldSubscriptionId }
    });

    if (!oldSub || !checkRecordScope(userPayload, oldSub, "Subscription")) {
      return { success: false, message: "Original subscription plan not found or access denied." };
    }

    // 2. Mark the old subscription as Renewed
    await prisma.subscription.update({
      where: { id: oldSubscriptionId },
      data: { status: "Renewed" }
    });

    // 3. Create the new active subscription
    const newSub = await prisma.subscription.create({
      data: {
        customerId: oldSub.customerId,
        planName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "Active",
        notes: notes || `Renewed from plan ${oldSub.planName} (${oldSub.id}).`,
        companyId: userPayload.companyId,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } }
      }
    });

    await prisma.customer.update({
      where: { id: oldSub.customerId },
      data: { status: "ActiveCustomer" }
    });

    await logAudit(
      userPayload.id,
      "subscription",
      "renew",
      `Subscription ${oldSubscriptionId} renewed. Created new plan ${newSub.id} (${planName}) for customer ${oldSub.customerId}`
    );

    return {
      success: true,
      message: "Subscription renewed successfully",
      data: {
        ...newSub,
        createdAt: newSub.createdAt.toISOString(),
        updatedAt: newSub.updatedAt.toISOString(),
        startDate: newSub.startDate.toISOString(),
        endDate: newSub.endDate.toISOString(),
      }
    };
  } catch (error) {
    console.error("RENEW Subscription Error:", error);
    return { success: false, message: "Failed to renew subscription" };
  }
}

export async function deleteSubscriptionAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const current = await prisma.subscription.findUnique({ where: { id } });
    if (!current) return { success: false, message: "Subscription not found" };

    if (!checkRecordScope(userPayload, current, "Subscription")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SuperAdmin") {
      await prisma.subscription.delete({ where: { id } });
      await logAudit(userPayload.id, "subscription", "delete_permanent", `Permanently deleted subscription ${id}`);
    } else {
      await prisma.subscription.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: userPayload.id
        }
      });
      await logAudit(userPayload.id, "subscription", "delete", `Soft-deleted subscription ${id}`);
    }
    return { success: true, message: "Subscription deleted successfully" };
  } catch (error) {
    console.error("deleteSubscriptionAction error:", error);
    return { success: false, message: "Failed to delete subscription" };
  }
}

export async function restoreSubscriptionAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const current = await prisma.subscription.findUnique({ where: { id } });
    if (!current) return { success: false, message: "Subscription not found" };

    if (current.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    await prisma.subscription.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null
      }
    });

    await logAudit(userPayload.id, "subscription", "restore", `Restored subscription ${id}`);
    return { success: true, message: "Subscription restored successfully" };
  } catch (error) {
    console.error("restoreSubscriptionAction error:", error);
    return { success: false, message: "Failed to restore subscription" };
  }
}
