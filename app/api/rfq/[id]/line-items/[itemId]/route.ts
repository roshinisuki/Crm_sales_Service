import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// PUT: Edit a line item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await request.json();

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, status: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Prevent editing line items after CostingPending
  const lockedStatuses = ["CostingPending", "QuotationCreated", "Closed"];
  if (lockedStatuses.includes(rfq.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot edit line items — RFQ is in ${rfq.status} status` },
      { status: 400 }
    );
  }

  // Validate line item exists and belongs to this RFQ
  const existing = await prisma.rFQLineItem.findFirst({
    where: { id: itemId, rfqId: id },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Line item not found" }, { status: 404 });

  if (body.item_description !== undefined && !body.item_description.trim()) {
    return NextResponse.json({ success: false, message: "Item description cannot be empty" }, { status: 400 });
  }

  const updateData: any = {};
  if (body.item_description !== undefined) updateData.itemDescription = body.item_description;
  if (body.product_id !== undefined) updateData.productId = body.product_id || null;
  if (body.quantity !== undefined) updateData.quantity = parseFloat(body.quantity) || 1;
  if (body.unit !== undefined) updateData.unit = body.unit || null;
  if (body.target_price !== undefined) updateData.targetPrice = body.target_price ? parseFloat(body.target_price) : null;
  if (body.delivery_date !== undefined) updateData.requestedDeliveryDate = body.delivery_date ? new Date(body.delivery_date) : null;
  if (body.specifications !== undefined) updateData.specifications = body.specifications || null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;

  const updated = await prisma.rFQLineItem.update({
    where: { id: itemId },
    data: {
      ...updateData,
      // Sync quantity breaks if provided in the payload
      ...(body.quantity_breaks !== undefined && Array.isArray(body.quantity_breaks) ? {
        quantityBreaks: {
          deleteMany: {},
          create: (body.quantity_breaks.length > 0
            ? body.quantity_breaks
            : [parseFloat(body.quantity) || 1]
          ).map((qty: number) => ({ quantity: qty })),
        },
      } : {}),
    },
    include: {
      product: { select: { id: true, name: true, productCode: true, unit: true } },
      quantityBreaks: true,
    },
  });

  await logAudit(user.id, "RFQ", "EditLineItem", `Edited line item in RFQ ${rfq.rfqCode}`, {
    resourceId: id,
    previousState: { itemDescription: existing.itemDescription, quantity: existing.quantity },
    newState: updateData,
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: updated });
}

// DELETE: Remove a line item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, status: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Prevent deleting line items after CostingPending
  const lockedStatuses = ["CostingPending", "QuotationCreated", "Closed"];
  if (lockedStatuses.includes(rfq.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot delete line items — RFQ is in ${rfq.status} status` },
      { status: 400 }
    );
  }

  const existing = await prisma.rFQLineItem.findFirst({
    where: { id: itemId, rfqId: id },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Line item not found" }, { status: 404 });

  await prisma.rFQLineItem.delete({ where: { id: itemId } });

  await logAudit(user.id, "RFQ", "DeleteLineItem", `Deleted line item from RFQ ${rfq.rfqCode}`, {
    resourceId: id,
    previousState: { itemDescription: existing.itemDescription, quantity: existing.quantity },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, message: "Line item deleted" });
}
