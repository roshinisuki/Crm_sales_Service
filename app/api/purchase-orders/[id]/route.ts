import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const VALID_STATUSES = ["New", "UnderValidation", "Approved", "Rejected", "Closed"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      negotiation: { select: { id: true, negotiationCode: true, status: true, revisedAmount: true, finalAmount: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true, status: true } },
      deal: { select: { id: true, dealName: true, status: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true } } } },
    },
  });

  if (!purchaseOrder) return NextResponse.json({ success: false, message: "Purchase order not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: purchaseOrder });
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

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Purchase order not found" }, { status: 404 });

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
  }

  // If items are provided, recalculate totals
  let totalAmount = existing.totalAmount;
  let finalAmount = existing.finalAmount;
  let discountPercent = existing.discountPercent;
  let itemsOperation: any = undefined;

  if (body.items && Array.isArray(body.items)) {
    totalAmount = 0;
    const newItems = body.items.map((it: any) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unitPrice) || 0;
      const lineTotal = qty * price;
      totalAmount += lineTotal;
      return {
        productId: it.productId || null,
        description: it.description || "",
        quantity: qty,
        unitPrice: price,
        totalPrice: lineTotal,
        notes: it.notes || null,
      };
    });
    discountPercent = parseFloat(body.discountPercent) || 0;
    const discountAmount = totalAmount * (discountPercent / 100);
    finalAmount = totalAmount - discountAmount;
    // Replace all items
    itemsOperation = {
      deleteMany: {},
      create: newItems,
    };
  } else if (body.discountPercent !== undefined) {
    discountPercent = parseFloat(body.discountPercent) || 0;
    const discountAmount = totalAmount * (discountPercent / 100);
    finalAmount = totalAmount - discountAmount;
  }

  const updateData: any = {
    totalAmount,
    discountPercent,
    finalAmount,
  };
  if (itemsOperation) updateData.items = itemsOperation;

  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.negotiationId !== undefined) updateData.negotiationId = body.negotiationId || null;
  if (body.quotationId !== undefined) updateData.quotationId = body.quotationId || null;
  if (body.dealId !== undefined) updateData.dealId = body.dealId || null;
  if (body.poNumber !== undefined) updateData.poNumber = body.poNumber || null;
  if (body.poDate !== undefined) updateData.poDate = body.poDate ? new Date(body.poDate) : null;
  if (body.expectedDelivery !== undefined) updateData.expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : null;
  if (body.actualDelivery !== undefined) updateData.actualDelivery = body.actualDelivery ? new Date(body.actualDelivery) : null;
  if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms || null;
  if (body.deliveryTerms !== undefined) updateData.deliveryTerms = body.deliveryTerms || null;
  if (body.shippingAddress !== undefined) updateData.shippingAddress = body.shippingAddress || null;
  if (body.billingAddress !== undefined) updateData.billingAddress = body.billingAddress || null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;
  if (body.specialInstructions !== undefined) updateData.specialInstructions = body.specialInstructions || null;
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.poDocumentUrl !== undefined) updateData.poDocumentUrl = body.poDocumentUrl || null;
  if (body.validationChecklist !== undefined) updateData.validationChecklist = body.validationChecklist || null;

  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "Closed" && !existing.actualDelivery) {
      updateData.actualDelivery = new Date();
    }
  }

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      negotiation: { select: { id: true, negotiationCode: true, status: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: purchaseOrder });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Purchase order not found" }, { status: 404 });

  await prisma.purchaseOrder.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Purchase order deleted" });
}
