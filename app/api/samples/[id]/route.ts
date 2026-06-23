import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const VALID_STATUSES = ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const sample = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      product: { select: { id: true, name: true, productCode: true, unit: true, basePrice: true, productType: true } },
      rfq: { select: { id: true, rfqCode: true, status: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
    },
  });

  if (!sample) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: sample });
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

  const existing = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  // B16: SalesRep can only modify samples assigned to them
  if (user.role === "SalesRep" && existing.assignedUserId && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "You can only modify samples assigned to you" }, { status: 403 });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
  }

  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.productId !== undefined) updateData.productId = body.productId;
  if (body.rfqId !== undefined) updateData.rfqId = body.rfqId || null;
  if (body.quantity !== undefined) updateData.quantity = body.quantity ? parseFloat(body.quantity) : 1;
  if (body.specifications !== undefined) updateData.specifications = body.specifications || null;
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.trackingNumber !== undefined) updateData.trackingNumber = body.trackingNumber || null;
  if (body.customerFeedback !== undefined) updateData.customerFeedback = body.customerFeedback || null;
  if (body.revisionNotes !== undefined) updateData.revisionNotes = body.revisionNotes || null;

  // Status-specific field updates
  if (body.status !== undefined && body.status !== existing.status) {
    updateData.status = body.status;
    const now = new Date();
    if (body.status === "SentToCustomer") updateData.sentDate = now;
    if (body.status === "Approved") {
      updateData.approvedDate = now;
      updateData.approvedById = user.id;
    }
    if (body.status === "Rejected") {
      updateData.rejectedDate = now;
      updateData.rejectedById = user.id;
    }
    if (body.status === "Revision") updateData.revisionDate = now;
  }

  const sample = await prisma.sampleRequest.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      product: { select: { id: true, name: true, productCode: true, unit: true } },
      rfq: { select: { id: true, rfqCode: true } },
      assignedUser: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: sample });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  // B16: SalesRep can only delete samples assigned to them
  if (user.role === "SalesRep" && existing.assignedUserId && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "You can only delete samples assigned to you" }, { status: 403 });
  }

  await prisma.sampleRequest.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Sample deleted" });
}
