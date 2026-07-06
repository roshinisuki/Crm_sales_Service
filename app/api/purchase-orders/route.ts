import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const negotiationId = searchParams.get("negotiationId");
  const quotationId = searchParams.get("quotationId");
  const assignedUserId = searchParams.get("assignedUserId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (negotiationId) where.negotiationId = negotiationId;
  if (quotationId) where.quotationId = quotationId;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const [purchaseOrders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        negotiation: { select: { id: true, negotiationCode: true, status: true } },
        quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
        deal: { select: { id: true, dealName: true } },
        assignedUser: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: purchaseOrders, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  if (!body.customerId) {
    return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  }
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ success: false, message: "At least one line item is required" }, { status: 400 });
  }

  // Auto-generate poCode
  const count = await prisma.purchaseOrder.count({ where: { companyId: user.companyId } });
  const poCode = `PO-${String(count + 1).padStart(4, "0")}`;

  // Calculate totals from items
  let totalAmount = 0;
  const items = body.items.map((it: any) => {
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

  const discountPercent = parseFloat(body.discountPercent) || 0;
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poCode,
      customerId: body.customerId,
      contactId: body.contactId || null,
      negotiationId: body.negotiationId || null,
      quotationId: body.quotationId || null,
      dealId: body.dealId || null,
      status: "New",
      poNumber: body.poNumber || null,
      poDate: body.poDate ? new Date(body.poDate) : null,
      expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : null,
      totalAmount,
      discountPercent,
      finalAmount,
      paymentTerms: body.paymentTerms || null,
      deliveryTerms: body.deliveryTerms || null,
      shippingAddress: body.shippingAddress || null,
      billingAddress: body.billingAddress || null,
      notes: body.notes || null,
      specialInstructions: body.specialInstructions || null,
      assignedUserId: body.assignedUserId || null,
      companyId: user.companyId,
      items: { create: items },
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      negotiation: { select: { id: true, negotiationCode: true, status: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  await logAudit(user.id, "PurchaseOrder", "Create", `Created purchase order ${poCode}`, {
    resourceId: purchaseOrder.id,
    newState: { poCode, customerId: body.customerId, totalAmount, finalAmount, status: "New" },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: purchaseOrder }, { status: 201 });
}
