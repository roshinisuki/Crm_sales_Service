"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotificationsToMany } from "@/lib/notifications";
import { checkRecordScope } from "@/lib/scopes";

export async function createCallLogAction(data: {
  customerId: string;
  notes?: string;
  duration?: number;
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

    const { customerId, notes, duration } = data;

    if (!customerId) {
      return { success: false, message: "Customer ID is required" };
    }

    // Check customer access
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const callLog = await prisma.callLog.create({
      data: {
        customerId,
        notes: notes || null,
        duration: duration ? parseInt(duration as any, 10) : null,
        userId: userPayload.id
      },
      include: {
        user: { select: { name: true } }
      }
    });

    await logAudit(
      userPayload.id,
      "Customer",
      "Update",
      `Logged a call with customer ID ${customerId} (Duration: ${duration || 0}s)`
    );

    // Notify Managers/Leads (scoped to tenant)
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
      select: { id: true }
    });
    const managerIds = managers.map(m => m.id).filter(id => id !== userPayload.id);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "Call Logged",
        message: `${userPayload.email} logged a call with customer.`,
        type: "call",
        link: `/customer-master/${customerId}`
      });
    }

    return {
      success: true,
      data: {
        ...callLog,
        timestamp: callLog.timestamp.toISOString()
      },
      message: "Call logged successfully"
    };
  } catch (error) {
    console.error("POST CallLog Error:", error);
    return { success: false, message: "Failed to log call" };
  }
}

export async function getCallLogsAction(customerId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Check customer access
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    if (userPayload.role === "Customer") {
      // Customers shouldn't see internal call notes
      return { success: false, message: "Unauthorized" };
    }

    const callLogs = await prisma.callLog.findMany({
      where: { customerId },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { timestamp: "desc" }
    });

    const serialized = callLogs.map((log) => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET CallLogs Error:", error);
    return { success: false, message: "Failed to fetch call logs" };
  }
}
