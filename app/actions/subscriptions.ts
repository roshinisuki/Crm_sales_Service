"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getSubscriptionsAction(params?: { customerId?: string; status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const { customerId, status } = params || {};

    let rbacFilter = {};
    if (userPayload.role === "MarketingExecutive") {
      rbacFilter = { customer: { assignedUserId: userPayload.id } };
    } else if (userPayload.role === "Customer") {
      rbacFilter = { customer: { email: userPayload.email } };
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        AND: [
          rbacFilter,
          customerId ? { customerId } : {},
          status ? { status: status as any } : {},
        ],
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: subscriptions };
  } catch (error) {
    console.error("GET Subscriptions Error:", error);
    return { success: false, message: "Failed to fetch subscriptions" };
  }
}

export async function createSubscriptionAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { customerId, planName, startDate, endDate, status, notes } = data;

    if (!customerId || !planName || !startDate || !endDate) {
      return { success: false, message: "customerId, planName, startDate and endDate are required" };
    }

    const subscription = await prisma.subscription.create({
      data: {
        customerId,
        planName,
        startDate:  new Date(startDate),
        endDate:    new Date(endDate),
        status:     status || "Active",
        notes:      notes || null,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

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
    if (!userPayload || !["Admin", "MarketingLead"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
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
