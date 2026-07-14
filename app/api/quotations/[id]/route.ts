import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { computeItemMarginPercent, computeOverallMarginPercent } from "@/lib/quotation-margins";

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
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true, billingAddress: true, shippingAddress: true, gstNumber: true, accountType: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      rfq: {
        include: {
          lineItems: {
            include: {
              quantityBreaks: {
                include: {
                  costingSheets: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
      deal: { select: { id: true, dealName: true, status: true, opportunityCode: true } },
      negotiation: { select: { id: true, negotiationCode: true, status: true } },
      childRevisions: { select: { id: true, quotationCode: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, productCode: true, unit: true, basePrice: true, hsnCode: true } },
          quantityBreak: { select: { id: true, quantity: true, computedUnitPrice: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      quotationStatusHistories: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" } },
      revisionSnapshots: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { revisionNumber: "desc" } },
      quotationApprovals: { include: { requestedBy: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } }, revisionAuthor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  const rootId = quotation.parentQuotationId || quotation.id;
  const allSnapshots = await prisma.quotationRevisionSnapshot.findMany({
    where: {
      quotation: {
        OR: [
          { id: rootId },
          { parentQuotationId: rootId }
        ]
      }
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { revisionNumber: "desc" }
  });

  const quotationWithAllSnapshots = {
    ...quotation,
    revisionSnapshots: allSnapshots
  };

  const [discountConfig, floorConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_discount_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "quotation_margin_floor_percent" } }),
  ]);
  const discountThreshold = discountConfig ? parseFloat(discountConfig.value) : 5.0;
  const marginFloor = floorConfig ? parseFloat(floorConfig.value) : 15.0;

  return NextResponse.json({
    success: true,
    data: quotationWithAllSnapshots,
    config: { discountThreshold, marginFloor },
  });
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

  if (existing.status !== "Draft") {
    return NextResponse.json({ success: false, message: "Only Draft quotations can be edited" }, { status: 400 });
  }

  // Edit lock: block manual edits while negotiation is active
  if (existing.negotiationId) {
    const negotiation = await prisma.negotiation.findFirst({
      where: { id: existing.negotiationId, deletedAt: null },
      select: { status: true, negotiationCode: true },
    });
    if (negotiation && !["Closed-Success", "Closed-Failure"].includes(negotiation.status)) {
      if (user.role !== "Admin") {
        return NextResponse.json(
          { success: false, message: `This quotation is under active negotiation (${negotiation.negotiationCode}) and cannot be edited manually. Price changes are applied through the negotiation revision flow.` },
          { status: 409 }
        );
      }
    }
  }

  const discountPercent = body.discountPercent !== undefined ? parseFloat(body.discountPercent) || 0 : existing.discountPercent;

  // Fetch margin floor threshold
  const floorConfig = await prisma.systemConfig.findFirst({
    where: { key: "quotation_margin_floor_percent" },
  });
  const marginFloor = floorConfig ? parseFloat(floorConfig.value) : 15.0;

  const isManagerOrAdmin = ["SalesManager", "Admin"].includes(user.role || "");

  // Determine items to process
  let itemsToCompute = body.items && Array.isArray(body.items) ? body.items : existing.items;

  let subtotal = 0;
  let taxAmount = 0;
  let totalGrossRevenue = 0;
  let totalRevenueForMargin = 0;
  let totalMarginRevenue = 0;

  const processedItems: any[] = [];

  // Map and validate line items
  for (const item of itemsToCompute) {
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const lineDiscount = parseFloat(item.discountPercent) || 0;

    // Preserve or determine costing details
    // Find matching existing item to preserve costBasisUnitPrice
    const matchedExisting = existing.items.find(
      (it) => it.productId === item.productId || (it.productId === null && it.description === item.description)
    );

    let costBasis: number | null = null;
    let priceSource = "StandaloneManual";
    let qbId: string | null = null;

    if (matchedExisting) {
      costBasis = matchedExisting.costBasisUnitPrice ? Number(matchedExisting.costBasisUnitPrice) : null;
      priceSource = matchedExisting.priceSource || "StandaloneManual";
      qbId = matchedExisting.quantityBreakId || null;
    } else if (item.costBasisUnitPrice != null) {
      costBasis = parseFloat(item.costBasisUnitPrice);
      priceSource = item.priceSource || "RFQCosting";
      qbId = item.quantityBreakId || null;
    }

    // Live margin calculations
    let marginVal: number | null = null;
    if (costBasis != null && costBasis > 0) {
      marginVal = computeItemMarginPercent(unitPrice, costBasis) ?? 0;
      if (unitPrice !== costBasis) {
        priceSource = "ManualOverride";
      }

      // Block save check if margin falls below floor
      if (marginVal < marginFloor && !isManagerOrAdmin) {
        return NextResponse.json({
          success: false,
          isMarginBlocked: true,
          threshold: marginFloor,
          message: `Save blocked: Margin for item "${item.description || "Product"}" falls below the minimum floor of ${marginFloor}%. Approval from a Sales Manager or Admin is required to override.`,
        }, { status: 403 });
      }

      totalRevenueForMargin += qty * unitPrice;
      totalMarginRevenue += qty * (unitPrice - costBasis);
    } else {
      priceSource = "StandaloneManual";
    }

    const lineTotal = qty * unitPrice * (1 - lineDiscount / 100);
    totalGrossRevenue += qty * unitPrice;
    subtotal += lineTotal;

    processedItems.push({
      productId: item.productId || null,
      description: item.description,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      discountPercent: lineDiscount,
      lineTotal,
      hsn: item.hsn || null,
      unit: item.unit || "Pcs",
      notes: item.notes || null,
      costBasisUnitPrice: costBasis,
      marginPercent: marginVal,
      priceSource,
      quantityBreakId: qbId,
    });
  }

  // Consistent Tax lookups inside transaction
  try {
    const quotation = await prisma.$transaction(async (tx) => {
      let totalTax = 0;

      for (const pi of processedItems) {
        let taxPercent = 18;
        let hsn = pi.hsn;

        if (pi.productId) {
          const prod = await tx.product.findUnique({
            where: { id: pi.productId },
            select: { hsnCode: true, productCode: true }
          });
          if (prod) {
            hsn = prod.hsnCode || hsn || prod.productCode;
          }
        }

        if (hsn) {
          const taxEntry = await tx.taxMaster.findFirst({
            where: { hsnCode: hsn, isActive: true }
          });
          if (taxEntry) taxPercent = taxEntry.taxPercent;
        }

        pi.taxPercent = taxPercent;
        const lineTax = pi.lineTotal * (taxPercent / 100);
        totalTax += lineTax;
      }

      const discountAmount = subtotal * (discountPercent / 100);
      const netTotal = subtotal - discountAmount;
      const grandTotal = netTotal + totalTax;

      // Compute overall weighted margin percent (shared helper)
      const overallMarginPercent = computeOverallMarginPercent(
        processedItems.map((pi) => ({
          quantity: pi.quantity,
          unitPrice: pi.unitPrice,
          costBasisUnitPrice: pi.costBasisUnitPrice,
        }))
      );

      // Build update data
      const updateData: any = {
        subtotal,
        taxAmount: totalTax,
        totalAmount: subtotal,
        finalAmount: grandTotal,
        discountPercent,
        overallMarginPercent,
      };

      if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil);
      if (body.termsAndConditions !== undefined) updateData.termsAndConditions = body.termsAndConditions || null;
      if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms || null;
      if (body.deliveryTerms !== undefined) updateData.deliveryTerms = body.deliveryTerms || null;
      if (body.freightTerms !== undefined) updateData.freightTerms = body.freightTerms || null;
      if (body.leadTimeDays !== undefined) updateData.leadTimeDays = body.leadTimeDays ? parseInt(body.leadTimeDays) : null;
      if (body.contactId !== undefined) updateData.contactId = body.contactId || null;

      // Update quotation
      const q = await tx.quotation.update({
        where: { id },
        data: updateData,
      });

      // Replace line items
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      for (const item of processedItems) {
        await tx.quotationItem.create({
          data: { quotationId: id, ...item },
        });
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
      newState: { discountPercent, subtotal, grandTotal: quotation.finalAmount },
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
