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
  dealId?: string | null;
  assignedTo?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function generateTaskCode(): Promise<string> {
  const count = await prisma.task.count();
  const next = count + 1;
  return `TSK-${String(next).padStart(4, "0")}`;
}

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getTasksAction(params?: {
  search?: string;
  status?: string;
  priority?: string;
  assignedUserId?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { search = "", status = "", priority = "", assignedUserId = "" } = params || {};

    const where: any = { deletedAt: null };

    // Admins/Managers see all company tasks; Executives see own tasks
    if (user.role === "SalesExecutive") {
      where.assignedTo = user.id;
    } else if (user.companyId) {
      where.companyId = user.companyId;
    }

    if (assignedUserId) where.assignedTo = assignedUserId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
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
      where: { id, deletedAt: null },
      include: {
        Contact: { select: { id: true, name: true, company: true } },
        User: { select: { id: true, name: true } },
      },
    });

    if (!task) {
      return { success: false, message: "Task not found." };
    }

    // Authorization: executives can only see their own tasks
    if (user.role === "SalesExecutive" && task.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }

    // Admins/Managers: must be same company
    if (user.role !== "SalesExecutive" && user.companyId && task.companyId !== user.companyId) {
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

    const taskCode = await generateTaskCode();

    const task = await prisma.task.create({
      data: {
        id: nanoid(),
        taskCode,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "Open",
        priority: input.priority ?? "Medium",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        assignedTo: input.assignedTo || user.id,
        companyId: user.companyId ?? null,
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

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return { success: false, message: "Task not found." };
    }

    // Authorization check
    if (user.role === "SalesExecutive" && existing.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }
    if (user.role !== "SalesExecutive" && user.companyId && existing.companyId !== user.companyId) {
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
        ...(input.dealId !== undefined && { dealId: input.dealId }),
      },
    });

    revalidatePath("/tasks");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateTaskAction error:", error);
    return { success: false, message: "Failed to update task." };
  }
}

// ─── DELETE (Soft) ───────────────────────────────────────────────────────────

export async function deleteTaskAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return { success: false, message: "Task not found." };
    }

    // Authorization check
    if (user.role === "SalesExecutive" && existing.assignedTo !== user.id) {
      return { success: false, message: "Task not found." };
    }

    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    console.error("deleteTaskAction error:", error);
    return { success: false, message: "Failed to delete task." };
  }
}

// ─── MARK OVERDUE (CRON / manual) ────────────────────────────────────────────

export async function markOverdueTasksAction() {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const now = new Date();

    const result = await prisma.task.updateMany({
      where: {
        deletedAt: null,
        status: "Open",
        dueDate: { lt: now },
      },
      data: { status: "Overdue" },
    });

    return { success: true, count: result.count };
  } catch (error) {
    console.error("markOverdueTasksAction error:", error);
    return { success: false, message: "Failed to mark overdue tasks." };
  }
}
