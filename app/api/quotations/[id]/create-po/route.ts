import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

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
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, status: true } },
      items: true,
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

  // Auto-generate poCode
  const count = await prisma.purchaseOrder.count({ where: { companyId: user.companyId } });
  const poCode = `PO-${String(count + 1).padStart(4, "0")}`;

  // Map quotation items → PO items
  const items = existing.items.map((it) => ({
    productId: it.productId || null,
    description: it.description || "",
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    totalPrice: it.totalPrice || it.quantity * it.unitPrice,
    notes: it.notes || null,
  }));

  const totalAmount = items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
  const discountPercent = existing.discountPercent || 0;
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;

  const result = await prisma.$transaction(async (tx) => {
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
        expectedDelivery,
        totalAmount,
        discountPercent,
        finalAmount,
        paymentTerms: existing.paymentTerms || null,
        deliveryTerms: existing.deliveryTerms || null,
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

    return purchaseOrder;
  });

  await logAudit(
    user.id,
    "PurchaseOrder",
    "Create",
    `Created purchase order ${poCode} from quotation ${existing.quotationCode} (Value: ${result.finalAmount})`,
    { resourceId: result.id, newState: { poCode, quotationId: id, totalAmount, finalAmount, status: "New" } }
  );

  // Notify assigned executive if different from creator
  if (assignedUserId && assignedUserId !== user.id) {
    await dispatchNotification({
      userId: assignedUserId,
      title: "New Purchase Order Assigned",
      message: `You have been assigned PO ${poCode} from quotation ${existing.quotationCode}.`,
      type: "Order",
      link: `/purchase-orders/${result.id}`,
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
      link: `/purchase-orders/${result.id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    message: `Purchase order ${poCode} created from quotation`,
  });
}
