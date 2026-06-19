import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const visit = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      host: { select: { id: true, name: true, email: true } },
    },
  });

  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: visit });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  // Special actions
  if (body.action === "checkin") {
    const visit = await prisma.customerVisit.update({
      where: { id },
      data: { checkInTime: new Date(), status: "CHECKED_IN" },
      include: { customer: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ success: true, data: visit });
  }

  if (body.action === "checkout") {
    const updateData: any = {
      checkOutTime: new Date(),
      status: "COMPLETED",
      meetingSummary: body.meetingSummary,
      outcome: body.outcome || null,
      customerDecision: body.customerDecision || null,
    };
    if (body.rejectionReason) updateData.rejectionReason = body.rejectionReason;
    if (body.nextMeetingDate) updateData.nextMeetingDate = new Date(body.nextMeetingDate);
    if (body.nextMeetingNotes) updateData.nextMeetingNotes = body.nextMeetingNotes;

    const visit = await prisma.customerVisit.update({
      where: { id },
      data: updateData,
      include: { customer: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } },
    });

    // Auto-create FollowUp if nextMeetingDate is provided
    if (body.nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId,
          assignedUserId: visit.hostedBy,
          nextMeetingDate: new Date(body.nextMeetingDate),
          notes: body.nextMeetingNotes || null,
          sourceType: "VISIT_CHECKOUT",
          sourceId: visit.id,
          status: "Pending",
          priority: "Medium",
          companyId: visit.companyId,
          autoCreated: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: visit });
  }

  // Regular update
  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.purpose !== undefined) updateData.purpose = body.purpose;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.meetingType !== undefined) updateData.meetingType = body.meetingType;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.agenda !== undefined) updateData.agenda = body.agenda;
  if (body.department !== undefined) updateData.department = body.department;
  if (body.status !== undefined) updateData.status = body.status;

  const visit = await prisma.customerVisit.update({
    where: { id },
    data: updateData,
    include: { customer: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: visit });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  await prisma.customerVisit.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Visit deleted" });
}
