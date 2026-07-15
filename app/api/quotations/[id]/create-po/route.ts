import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { logEvent } from "@/lib/activity-event";

// Create a Purchase Order from an Accepted Quotation.
// Copies line items from the quotation and links customer, contact, deal, negotiation.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  if (!["Admin", "SalesManager", "SalesExecutive"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : null;
  const assignedUserId = body.assignedUserId || user.id;
  const notes = body.notes || "";

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, gstNumber: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, status: true } },
      items: true,
      rfq: { select: { id: true, expectedDeliveryDate: true, lineItems: { select: { requestedDeliveryDate: true } } } },
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (existing.status !== "Accepted") {
    return NextResponse.json({ success: false, message: "Only Accepted quotations can be converted to a Purchase Order" }, { status: 400 });
  }

  // Prevent duplicate PO for the same quotation
  const existingPo = await prisma.purchaseOrder.findFirst({
    where: { quotationId: id, deletedAt: null, companyId: user.companyId },
    select: { id: true, poCode: true },
  });
  if (existingPo) {
    return NextResponse.json(
      { success: false, message: `A purchase order (${existingPo.poCode}) already exists for this quotation`, data: { purchaseOrderId: existingPo.id } },
      { status: 400 }
    );
  }

  // Find linked negotiation (if any)
  const negotiation = await prisma.negotiation.findFirst({
    where: { quotationId: id, deletedAt: null },
    select: { id: true, negotiationCode: true, finalAmount: true, revisedAmount: true },
  });

  // Auto-compute expectedDelivery if not explicitly provided
  let computedExpectedDelivery = expectedDelivery;
  if (!computedExpectedDelivery) {
    // Priority 1: Quotation leadTimeDays (poDate + leadTimeDays)
    if (existing.leadTimeDays && existing.leadTimeDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + existing.leadTimeDays);
      computedExpectedDelivery = d;
    }
    // Priority 2: Earliest RFQ line item requestedDeliveryDate
    else if (existing.rfq?.lineItems?.length) {
      const deliveryDates = existing.rfq.lineItems
        .map((li) => li.requestedDeliveryDate)
        .filter(Boolean) as Date[];
      if (deliveryDates.length > 0) {
        computedExpectedDelivery = new Date(Math.min(...deliveryDates.map((d) => d.getTime())));
      }
    }
    // Priority 3: RFQ-level expectedDeliveryDate
    else if (existing.rfq?.expectedDeliveryDate) {
      computedExpectedDelivery = existing.rfq.expectedDeliveryDate;
    }
  }

  // Auto-fetch shipping address from customer if not in quotation
  const shippingAddress = existing.customer?.shippingAddress || existing.customer?.billingAddress || null;

  // Map quotation items → PO items
  const items = existing.items.map((it) => ({
    productId: it.productId || null,
    description: it.description || "",
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    totalPrice: it.totalPrice || it.quantity * it.unitPrice,
    notes: it.notes || null,
    discountPercent: it.discountPercent || 0,
    taxPercent: it.taxPercent || 18,
    lineTotal: it.lineTotal || it.totalPrice,
  }));

  // Bug #6 fix: quotation.items[].totalPrice/lineTotal are ALREADY net of the negotiated
  // discount (applyNegotiationRevision writes discounted prices directly onto the item rows).
  // discountPercent is stored purely for display/audit purposes at this point — re-applying it
  // on top of totalAmount here was double-discounting the PO. Tax must be computed on the
  // already-net totalPrice directly, not on a second discount pass.
  const totalAmount = items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
  const discountPercent = existing.discountPercent || 0;
  const taxAmount = existing.items.reduce((sum, it) => {
    const lineNet = it.totalPrice || 0;
    return sum + lineNet * ((it.taxPercent || 18) / 100);
  }, 0);
  const finalAmount = totalAmount + taxAmount;

  const result = await prisma.$transaction(async (tx) => {
    // Auto-generate poCode using MAX-based sequential numbering to avoid race conditions
    let poCode = "";
    let codeExists = true;
    let seqOffset = 0;
    while (codeExists) {
      const lastPO = await tx.purchaseOrder.findFirst({
        where: { companyId: user.companyId },
        orderBy: { poCode: "desc" },
        select: { poCode: true },
      });
      let poSeq = 1;
      if (lastPO?.poCode) {
        const match = lastPO.poCode.match(/PO-(\d+)/);
        if (match) poSeq = parseInt(match[1], 10) + 1;
      }
      poSeq += seqOffset;
      poCode = `PO-${String(poSeq).padStart(4, "0")}`;
      const dup = await tx.purchaseOrder.findFirst({
        where: { companyId: user.companyId, poCode },
        select: { id: true },
      });
      if (!dup) {
        codeExists = false;
      } else {
        seqOffset++;
      }
    }

    // 1. Create the Purchase Order
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poCode,
        customerId: existing.customerId,
        contactId: existing.contactId || null,
        negotiationId: negotiation?.id || null,
        quotationId: existing.id,
        dealId: existing.dealId || null,
        status: "New",
        poDate: new Date(),
        expectedDelivery: computedExpectedDelivery,
        totalAmount,
        discountPercent,
        taxAmount,
        finalAmount,
        quotationFinalAmount: existing.finalAmount,
        amountReconciled: Math.abs(finalAmount - (existing.finalAmount || 0)) < 0.01,
        paymentTerms: existing.paymentTerms || null,
        deliveryTerms: existing.deliveryTerms || null,
        shippingAddress,
        billingAddress: existing.customer?.billingAddress || null,
        notes: `Created from Quotation ${existing.quotationCode}. ${notes || ""}`.trim(),
        assignedUserId,
        companyId: user.companyId,
        items: { create: items },
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      },
    });

    await logEvent(tx, {
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      rootEntityId: existing.dealId || existing.id,
      type: "po_created",
      fromStatus: null,
      toStatus: "New",
      actorId: user.id,
      metadata: { poCode, quotationId: existing.id, quotationCode: existing.quotationCode, finalAmount },
    });

    return { purchaseOrder, poCode };
  });

  const { purchaseOrder, poCode } = result;

  await logAudit(
    user.id,
    "PurchaseOrder",
    "Create",
    `Created purchase order ${poCode} from quotation ${existing.quotationCode} (Value: ${purchaseOrder.finalAmount})`,
    { resourceId: purchaseOrder.id, newState: { poCode, quotationId: id, totalAmount, finalAmount, status: "New" } }
  );

  // Notify assigned executive if different from creator
  if (assignedUserId && assignedUserId !== user.id) {
    await dispatchNotification({
      userId: assignedUserId,
      title: "New Purchase Order Assigned",
      message: `You have been assigned PO ${poCode} from quotation ${existing.quotationCode}.`,
      type: "Order",
      link: `/purchase-orders/${purchaseOrder.id}`,
    });
  }

  // Notify Managers/Admin
  const managers = await prisma.user.findMany({
    where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: user.companyId },
    select: { id: true },
  });
  const managerIds = managers.map((m) => m.id).filter((mid) => mid !== user.id);
  if (managerIds.length > 0) {
    await dispatchNotificationsToMany({
      userIds: managerIds,
      title: "New Purchase Order Created",
      message: `${user.email} created PO ${poCode} from accepted quotation ${existing.quotationCode}.`,
      type: "Order",
      link: `/purchase-orders/${purchaseOrder.id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: purchaseOrder,
    message: `Purchase order ${poCode} created from quotation`,
  });
}
