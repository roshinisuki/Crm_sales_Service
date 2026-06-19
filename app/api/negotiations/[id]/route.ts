import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const VALID_STATUSES = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Won", "Lost"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true, status: true } },
      deal: { select: { id: true, dealName: true, status: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      revisions: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { revisionNumber: "asc" },
      },
    },
  });

  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: negotiation });
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

  const existing = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
  }

  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.quotationId !== undefined) updateData.quotationId = body.quotationId || null;
  if (body.dealId !== undefined) updateData.dealId = body.dealId || null;
  if (body.initialAmount !== undefined) updateData.initialAmount = parseFloat(body.initialAmount);
  if (body.revisedAmount !== undefined) updateData.revisedAmount = body.revisedAmount ? parseFloat(body.revisedAmount) : null;
  if (body.customerDemands !== undefined) updateData.customerDemands = body.customerDemands || null;
  if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes || null;
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.discountRequested !== undefined) updateData.discountRequested = parseFloat(body.discountRequested) || 0;
  if (body.discountApproved !== undefined) updateData.discountApproved = body.discountApproved ? parseFloat(body.discountApproved) : null;

  // Status-specific field updates
  if (body.status !== undefined && body.status !== existing.status) {
    updateData.status = body.status;
    const now = new Date();
    if (body.status === "Won") {
      updateData.outcome = "Won";
      updateData.closedAt = now;
      if (body.finalAmount !== undefined) updateData.finalAmount = parseFloat(body.finalAmount);
    }
    if (body.status === "Lost") {
      updateData.outcome = "Lost";
      updateData.closedAt = now;
    }
  }

  const negotiation = await prisma.negotiation.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      revisions: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { revisionNumber: "asc" },
      },
    },
  });

  return NextResponse.json({ success: true, data: negotiation });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  await prisma.negotiation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Negotiation deleted" });
}
