import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { computeItemMarginPercent, computeOverallMarginPercent } from "@/lib/quotation-margins";

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

  if (existing.status !== "Draft") {
    return NextResponse.json({ success: false, message: "Only Draft quotations can be edited" }, { status: 400 });
  }

  // Edit lock: block item edits while negotiation is active
  if (existing.negotiationId) {
    const negotiation = await prisma.negotiation.findFirst({
      where: { id: existing.negotiationId, deletedAt: null },
      select: { status: true, negotiationCode: true },
    });
    if (negotiation && !["Closed-Success", "Closed-Failure"].includes(negotiation.status)) {
      if (user.role !== "Admin") {
        return NextResponse.json(
          { success: false, message: `This quotation is under active negotiation (${negotiation.negotiationCode}) and line items cannot be edited. Price changes are applied through the negotiation revision flow.` },
          { status: 409 }
        );
      }
    }
  }

  const items = body.items || [];

  // Compute totals with tax lookup and margin
  let subtotal = 0;
  let totalTax = 0;
  const processedItems: any[] = [];

  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const lineDiscount = parseFloat(item.discountPercent) || 0;
    const lineTotal = qty * unitPrice * (1 - lineDiscount / 100);

    // Preserve cost basis from existing matching item
    const matched = existing.items.find(
      (it) => it.productId === item.productId || (it.productId === null && it.description === item.description)
    );
    const costBasis = matched?.costBasisUnitPrice ? Number(matched.costBasisUnitPrice) : (item.costBasisUnitPrice ? parseFloat(item.costBasisUnitPrice) : null);
    const priceSource = matched?.priceSource || (costBasis ? "RFQCosting" : "StandaloneManual");
    const qbId = matched?.quantityBreakId || item.quantityBreakId || null;

    const marginVal = costBasis != null && costBasis > 0 ? computeItemMarginPercent(unitPrice, costBasis) : null;

    // Tax lookup
    let taxPercent = 18;
    let hsn = item.hsn || null;
    if (item.productId) {
      const prod = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { hsnCode: true, productCode: true },
      });
      if (prod) hsn = prod.hsnCode || prod.productCode;
    }
    if (hsn) {
      const taxEntry = await prisma.taxMaster.findFirst({ where: { hsnCode: hsn, isActive: true } });
      if (taxEntry) taxPercent = taxEntry.taxPercent;
    }

    const lineTax = lineTotal * (taxPercent / 100);
    subtotal += lineTotal;
    totalTax += lineTax;

    processedItems.push({
      productId: item.productId || null,
      description: item.description,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      discountPercent: lineDiscount,
      taxPercent,
      lineTotal,
      hsn,
      unit: item.unit || "Pcs",
      notes: item.notes || null,
      costBasisUnitPrice: costBasis,
      marginPercent: marginVal,
      priceSource,
      quantityBreakId: qbId,
    });
  }

  const discountAmount = subtotal * (existing.discountPercent / 100);
  const grandTotal = subtotal - discountAmount + totalTax;

  const overallMarginPercent = computeOverallMarginPercent(
    processedItems.map((pi) => ({
      quantity: pi.quantity,
      unitPrice: pi.unitPrice,
      costBasisUnitPrice: pi.costBasisUnitPrice,
    }))
  );

  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
  for (const pi of processedItems) {
    await prisma.quotationItem.create({ data: { quotationId: id, ...pi } });
  }

  const quotation = await prisma.quotation.update({
    where: { id },
    data: { totalAmount: subtotal, subtotal, taxAmount: totalTax, finalAmount: grandTotal, overallMarginPercent },
    include: {
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: quotation });
}
