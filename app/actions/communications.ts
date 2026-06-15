"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { CommunicationChannel, CommunicationDirection } from "@prisma/client";
import { checkRecordScope } from "@/lib/scopes";

/**
 * Log a new communication interaction.
 */
export async function createCommunicationLogAction(data: {
  customerId?: string;
  leadId?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: string;
  content: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, leadId, channel, direction, status, content } = data;

    if (!content) {
      return { success: false, message: "Content is required." };
    }

    // Access validation
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
        return { success: false, message: "Customer not found or access denied." };
      }
    }
    if (leadId) {
      const leadObj = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!leadObj || !checkRecordScope(userPayload, leadObj, "Lead")) {
        return { success: false, message: "Lead not found or access denied." };
      }
    }

    const log = await prisma.communicationLog.create({
      data: {
        customerId: customerId || null,
        leadId: leadId || null,
        channel,
        direction,
        status,
        content,
        sentByUserId: userPayload.id
      }
    });

    await logAudit(
      userPayload.id,
      "COMMUNICATIONS",
      "CREATE_LOG",
      `Logged ${direction} ${channel} communication`
    );

    if (customerId) revalidatePath(`/customers/${customerId}`);
    if (leadId) revalidatePath(`/leads/${leadId}`);

    return { success: true, message: "Communication logged successfully", data: log };
  } catch (error) {
    console.error("Create Communication Log Error:", error);
    return { success: false, message: "Failed to log communication." };
  }
}

/**
 * Retrieve communication history.
 */
export async function getCommunicationLogsAction(filters?: {
  customerId?: string;
  leadId?: string;
  channel?: CommunicationChannel;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Access validation for specific targets
    if (filters?.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: filters.customerId } });
      if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
        return { success: false, message: "Customer not found or access denied." };
      }
    }
    if (filters?.leadId) {
      const leadObj = await prisma.lead.findUnique({ where: { id: filters.leadId } });
      if (!leadObj || !checkRecordScope(userPayload, leadObj, "Lead")) {
        return { success: false, message: "Lead not found or access denied." };
      }
    }

    const logs = await prisma.communicationLog.findMany({
      where: {
        customerId: filters?.customerId || undefined,
        leadId: filters?.leadId || undefined,
        channel: filters?.channel || undefined,
        OR: [
          { customer: { companyId: userPayload.companyId } },
          { lead: { companyId: userPayload.companyId } }
        ]
      },
      include: {
        sentByUser: { select: { id: true, name: true } }
      },
      orderBy: { sentAt: "desc" }
    });

    return { success: true, data: logs };
  } catch (error) {
    console.error("Get Communication Logs Error:", error);
    return { success: false, message: "Failed to fetch communication logs." };
  }
}
