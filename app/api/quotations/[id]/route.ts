import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

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
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true, billingAddress: true, gstNumber: true, accountType: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      rfq: { select: { id: true, rfqCode: true, status: true } },
      deal: { select: { id: true, dealName: true, status: true, opportunityCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true, basePrice: true } } } },
      createdBy: { select: { id: true, name: true } },
      quotationStatusHistories: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" } },
      revisionSnapshots: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { revisionNumber: "desc" } },
      quotationApprovals: { include: { requestedBy: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } }, revisionAuthor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
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
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  // Only Draft quotations can be edited
  if (existing.status !== "Draft") {
    return NextResponse.json({ success: false, message: "Only Draft quotations can be edited" }, { status: 400 });
  }

  const discountPercent = body.discountPercent !== undefined ? parseFloat(body.discountPercent) || 0 : existing.discountPercent;

  // ── SERVER-COMPUTE ALL TOTALS ──
  // Use new items if provided, otherwise use existing items
  let itemsToCompute: any[];
  if (body.items && Array.isArray(body.items)) {
    itemsToCompute = body.items;
  } else {
    itemsToCompute = existing.items.map((it: any) => ({
      productId: it.productId,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      hsn: it.hsn,
      unit: it.unit,
      notes: it.notes,
    }));
  }

  let subtotal = 0;
  let taxAmount = 0;

  const computedItems = itemsToCompute.map((item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const lineDiscount = parseFloat(item.discountPercent) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 18;

    const lineTotal = qty * unitPrice * (1 - lineDiscount / 100);
    const lineTax = lineTotal * (taxPercent / 100);

    subtotal += lineTotal;
    taxAmount += lineTax;

    return {
      productId: item.productId || null,
      description: item.description,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      discountPercent: lineDiscount,
      taxPercent,
      lineTotal,
      hsn: item.hsn || null,
      unit: item.unit || null,
      notes: item.notes || null,
    };
  });

  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount + taxAmount;

  // Build update data for quotation-level fields
  const updateData: any = {
    subtotal,
    taxAmount,
    totalAmount: subtotal,
    finalAmount: grandTotal,
    discountPercent,
  };
  if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil);
  if (body.termsAndConditions !== undefined) updateData.termsAndConditions = body.termsAndConditions || null;
  if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms || null;
  if (body.deliveryTerms !== undefined) updateData.deliveryTerms = body.deliveryTerms || null;
  if (body.freightTerms !== undefined) updateData.freightTerms = body.freightTerms || null;
  if (body.leadTimeDays !== undefined) updateData.leadTimeDays = body.leadTimeDays ? parseInt(body.leadTimeDays) : null;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      // Update quotation
      const q = await tx.quotation.update({
        where: { id },
        data: updateData,
      });

      // If items provided, replace all line items
      if (body.items && Array.isArray(body.items)) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        for (const item of computedItems) {
          await tx.quotationItem.create({
            data: { quotationId: id, ...item },
          });
        }
      }

      return q;
    });

    const fullQuotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      },
    });

    await logAudit(user.id, "Quotation", "Update", `Updated quotation ${existing.quotationCode}`, {
      resourceId: id,
      previousState: { status: existing.status, discountPercent: existing.discountPercent, subtotal: existing.subtotal, finalAmount: existing.finalAmount },
      newState: { discountPercent, subtotal, taxAmount, grandTotal },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: fullQuotation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to update quotation: ${error.message}` },
      { status: 500 }
    );
  }
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

  // Only Draft quotations can be deleted
  if (existing.status !== "Draft") {
    return NextResponse.json({ success: false, message: "Only Draft quotations can be deleted" }, { status: 400 });
  }

  await prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit(user.id, "Quotation", "Delete", `Deleted quotation ${existing.quotationCode}`, {
    resourceId: id,
    previousState: { quotationCode: existing.quotationCode, status: existing.status },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, message: "Quotation deleted" });
}
