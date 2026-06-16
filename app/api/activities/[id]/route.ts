import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/activities/[id]
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

    const log = await prisma.communicationLog.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
    });

    if (!log) {
      return NextResponse.json({ success: false, message: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/activities/[id]
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

    const existing = await prisma.communicationLog.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Activity not found" }, { status: 404 });
    }

    const updated = await prisma.communicationLog.update({
      where: { id },
      data: {
        ...(body.customerId !== undefined && { customerId: body.customerId }),
        ...(body.leadId !== undefined && { leadId: body.leadId }),
        ...(body.direction !== undefined && { direction: body.direction }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.meetingDate !== undefined && { meetingDate: body.meetingDate ? new Date(body.meetingDate) : null }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.mode !== undefined && { mode: body.mode }),
        ...(body.agenda !== undefined && { agenda: body.agenda }),
        ...(body.outcome !== undefined && { outcome: body.outcome }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/activities/[id]
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

    const existing = await prisma.communicationLog.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Activity not found" }, { status: 404 });
    }

    await prisma.communicationLog.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
