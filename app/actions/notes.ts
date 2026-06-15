"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

type NoteEntityType = "LEAD" | "CONTACT" | "DEAL" | "PROPOSAL" | "VISIT" | "NEGOTIATION";

/**
 * Fetch all active notes for a given entity, scoped to the current tenant.
 */
export async function getNotesAction(entityType: NoteEntityType, entityId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must use support mode." };
    }

    const notes = await prisma.note.findMany({
      where: {
        entityType,
        entityId,
        deletedAt: null,
        companyId: userPayload.companyId,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error("Get Notes Error:", error);
    return { success: false, message: "Failed to fetch notes" };
  }
}

/**
 * Create a note pinned to a specific entity record.
 */
export async function createNoteAction(
  entityType: NoteEntityType,
  entityId: string,
  content: string
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must use support mode." };
    }

    const trimmed = content?.trim();
    if (!trimmed) return { success: false, message: "Note content cannot be empty" };
    if (trimmed.length > 2000) return { success: false, message: "Note must be under 2000 characters" };

    const note = await prisma.note.create({
      data: {
        content: trimmed,
        entityType,
        entityId,
        createdById: userPayload.id,
        companyId: userPayload.companyId,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAudit(
      userPayload.id,
      entityType,
      "NOTE_ADDED",
      `Added note to ${entityType} ${entityId}: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? "…" : ""}"`
    );

    revalidatePath(`/${entityType.toLowerCase()}s/${entityId}`);

    return {
      success: true,
      message: "Note added",
      data: { ...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() },
    };
  } catch (error) {
    console.error("Create Note Error:", error);
    return { success: false, message: "Failed to add note" };
  }
}

/**
 * Delete a note.
 * - Admin/SalesManager: soft delete (sets deletedAt)
 * - SuperAdmin: permanent hard delete
 * - Author can soft-delete their own notes regardless of role
 */
export async function deleteNoteAction(noteId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must use support mode." };
    }

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) return { success: false, message: "Note not found" };

    // Scope check: must belong to same company
    if (note.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Authors can delete their own notes; Admins/Managers can delete any
    const canDelete =
      note.createdById === userPayload.id ||
      ["Admin", "SalesManager", "SuperAdmin"].includes(userPayload.role);

    if (!canDelete) {
      return { success: false, message: "Unauthorized: You can only delete your own notes." };
    }

    if (userPayload.role === "SuperAdmin") {
      await prisma.note.delete({ where: { id: noteId } });
      await logAudit(userPayload.id, note.entityType as any, "NOTE_DELETED_PERMANENT", `Permanently deleted note ${noteId}`);
    } else {
      await prisma.note.update({
        where: { id: noteId },
        data: { deletedAt: new Date(), deletedById: userPayload.id },
      });
      await logAudit(userPayload.id, note.entityType as any, "NOTE_DELETED", `Soft-deleted note ${noteId}`);
    }

    return { success: true, message: "Note deleted" };
  } catch (error) {
    console.error("Delete Note Error:", error);
    return { success: false, message: "Failed to delete note" };
  }
}
