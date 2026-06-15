"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  status?: string;
  notes?: string;
}

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getContactsAction(params?: {
  search?: string;
  status?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { search = "", status = "" } = params || {};

    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: user.id,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { company: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        Task: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: contacts };
  } catch (error) {
    console.error("getContactsAction error:", error);
    return { success: false, message: "Failed to fetch contacts." };
  }
}

export async function getContactByIdAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        Task: {
          include: { User: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contact || contact.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    return { success: true, data: contact };
  } catch (error) {
    console.error("getContactByIdAction error:", error);
    return { success: false, message: "Failed to fetch contact." };
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createContactAction(input: ContactInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const contact = await prisma.contact.create({
      data: {
        id: nanoid(),
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        title: input.title ?? null,
        status: input.status ?? "Active",
        notes: input.notes ?? null,
        ownerId: user.id,
      },
    });

    revalidatePath("/contacts");
    return { success: true, data: contact };
  } catch (error) {
    console.error("createContactAction error:", error);
    return { success: false, message: "Failed to create contact." };
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateContactAction(id: string, input: Partial<ContactInput>) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.company !== undefined && { company: input.company }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    revalidatePath("/contacts");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateContactAction error:", error);
    return { success: false, message: "Failed to update contact." };
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteContactAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    await prisma.contact.delete({ where: { id } });
    revalidatePath("/contacts");
    return { success: true };
  } catch (error) {
    console.error("deleteContactAction error:", error);
    return { success: false, message: "Failed to delete contact." };
  }
}
