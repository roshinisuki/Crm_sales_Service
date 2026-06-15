"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  contactId?: string | null;
}

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getTasksAction(params?: {
  search?: string;
  status?: string;
  priority?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { search = "", status = "", priority = "" } = params || {};

    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: user.id,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        Contact: { select: { id: true, name: true, company: true } },
        User: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return { success: true, data: tasks };
  } catch (error) {
    console.error("getTasksAction error:", error);
    return { success: false, message: "Failed to fetch tasks." };
  }
}

export async function getTaskByIdAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        Contact: { select: { id: true, name: true, company: true } },
        User: { select: { id: true, name: true } },
      },
    });

    if (!task || task.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }

    return { success: true, data: task };
  } catch (error) {
    console.error("getTaskByIdAction error:", error);
    return { success: false, message: "Failed to fetch task." };
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createTaskAction(input: TaskInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const task = await prisma.task.create({
      data: {
        id: nanoid(),
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "Open",
        priority: input.priority ?? "Medium",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        contactId: input.contactId ?? null,
        assignedTo: user.id,
      },
    });

    revalidatePath("/tasks");
    return { success: true, data: task };
  } catch (error) {
    console.error("createTaskAction error:", error);
    return { success: false, message: "Failed to create task." };
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateTaskAction(id: string, input: Partial<TaskInput> & { status?: string }) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
        ...(input.contactId !== undefined && { contactId: input.contactId }),
      },
    });

    revalidatePath("/tasks");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateTaskAction error:", error);
    return { success: false, message: "Failed to update task." };
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteTaskAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }

    await prisma.task.delete({ where: { id } });
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    console.error("deleteTaskAction error:", error);
    return { success: false, message: "Failed to delete task." };
  }
}
