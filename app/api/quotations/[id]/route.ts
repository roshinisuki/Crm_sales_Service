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

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      rfq: { select: { id: true, rfqCode: true, status: true } },
      deal: { select: { id: true, dealName: true, status: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: quotation });
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

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.rfqId !== undefined) updateData.rfqId = body.rfqId || null;
  if (body.dealId !== undefined) updateData.dealId = body.dealId || null;
  if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil);
  if (body.termsAndConditions !== undefined) updateData.termsAndConditions = body.termsAndConditions || null;
  if (body.discountPercent !== undefined) {
    updateData.discountPercent = parseFloat(body.discountPercent) || 0;
    updateData.finalAmount = existing.totalAmount * (1 - updateData.discountPercent / 100);
  }
  if (body.status !== undefined) updateData.status = body.status;

  const quotation = await prisma.quotation.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json({ success: true, data: quotation });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  await prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Quotation deleted" });
}
