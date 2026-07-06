import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST: Add a line item to an RFQ
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Validate description
  if (!body.item_description || !body.item_description.trim()) {
    return NextResponse.json(
      { success: false, message: "Item description is required" },
      { status: 400 }
    );
  }

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, status: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Prevent adding line items after CostingPending
  const lockedStatuses = ["CostingPending", "QuotationCreated", "Closed"];
  if (lockedStatuses.includes(rfq.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot add line items — RFQ is in ${rfq.status} status` },
      { status: 400 }
    );
  }

  // Get next displayOrder
  const maxOrder = await prisma.rFQLineItem.aggregate({
    where: { rfqId: id },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  const lineItem = await prisma.rFQLineItem.create({
    data: {
      rfqId: id,
      itemDescription: body.item_description,
      productId: body.product_id || null,
      quantity: parseFloat(body.quantity) || 1,
      unit: body.unit || null,
      targetPrice: body.target_price ? parseFloat(body.target_price) : null,
      requestedDeliveryDate: body.delivery_date ? new Date(body.delivery_date) : null,
      specifications: body.specifications || null,
      notes: body.notes || null,
      displayOrder: nextOrder,
    },
    include: { product: { select: { id: true, name: true, productCode: true, unit: true } } },
  });

  await logAudit(user.id, "RFQ", "AddLineItem", `Added line item to RFQ ${rfq.rfqCode}`, {
    resourceId: id,
    newState: { lineItemId: lineItem.id, description: lineItem.itemDescription },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: lineItem }, { status: 201 });
}
