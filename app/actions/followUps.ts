"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateNotInPast } from "@/lib/date-validation";
import { buildScope, checkRecordScope } from "@/lib/scopes";

const createSchema = z.object({
  customerId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  nextMeetingDate: z.date(),
  remarks: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reminderAt: z.date().optional().nullable(),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
  sourceType: z.string().optional().nullable().default("MANUAL"),
  sourceId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  autoCreated: z.boolean().default(false),
  type: z.enum(["Call", "Meeting", "Note"]).optional().nullable(),
}).refine(data => data.customerId || data.leadId, {
  message: "Either customerId or leadId must be provided",
  path: ["customerId"]
});

/**
 * Sweeps all Pending follow-ups that have passed their nextMeetingDate,
 * marking them as Overdue, sending SSE notifications, and escalating to Level 1
 * if overdue by more than 48 hours.
 */
export async function checkAndUpdateOverdueFollowUps(companyId?: string | null) {
  try {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const companyFilter = companyId ? { companyId } : {};

    // 1. Find newly overdue follow-ups (still marked Pending but past due)
    const newlyOverdue = await prisma.followUp.findMany({
      where: {
        ...companyFilter,
        status: "Pending",
        nextMeetingDate: { lt: now },
      },
    });

    // 2. Find old overdue follow-ups that need Level 1 escalation (overdue > 48h and escalationLevel === 0)
    const toEscalate = await prisma.followUp.findMany({
      where: {
        ...companyFilter,
        status: "Overdue",
        escalationLevel: 0,
        nextMeetingDate: { lt: fortyEightHoursAgo },
      },
    });

    const managers = await prisma.user.findMany({
      where: {
        role: { in: ["Admin", "SalesManager"] },
        isActive: true,
        ...companyFilter
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    // Process newly overdue follow-ups
    for (const f of newlyOverdue) {
      const isEscalated = f.nextMeetingDate < fortyEightHoursAgo;
      await prisma.followUp.update({
        where: { id: f.id },
        data: {
          status: "Overdue",
          ...(isEscalated ? { escalationLevel: 1 } : {}),
        },
      });

      // Notify assignee
      if (f.assignedUserId) {
        await dispatchNotification({
          userId: f.assignedUserId,
          title: "Follow-Up Overdue",
          message: `Your scheduled follow-up for customer is now overdue.`,
          type: "follow_up",
          link: "/follow-up",
        });
      }

      // Notify managers
      if (managerIds.length > 0) {
        await dispatchNotificationsToMany({
          userIds: managerIds,
          title: "Follow-Up Overdue Alert",
          message: `Follow-up assigned to user ${f.assignedUserId} is overdue.`,
          type: "follow_up",
          link: "/follow-up",
        });
      }

      if (isEscalated) {
        if (f.assignedUserId) {
          await logAudit(
            f.assignedUserId,
            "follow-up",
            "escalate",
            `Follow-up ${f.id} automatically escalated to Level 1 (overdue > 48h)`
          );
        }

        if (managerIds.length > 0) {
          await dispatchNotificationsToMany({
            userIds: managerIds,
            title: "Follow-Up Escalated (Level 1)",
            message: `Follow-up ${f.id} escalated to Level 1 (overdue > 48h).`,
            type: "follow_up",
            link: "/follow-up",
          });
        }
      }
    }

    // Process escalations for existing Overdue follow-ups
    for (const f of toEscalate) {
      await prisma.followUp.update({
        where: { id: f.id },
        data: { escalationLevel: 1 },
      });

      if (f.assignedUserId) {
        await logAudit(
          f.assignedUserId,
          "follow-up",
          "escalate",
          `Follow-up ${f.id} automatically escalated to Level 1 (overdue > 48h)`
        );
      }

      if (managerIds.length > 0) {
        await dispatchNotificationsToMany({
          userIds: managerIds,
          title: "Follow-Up Escalated (Level 1)",
          message: `Follow-up ${f.id} escalated to Level 1 (overdue > 48h).`,
          type: "follow_up",
          link: "/follow-up",
        });
      }
    }
  } catch (error) {
    console.error("checkAndUpdateOverdueFollowUps error:", error);
  }
}

export async function getFollowUpsAction(params?: {
  status?: string;
  priority?: string;
  assignedUserId?: string;
  sourceType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
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

    // Run sweep to ensure statuses are fresh (scoped to tenant)
    await checkAndUpdateOverdueFollowUps(userPayload.companyId);

    const scope = buildScope(userPayload, "FollowUp");

    // Build filters
    let searchFilter = {};
    if (params?.search?.trim()) {
      const searchTerms = params.search.trim();
      const [matchingCustomers, matchingLeads] = await Promise.all([
        prisma.customer.findMany({
          where: { name: { contains: searchTerms }, companyId: userPayload.companyId, deletedAt: null },
          select: { id: true },
        }),
        prisma.lead.findMany({
          where: { name: { contains: searchTerms }, companyId: userPayload.companyId, deletedAt: null },
          select: { id: true },
        })
      ]);
      const customerIds = matchingCustomers.map((c) => c.id);
      const leadIds = matchingLeads.map((l) => l.id);

      searchFilter = {
        OR: [
          { customerId: { in: customerIds } },
          { leadId: { in: leadIds } },
          { remarks: { contains: searchTerms } },
          { notes: { contains: searchTerms } },
          { completionNotes: { contains: searchTerms } },
        ],
      };
    }

    let dateFilter = {};
    if (params?.startDate || params?.endDate) {
      dateFilter = {
        nextMeetingDate: {
          ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
          ...(params.endDate ? { lte: new Date(new Date(params.endDate).setHours(23, 59, 59, 999)) } : {}),
        },
      };
    }

    const whereClause = {
      ...scope,
      stageAtCreation: { not: "Lead" },
      AND: [
        params?.assignedUserId ? { assignedUserId: params.assignedUserId } : {},
        params?.status ? { status: params.status as any } : {},
        params?.priority ? { priority: params.priority } : {},
        params?.sourceType ? { sourceType: params.sourceType } : {},
        dateFilter,
        searchFilter,
      ],
    };

    const followUps = await prisma.followUp.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, status: true } },
        lead: { select: { id: true, name: true, leadCode: true, status: true, companyName: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { nextMeetingDate: "asc" },
    });

    const normalized = followUps.map((f) => ({
      ...f,
      scheduledTime: f.nextMeetingDate.toISOString(),
      nextMeetingDate: f.nextMeetingDate.toISOString(),
      dueDate: f.dueDate ? f.dueDate.toISOString() : null,
      reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
      completedAt: f.completedAt ? f.completedAt.toISOString() : null,
      notes: f.remarks || f.notes,
      userId: f.assignedUserId,
      user: f.assignedUser,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET FollowUps Error:", error);
    return { success: false, message: "Failed to fetch follow-ups" };
  }
}

/**
 * Determines the stageAtCreation discriminator ("Lead" or "Deal") based on
 * the qualification status of the related lead or customer at creation time.
 * Unqualified lead statuses map to "Lead"; everything else maps to "Deal".
 */
export async function getStageAtCreation(
  prismaTx: any,
  leadId?: string | null,
  customerId?: string | null
): Promise<string> {
  if (leadId) {
    const lead = await prismaTx.lead.findUnique({
      where: { id: leadId },
      select: { status: true },
    });
    if (lead && ["New", "Contacted", "Duplicate", "Lost"].includes(lead.status)) {
      return "Lead";
    }
  }
  return "Deal";
}

export async function createFollowUpAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const parsedInput = createSchema.safeParse({
      customerId: data.customerId || null,
      leadId: data.leadId || null,
      nextMeetingDate: new Date(data.nextMeetingDate || data.scheduledTime),
      remarks: data.remarks || data.notes || null,
      notes: data.notes || data.remarks || null,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      priority: data.priority || "Medium",
      sourceType: data.sourceType || "MANUAL",
      sourceId: data.sourceId || null,
      assignedUserId: data.assignedUserId || data.assignedToId || userPayload.id,
      autoCreated: data.autoCreated || false,
      type: data.type || null,
    });

    if (!parsedInput.success) {
      return { success: false, message: parsedInput.error.issues[0]?.message || "Invalid input data" };
    }

    const validated = parsedInput.data;

    const dateValidationError = validateNotInPast(validated.nextMeetingDate, "Follow-up date");
    if (dateValidationError) {
      return { success: false, message: dateValidationError };
    }

    // Check if Executive is trying to assign to someone else
    if (userPayload.role === "SalesExecutive" && validated.assignedUserId !== userPayload.id) {
      return { success: false, message: "Executives can only assign follow-ups to themselves" };
    }

    // Verify Customer scope
    if (validated.customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: validated.customerId } });
      if (!cust || !checkRecordScope(userPayload, cust, "Customer")) {
        return { success: false, message: "Customer not found or access denied." };
      }
    }

    // Verify Lead scope
    if (validated.leadId) {
      const ld = await prisma.lead.findUnique({ where: { id: validated.leadId } });
      if (!ld || !checkRecordScope(userPayload, ld, "Lead")) {
        return { success: false, message: "Lead not found or access denied." };
      }

      // Auto-transition: If lead is still "New", mark as "Contacted" when a follow-up is scheduled
      if (ld.status === "New") {
        const now = new Date();
        await prisma.lead.update({
          where: { id: validated.leadId },
          data: {
            status: "Contacted",
            lastInteractionAt: now,
            ...(ld.firstRespondedAt ? {} : { slaStatus: "Met", firstRespondedAt: now }),
          },
        }).catch((e) => console.error("Auto-transition lead status failed:", e));
      }
    }

    // Resolve stageAtCreation discriminator based on lead qualification status
    const stageAtCreation = await getStageAtCreation(
      prisma,
      validated.leadId || null,
      validated.customerId || null
    );

    const followUp = await prisma.followUp.create({
      data: {
        customerId: validated.customerId || null,
        leadId: validated.leadId || null,
        entityType: validated.leadId ? "lead" : (validated.customerId ? "account" : null),
        entityId: validated.leadId || validated.customerId || null,
        assignedUserId: validated.assignedUserId || userPayload.id,
        nextMeetingDate: validated.nextMeetingDate,
        dueDate: validated.nextMeetingDate, // Align dueDate with nextMeetingDate
        remarks: validated.remarks,
        notes: validated.notes,
        reminderAt: validated.reminderAt,
        priority: validated.priority,
        sourceType: validated.sourceType,
        sourceId: validated.sourceId,
        autoCreated: validated.autoCreated,
        type: validated.type || null,
        status: "Pending",
        companyId: userPayload.companyId,
        stageAtCreation,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "follow-up",
      "create",
      `Follow-up scheduled for customer ${validated.customerId} on ${validated.nextMeetingDate.toISOString()}`
    );

    return {
      success: true,
      message: "Follow-up scheduled successfully",
      data: {
        ...followUp,
        scheduledTime: followUp.nextMeetingDate.toISOString(),
        nextMeetingDate: followUp.nextMeetingDate.toISOString(),
        dueDate: followUp.dueDate ? followUp.dueDate.toISOString() : null,
        reminderAt: followUp.reminderAt ? followUp.reminderAt.toISOString() : null,
        notes: followUp.remarks || followUp.notes,
        userId: followUp.assignedUserId,
        user: followUp.assignedUser,
      },
    };
  } catch (error) {
    console.error("POST FollowUp Error:", error);
    return { success: false, message: "Failed to schedule follow-up" };
  }
}

export async function updateFollowUpStatusAction(data: { id: string; status: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, status } = data;
    if (!id || !status) return { success: false, message: "ID and status are required" };

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, existing, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Executive can only update own
    if (userPayload.role === "SalesExecutive" && existing.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    const followUp = await prisma.followUp.update({
      where: { id },
      data: { status: status as any },
    });

    await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} status marked as ${status}`);

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");

    return { success: true, message: "Follow-up updated", data: { id: followUp.id } };
  } catch (error) {
    console.error("Update Status Error:", error);
    return { success: false, message: "Failed to update follow-up status" };
  }
}

export async function completeFollowUpWithStatusAction(data: {
  id: string;
  customerStatus: string;
  remarks: string;
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
  nextMeetingPriority?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, customerStatus, remarks, nextMeetingDate, nextMeetingNotes, nextMeetingPriority } = data;
    if (!id || !customerStatus || !remarks?.trim()) {
      return { success: false, message: "Follow-up ID, Customer Status, and Outcome Remarks are required." };
    }

    const followUp = await prisma.followUp.findUnique({
      where: { id },
      include: { customer: true, lead: true },
    });

    if (!followUp) return { success: false, message: "Follow-up record not found." };

    // Access scope check
    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Executive can only complete own
    if (userPayload.role === "SalesExecutive" && followUp.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    if (followUp.status === "Completed") return { success: false, message: "Follow-up has already been completed." };

    // Update Customer Status & portal activation triggers OR Lead Status
    let portalMsg = "";
    if (followUp.customerId) {
      if (customerStatus === "APPROVED") {
        await prisma.customer.update({
          where: { id: followUp.customerId },
          data: { status: "ActiveCustomer" },
        });
        const { activateCustomerPortal } = await import("@/app/actions/auth");
        const emailRes = await activateCustomerPortal(followUp.customerId);
        if (emailRes.success) {
          portalMsg = " Portal activation link emailed.";
        }
      } else {
        await prisma.customer.update({
          where: { id: followUp.customerId },
          data: { status: customerStatus as any },
        });
      }
    } else if (followUp.leadId) {
      await prisma.lead.update({
        where: { id: followUp.leadId },
        data: { status: customerStatus as any },
      });
    }

    // Mark Follow-up as Completed and store notes
    const updatedFollowUp = await prisma.followUp.update({
      where: { id },
      data: {
        status: "Completed",
        completedAt: new Date(),
        completedById: userPayload.id,
        completionNotes: remarks.trim(),
        notes: remarks.trim(),
      },
    });

    // Create another follow-up if requested (inherit stageAtCreation from original)
    if (nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: followUp.customerId || null,
          leadId: followUp.leadId || null,
          entityType: followUp.leadId ? "lead" : (followUp.customerId ? "account" : null),
          entityId: followUp.leadId || followUp.customerId || null,
          assignedUserId: followUp.assignedUserId,
          nextMeetingDate: new Date(nextMeetingDate),
          dueDate: new Date(nextMeetingDate),
          remarks: nextMeetingNotes?.trim() || null,
          notes: nextMeetingNotes?.trim() || null,
          status: "Pending",
          visitId: followUp.visitId,
          visitType: followUp.visitType,
          priority: nextMeetingPriority || "Medium",
          sourceType: "MANUAL",
          companyId: userPayload.companyId,
          stageAtCreation: followUp.stageAtCreation || "Deal",
        },
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (followUp.customerId) {
      revalidatePath(`/customers/${followUp.customerId}`);
      revalidatePath(`/customer-master/${followUp.customerId}`);
    }

    await logAudit(
      userPayload.id,
      "follow-up",
      "complete",
      `Follow-up ${id} completed. Customer status set to ${customerStatus}.${portalMsg}`
    );

    return {
      success: true,
      message: `Follow-up completed successfully.${portalMsg}`,
      data: { id: updatedFollowUp.id },
    };
  } catch (error) {
    console.error("Complete FollowUp Error:", error);
    return { success: false, message: "Failed to complete follow-up." };
  }
}

// Complete follow-up action with full compatibility
export async function completeFollowUpAction(data: {
  id: string;
  completionNotes?: string;
  remarks?: string;
  customerStatus?: string;
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
  nextMeetingPriority?: string;
}) {
  const notesText = data.completionNotes || data.remarks || "";
  return completeFollowUpWithStatusAction({
    id: data.id,
    customerStatus: data.customerStatus || "Contacted",
    remarks: notesText,
    nextMeetingDate: data.nextMeetingDate,
    nextMeetingNotes: data.nextMeetingNotes,
    nextMeetingPriority: data.nextMeetingPriority,
  });
}

/**
 * Unified "Complete Follow-Up with Activity" action.
 *
 * A Follow-Up is incomplete without a matching Activity. This action:
 *   1. Creates a CommunicationLog (Call/Meeting/Note) linked via followUpId
 *   2. Marks the Follow-Up as Completed
 *
 * If the user exits the activity form without saving, the follow-up stays Pending.
 * Every completed follow-up is guaranteed to have at least 1 linked activity.
 */
export async function completeFollowUpWithActivityAction(data: {
  followUpId: string;
  activityType: "Call" | "Meeting" | "Note";
  content: string;
  // Call-specific
  direction?: string;
  duration?: number | null;
  status?: string;
  // Meeting-specific
  meetingDate?: string;
  location?: string;
  mode?: string;
  agenda?: string;
  outcome?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { followUpId, activityType, content, status } = data;

    if (!followUpId) return { success: false, message: "Follow-Up ID is required." };
    // Only require content for completed calls/meetings
    if (status === "Completed" && !content?.trim()) return { success: false, message: "Activity content/notes are required for completed activities." };

    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      include: { customer: true, lead: true },
    });

    if (!followUp) return { success: false, message: "Follow-Up not found." };

    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SalesExecutive" && followUp.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    if (followUp.status === "Completed") {
      return { success: false, message: "Follow-Up has already been completed." };
    }

    // Validate activity type matches follow-up type (if set)
    if (followUp.type && followUp.type !== activityType) {
      return { success: false, message: `Activity type must be "${followUp.type}" to match this follow-up.` };
    }

    const now = new Date();

    // Detect if Admin/SalesManager is acting on behalf of the assigned executive
    const isActingOnBehalf = followUp.assignedUserId && followUp.assignedUserId !== userPayload.id &&
      (userPayload.role === "Admin" || userPayload.role === "SalesManager");

    let onBehalfTag = "";
    if (isActingOnBehalf) {
      const [assignedUser, actingUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: followUp.assignedUserId! }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } }),
      ]);
      onBehalfTag = ` [Logged by ${actingUser?.name || userPayload.role} on behalf of ${assignedUser?.name || "assigned executive"}]`;
    }

    // 1. Create the CommunicationLog activity linked to the follow-up
    const activityLog = await prisma.communicationLog.create({
      data: {
        id: undefined,
        channel: activityType,
        customerId: followUp.customerId || null,
        leadId: followUp.leadId || null,
        dealId: null,
        direction: data.direction || "Outbound",
        duration: data.duration ?? null,
        content: content.trim() + onBehalfTag,
        status: data.status || "Completed",
        sentByUserId: userPayload.id,
        sentAt: now,
        companyId: userPayload.companyId ?? null,
        // Meeting-specific fields
        location: data.location || null,
        mode: data.mode || null,
        agenda: data.agenda || null,
        outcome: data.outcome || null,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : null,
        // Critical link: followUpId
        followUpId,
      },
    });

    // 2. Mark the Follow-Up as Completed
    const updatedFollowUp = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: "Completed",
        completedAt: now,
        completedById: userPayload.id,
        completionNotes: content.trim(),
        notes: content.trim(),
      },
    });

    // 2a. Auto-transition lead from New to Contacted when activity is logged
    if (followUp.leadId && data.status !== "Missed" && data.status !== "Cancelled") {
      const lead = await prisma.lead.findUnique({ where: { id: followUp.leadId } });
      if (lead && lead.status === "New") {
        await prisma.lead.update({
          where: { id: followUp.leadId },
          data: {
            status: "Contacted",
            lastInteractionAt: now,
            ...(lead.firstRespondedAt ? {} : { slaStatus: "Met", firstRespondedAt: now }),
          },
        }).catch((e) => console.error("Auto-transition lead status failed:", e));
      }
    }

    await logAudit(
      userPayload.id,
      "follow-up",
      "complete",
      `Follow-up ${followUpId} completed with ${activityType} activity ${activityLog.id}.${onBehalfTag}`,
      isActingOnBehalf ? { onBehalfOf: followUp.assignedUserId ?? undefined, adminAction: true } : undefined
    );

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    revalidatePath("/activities");
    if (followUp.leadId) revalidatePath(`/leads/${followUp.leadId}`);
    if (followUp.customerId) revalidatePath(`/customers/${followUp.customerId}`);

    return {
      success: true,
      message: `Follow-up completed with ${activityType} activity logged.`,
      data: { followUp: updatedFollowUp, activityLog },
    };
  } catch (error) {
    console.error("Complete Follow-Up With Activity Error:", error);
    return { success: false, message: "Failed to complete follow-up with activity." };
  }
}

export async function cancelFollowUpAction(data: { id: string; notes?: string; moveBackToLeads?: boolean }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, notes, moveBackToLeads } = data;
    if (!id) return { success: false, message: "Follow-up ID is required" };

    const followUp = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Executive can only cancel own
    if (userPayload.role === "SalesExecutive" && followUp.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: "Cancelled",
        notes: notes || followUp.notes,
        remarks: notes || followUp.remarks,
      },
    });

    if (moveBackToLeads && followUp.leadId) {
      await prisma.lead.update({
        where: { id: followUp.leadId },
        data: { status: "New" }
      });
      await logAudit(userPayload.id, "LEADS", "UPDATE_LEAD", `Reset lead status to New due to cancelled follow-up`);
      revalidatePath("/leads");
    }

    await logAudit(userPayload.id, "follow-up", "cancel", `Follow-up ${id} marked as Cancelled`);

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (followUp.customerId) {
      revalidatePath(`/customers/${followUp.customerId}`);
      revalidatePath(`/customer-master/${followUp.customerId}`);
    }

    return { success: true, message: "Follow-up cancelled successfully", data: { id: updated.id } };
  } catch (error) {
    console.error("Cancel FollowUp Error:", error);
    return { success: false, message: "Failed to cancel follow-up" };
  }
}

export async function rescheduleFollowUpAction(data: {
  id: string;
  nextMeetingDate: string | Date;
  remarks?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, nextMeetingDate, remarks } = data;
    if (!id || !nextMeetingDate) return { success: false, message: "ID and new date are required" };

    const dateValidationError = validateNotInPast(nextMeetingDate, "Follow-up date");
    if (dateValidationError) {
      return { success: false, message: dateValidationError };
    }

    const followUp = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Executive can only reschedule own
    if (userPayload.role === "SalesExecutive" && followUp.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    const targetDate = new Date(nextMeetingDate);
    const now = new Date();
    // If rescheduled date is in the future, reset status to Pending
    const isFuture = targetDate > now;

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        nextMeetingDate: targetDate,
        dueDate: targetDate,
        status: isFuture ? "Pending" : "Overdue",
        remarks: remarks || followUp.remarks,
        notes: remarks || followUp.notes,
        escalationLevel: isFuture ? 0 : followUp.escalationLevel, // reset escalation if scheduled in future
      },
    });

    await logAudit(
      userPayload.id,
      "follow-up",
      "reschedule",
      `Follow-up ${id} rescheduled to ${targetDate.toISOString()}`
    );

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (followUp.customerId) {
      revalidatePath(`/customers/${followUp.customerId}`);
      revalidatePath(`/customer-master/${followUp.customerId}`);
    }

    return { success: true, message: "Follow-up rescheduled successfully", data: { id: updated.id } };
  } catch (error) {
    console.error("Reschedule FollowUp Error:", error);
    return { success: false, message: "Failed to reschedule follow-up" };
  }
}

export async function reassignFollowUpAction(data: { id: string; assignedUserId: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Only Admin or Lead can reassign
    if (userPayload.role !== "Admin" && userPayload.role !== "SalesManager") {
      return { success: false, message: "Unauthorized: Only Leads and Admins can reassign follow-ups" };
    }

    const { id, assignedUserId } = data;
    if (!id || !assignedUserId) return { success: false, message: "ID and assignedUserId are required" };

    const followUp = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { name: true, companyId: true },
    });

    if (!targetUser) return { success: false, message: "Target assignee user not found" };
    if (targetUser.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized: Target user belongs to a different company." };
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        assignedUserId,
      },
    });

    await logAudit(
      userPayload.id,
      "follow-up",
      "reassign",
      `Follow-up ${id} reassigned to user ${assignedUserId} (${targetUser.name})`
    );

    // Notify new assignee
    await dispatchNotification({
      userId: assignedUserId,
      title: "Follow-Up Reassigned",
      message: `A follow-up has been reassigned to you.`,
      type: "follow_up",
      link: "/follow-up",
    });

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (followUp.customerId) {
      revalidatePath(`/customers/${followUp.customerId}`);
      revalidatePath(`/customer-master/${followUp.customerId}`);
    }

    return { success: true, message: `Follow-up successfully reassigned to ${targetUser.name}`, data: { id: updated.id } };
  } catch (error) {
    console.error("Reassign FollowUp Error:", error);
    return { success: false, message: "Failed to reassign follow-up" };
  }
}

export async function getFollowUpsSummaryAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Sweep before calculating metrics (scoped to tenant)
    await checkAndUpdateOverdueFollowUps(userPayload.companyId);

    const scope = buildScope(userPayload, "FollowUp");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [total, pending, overdue, completedToday, dueToday, upcoming] = await Promise.all([
      // Total active follow-ups (excluding Cancelled, excluding Lead-stage)
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          status: { in: ["Pending", "Completed", "Overdue"] },
        },
      }),
      // Pending
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          status: "Pending",
        },
      }),
      // Overdue
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          status: "Overdue",
        },
      }),
      // Completed today
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          status: "Completed",
          completedAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      // Due today (and still Pending/Overdue)
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          nextMeetingDate: { gte: startOfToday, lte: endOfToday },
          status: { in: ["Pending", "Overdue"] },
        },
      }),
      // Upcoming (future starting tomorrow)
      prisma.followUp.count({
        where: {
          ...scope,
          stageAtCreation: { not: "Lead" },
          nextMeetingDate: { gt: endOfToday },
          status: "Pending",
        },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        pending,
        overdue,
        completedToday,
        dueToday,
        upcoming,
      },
    };
  } catch (error) {
    console.error("GET FollowUps Summary Error:", error);
    return { success: false, message: "Failed to fetch follow-ups summary" };
  }
}

export async function updateFollowUpAction(id: string, data: {
  nextMeetingDate?: string | Date;
  remarks?: string;
  notes?: string;
  priority?: "Low" | "Medium" | "High";
  reminderAt?: string | Date | null;
  status?: any;
  assignedUserId?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, existing, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SalesExecutive" && existing.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    const updateData: any = {};
    if (data.nextMeetingDate !== undefined) {
      const dateValidationError = validateNotInPast(data.nextMeetingDate, "Follow-up date");
      if (dateValidationError) {
        return { success: false, message: dateValidationError };
      }
      updateData.nextMeetingDate = new Date(data.nextMeetingDate);
      updateData.dueDate = updateData.nextMeetingDate;
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
      updateData.notes = data.remarks;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
      updateData.remarks = data.notes;
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.reminderAt !== undefined) updateData.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.assignedUserId !== undefined) {
      if (userPayload.role === "SalesExecutive" && data.assignedUserId !== userPayload.id) {
        return { success: false, message: "Executives can only assign to themselves" };
      }
      // Target user check
      const targetUser = await prisma.user.findUnique({
        where: { id: data.assignedUserId },
        select: { companyId: true }
      });
      if (!targetUser || targetUser.companyId !== userPayload.companyId) {
        return { success: false, message: "Unauthorized: Target user belongs to a different company." };
      }
      updateData.assignedUserId = data.assignedUserId;
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: updateData,
    });

    await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} updated via action`);

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (updated.customerId) {
      revalidatePath(`/customers/${updated.customerId}`);
      revalidatePath(`/customer-master/${updated.customerId}`);
    }

    return { success: true, message: "Follow-up updated successfully", data: updated };
  } catch (error: any) {
    console.error("updateFollowUpAction error:", error);
    return { success: false, message: error.message || "Failed to update follow-up" };
  }
}

export async function parseFollowUpRemarks(remarks: string | null) {
  if (!remarks) return { remarks: "", mode: "Virtual", location: "" };
  const trimmed = remarks.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        remarks: parsed.remarks || parsed.agenda || "",
        mode: parsed.mode || "Virtual",
        location: parsed.location || "",
      };
    } catch {
      // ignore and fall back
    }
  }
  return { remarks, mode: "Virtual", location: "" };
}

export async function getFollowUpByIdAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const followUp = await prisma.followUp.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true, profilePhoto: true } },
        completedBy: { select: { id: true, name: true, email: true } },
        customer: {
          include: {
            assignedUser: { select: { id: true, name: true, email: true } },
            followUps: {
              include: {
                assignedUser: { select: { name: true } },
                completedBy: { select: { name: true } },
              },
              orderBy: { nextMeetingDate: "desc" },
            },
          },
        },
        lead: {
          include: {
            assignedUser: { select: { id: true, name: true, email: true } },
            followUps: {
              include: {
                assignedUser: { select: { name: true } },
                completedBy: { select: { name: true } },
              },
              orderBy: { nextMeetingDate: "desc" },
            },
          },
        },
      },
    });

    if (!followUp) return { success: false, message: "Follow-up not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, followUp, "FollowUp")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SalesExecutive" && followUp.assignedUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: You do not own this follow-up" };
    }

    const parsedRemarks = await parseFollowUpRemarks(followUp.remarks || followUp.notes);

    // Serialize dates
    const serialized = {
      ...followUp,
      mode: parsedRemarks.mode,
      location: parsedRemarks.location,
      agenda: parsedRemarks.remarks,
      scheduledTime: followUp.nextMeetingDate.toISOString(),
      nextMeetingDate: followUp.nextMeetingDate.toISOString(),
      dueDate: followUp.dueDate ? followUp.dueDate.toISOString() : null,
      reminderAt: followUp.reminderAt ? followUp.reminderAt.toISOString() : null,
      completedAt: followUp.completedAt ? followUp.completedAt.toISOString() : null,
      createdAt: followUp.createdAt.toISOString(),
      updatedAt: followUp.updatedAt.toISOString(),
      customer: followUp.customer ? {
        ...followUp.customer,
        createdAt: followUp.customer.createdAt.toISOString(),
        updatedAt: followUp.customer.updatedAt.toISOString(),
        followUps: followUp.customer.followUps.map(f => ({
          ...f,
          nextMeetingDate: f.nextMeetingDate.toISOString(),
          dueDate: f.dueDate ? f.dueDate.toISOString() : null,
          reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
          completedAt: f.completedAt ? f.completedAt.toISOString() : null,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        }))
      } : null,
      lead: followUp.lead ? {
        ...followUp.lead,
        createdAt: followUp.lead.createdAt.toISOString(),
        updatedAt: followUp.lead.updatedAt.toISOString(),
        followUps: followUp.lead.followUps.map(f => ({
          ...f,
          nextMeetingDate: f.nextMeetingDate.toISOString(),
          dueDate: f.dueDate ? f.dueDate.toISOString() : null,
          reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
          completedAt: f.completedAt ? f.completedAt.toISOString() : null,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        }))
      } : null
    };

    return { success: true, data: serialized };
  } catch (error: any) {
    console.error("GET FollowUp By ID Error:", error);
    return { success: false, message: error.message || "Failed to fetch follow-up details" };
  }
}


