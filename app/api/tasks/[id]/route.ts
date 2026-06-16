import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/tasks/[id]
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id, deletedAt: null },
      include: {
        Contact: { select: { id: true, name: true, company: true } },
        User: { select: { id: true, name: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    if (user.role === "SalesExecutive" && task.assignedTo !== user.id) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/tasks/[id]
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    if (user.role === "SalesExecutive" && existing.assignedTo !== user.id) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.contactId !== undefined && { contactId: body.contactId }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    if (user.role === "SalesExecutive" && existing.assignedTo !== user.id) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
