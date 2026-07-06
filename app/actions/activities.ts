"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { createNoteAction as createNoteActionCanonical } from "@/app/actions/notes";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CallInput {
  customerId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  direction: string; // "Inbound" | "Outbound"
  duration?: number | null;
  content: string; // notes/outcome
  status?: string;
}

export interface MeetingInput {
  customerId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  meetingDate: string;
  location?: string | null;
  mode?: string | null; // "In-person" | "Virtual"
  agenda?: string | null;
  outcome?: string | null;
  content?: string | null;
  status?: string;
}

export interface NoteInput {
  entityType: string; // "LEAD" | "CUSTOMER" | "DEAL"
  entityId: string;
  content: string;
}

export interface EmailInput {
  customerId?: string | null;
  leadId?: string | null;
  subject: string;
  body: string;
  direction?: string;
  status?: string;
}

export interface WhatsAppInput {
  customerId?: string | null;
  leadId?: string | null;
  content: string;
  direction?: string;
  status?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATION LOG (Calls + Meetings)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getActivitiesAction(params?: {
  channel?: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  search?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { channel = "", leadId = "", customerId = "", dealId = "", search = "" } = params || {};

    const where: any = { deletedAt: null };

    if (channel) where.channel = channel;
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (dealId) where.dealId = dealId;
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { outcome: { contains: search } },
        { agenda: { contains: search } },
      ];
    }

    const logs = await prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: "desc" },
    });

    return { success: true, data: logs };
  } catch (error) {
    console.error("getActivitiesAction error:", error);
    return { success: false, message: "Failed to fetch activities." };
  }
}

export async function getActivityByIdAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const log = await prisma.communicationLog.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
    });

    if (!log) {
      return { success: false, message: "Activity not found." };
    }

    return { success: true, data: log };
  } catch (error) {
    console.error("getActivityByIdAction error:", error);
    return { success: false, message: "Failed to fetch activity." };
  }
}

export async function createCallAction(input: CallInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const log = await prisma.communicationLog.create({
      data: {
        id: nanoid(),
        channel: "Call",
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        dealId: input.dealId ?? null,
        direction: input.direction ?? "Outbound",
        duration: input.duration ?? null,
        content: input.content,
        status: input.status ?? "Completed",
        sentByUserId: user.id,
        sentAt: new Date(),
        companyId: user.companyId ?? null,
      },
    });

    // Auto-transition lead from New to Contacted when a call is logged
    if (input.leadId && input.status !== "Missed" && input.status !== "Cancelled") {
      const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
      if (lead && lead.status === "New") {
        const now = new Date();
        await prisma.lead.update({
          where: { id: input.leadId },
          data: {
            status: "Contacted",
            lastInteractionAt: now,
            ...(lead.firstRespondedAt ? {} : { slaStatus: "Met", firstRespondedAt: now }),
          },
        }).catch((e) => console.error("Auto-transition lead status failed:", e));
      }

      // Mark the pending auto-created follow-up (1st Call) as Completed
      // so the Follow-up section stays in sync with the Activity timeline.
      await prisma.followUp.updateMany({
        where: {
          leadId: input.leadId,
          status: "Pending",
          type: "Call",
          sourceType: "AUTO",
        },
        data: {
          status: "Completed",
          completedAt: log.sentAt,
          completionNotes: input.content,
        },
      }).catch(() => {}); // Non-blocking — should not fail the call action
    }

    revalidatePath("/activities");
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
    return { success: true, data: log };
  } catch (error) {
    console.error("createCallAction error:", error);
    return { success: false, message: "Failed to create call log." };
  }
}

export async function createMeetingAction(input: MeetingInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const log = await prisma.communicationLog.create({
      data: {
        id: nanoid(),
        channel: "Meeting",
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        dealId: input.dealId ?? null,
        direction: "Outbound",
        meetingDate: input.meetingDate ? new Date(input.meetingDate) : null,
        location: input.location ?? null,
        mode: input.mode ?? null,
        agenda: input.agenda ?? null,
        outcome: input.outcome ?? null,
        content: input.content ?? "",
        status: input.status ?? "Scheduled",
        sentByUserId: user.id,
        sentAt: new Date(),
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/activities");
    return { success: true, data: log };
  } catch (error) {
    console.error("createMeetingAction error:", error);
    return { success: false, message: "Failed to create meeting log." };
  }
}

export async function createEmailAction(input: EmailInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const content = `Subject: ${input.subject}\n\nBody: ${input.body}`;

    const log = await prisma.communicationLog.create({
      data: {
        id: nanoid(),
        channel: "Email",
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        direction: input.direction ?? "Outbound",
        content,
        status: input.status ?? "Sent",
        sentByUserId: user.id,
        sentAt: new Date(),
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/activities");
    return { success: true, data: log };
  } catch (error) {
    console.error("createEmailAction error:", error);
    return { success: false, message: "Failed to create email log." };
  }
}

export async function createWhatsAppAction(input: WhatsAppInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const log = await prisma.communicationLog.create({
      data: {
        id: nanoid(),
        channel: "WhatsApp",
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        direction: input.direction ?? "Outbound",
        content: input.content,
        status: input.status ?? "Sent",
        sentByUserId: user.id,
        sentAt: new Date(),
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/activities");
    return { success: true, data: log };
  } catch (error) {
    console.error("createWhatsAppAction error:", error);
    return { success: false, message: "Failed to create WhatsApp log." };
  }
}

export async function updateActivityAction(id: string, input: Partial<CallInput & MeetingInput>) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.communicationLog.findUnique({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return { success: false, message: "Activity not found." };
    }

    const updated = await prisma.communicationLog.update({
      where: { id },
      data: {
        ...(input.customerId !== undefined && { customerId: input.customerId }),
        ...(input.leadId !== undefined && { leadId: input.leadId }),
        ...(input.direction !== undefined && { direction: input.direction }),
        ...(input.duration !== undefined && { duration: input.duration }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.meetingDate !== undefined && { meetingDate: input.meetingDate ? new Date(input.meetingDate) : null }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.mode !== undefined && { mode: input.mode }),
        ...(input.agenda !== undefined && { agenda: input.agenda }),
        ...(input.outcome !== undefined && { outcome: input.outcome }),
      },
    });

    revalidatePath("/activities");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateActivityAction error:", error);
    return { success: false, message: "Failed to update activity." };
  }
}

export async function deleteActivityAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer" || user.role === "SalesExecutive") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.communicationLog.findUnique({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return { success: false, message: "Activity not found." };
    }

    await prisma.communicationLog.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    revalidatePath("/activities");
    return { success: true };
  } catch (error) {
    console.error("deleteActivityAction error:", error);
    return { success: false, message: "Failed to delete activity." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES (Note model)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getNotesAction(params?: {
  entityType?: string;
  entityId?: string;
  search?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { entityType = "", entityId = "", search = "" } = params || {};

    const where: any = { deletedAt: null };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (search) where.content = { contains: search };

    const notes = await prisma.note.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: notes };
  } catch (error) {
    console.error("getNotesAction error:", error);
    return { success: false, message: "Failed to fetch notes." };
  }
}

export async function createNoteAction(input: NoteInput) {
  // Delegate to the canonical note creation function in notes.ts
  return createNoteActionCanonical(input.entityType as any, input.entityId, input.content);
}

export async function updateNoteAction(id: string, input: { content?: string }) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.note.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return { success: false, message: "Note not found." };
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        ...(input.content !== undefined && { content: input.content }),
      },
    });

    revalidatePath("/activities");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateNoteAction error:", error);
    return { success: false, message: "Failed to update note." };
  }
}

export async function deleteNoteAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.note.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return { success: false, message: "Note not found." };
    }

    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    revalidatePath("/activities");
    return { success: true };
  } catch (error) {
    console.error("deleteNoteAction error:", error);
    return { success: false, message: "Failed to delete note." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UPS DUE THIS WEEK
// ═══════════════════════════════════════════════════════════════════════════════

export async function getFollowUpsDueThisWeekAction() {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const where: any = {
      deletedAt: null,
      channel: "Meeting",
      status: "Scheduled",
      meetingDate: { gte: now, lte: endOfWeek },
    };

    if (user.role === "SalesExecutive") {
      where.sentByUserId = user.id;
    } else if (user.companyId) {
      where.companyId = user.companyId;
    }

    const followUps = await prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { meetingDate: "asc" },
    });

    return { success: true, data: followUps };
  } catch (error) {
    console.error("getFollowUpsDueThisWeekAction error:", error);
    return { success: false, message: "Failed to fetch follow-ups." };
  }
}
