"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CallInput {
  customerId?: string | null;
  leadId?: string | null;
  direction: string; // "Inbound" | "Outbound"
  duration?: number | null;
  content: string; // notes/outcome
  status?: string;
}

export interface MeetingInput {
  customerId?: string | null;
  leadId?: string | null;
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATION LOG (Calls + Meetings)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getActivitiesAction(params?: {
  channel?: string;
  leadId?: string;
  customerId?: string;
  search?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { channel = "", leadId = "", customerId = "", search = "" } = params || {};

    const where: any = { deletedAt: null };

    if (channel) where.channel = channel;
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
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
        direction: input.direction ?? "Outbound",
        duration: input.duration ?? null,
        content: input.content,
        status: input.status ?? "Completed",
        sentByUserId: user.id,
        sentAt: new Date(),
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/activities");
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
    if (!user || user.role === "Customer") {
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
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const note = await prisma.note.create({
      data: {
        id: nanoid(),
        content: input.content,
        entityType: input.entityType,
        entityId: input.entityId,
        createdById: user.id,
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/activities");
    return { success: true, data: note };
  } catch (error) {
    console.error("createNoteAction error:", error);
    return { success: false, message: "Failed to create note." };
  }
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
