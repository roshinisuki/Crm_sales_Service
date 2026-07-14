import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { computeOverallMarginPercent } from "@/lib/quotation-margins";
import { logEvent } from "@/lib/activity-event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      lineItems: {
        include: {
          product: { select: { id: true, productCode: true } },
          quantityBreaks: {
            include: {
              costingSheets: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
      customer: { select: { id: true, name: true } },
    },
  });

  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Gate: RFQ status must be CostingCompleted
  if (rfq.status !== "CostingCompleted") {
    return NextResponse.json({
      success: false,
      message: `Quotation can only be generated when the RFQ status is 'CostingCompleted'. Current status: ${rfq.status}`,
    }, { status: 400 });
  }

  // 1. Block unless all line items costingStatus = Done
  const pendingItems = rfq.lineItems.filter((item) => item.costingStatus !== "Done");
  if (pendingItems.length > 0) {
    const names = pendingItems.map((item) => item.itemDescription).join(", ");
    return NextResponse.json({
      success: false,
      message: `Cannot generate quotation — the following line items are still pending costing: ${names}`,
      pendingItems: pendingItems.map((item) => ({ id: item.id, itemDescription: item.itemDescription })),
    }, { status: 400 });
  }

  // 2. Fetch Margin Floor threshold
  const floorConfig = await prisma.systemConfig.findFirst({
    where: { key: "rfq_margin_floor_percent" },
  });
  const threshold = floorConfig ? parseFloat(floorConfig.value) : 15.0;

  // 3. Margin Floor Check
  const lowMarginItems: any[] = [];
  const activeCostingSheets: any[] = [];

  for (const item of rfq.lineItems) {
    const primaryQb = item.quantityBreaks.find((q) => q.quantity === item.quantity) || item.quantityBreaks[0];
    if (!primaryQb) {
      return NextResponse.json({
        success: false,
        message: `No quantity breaks found for line item ${item.itemDescription}`,
      }, { status: 400 });
    }

    const costing = primaryQb.costingSheets[0];
    if (!costing) {
      return NextResponse.json({
        success: false,
        message: `Missing costing details for line item ${item.itemDescription} (Qty: ${primaryQb.quantity})`,
      }, { status: 400 });
    }

    activeCostingSheets.push({ item, qb: primaryQb, costing });
    if (costing.marginPercent < threshold) {
      lowMarginItems.push({
        itemDescription: item.itemDescription,
        quantity: primaryQb.quantity,
        marginPercent: costing.marginPercent,
      });
    }
  }

  if (lowMarginItems.length > 0) {
    const isAuthorized = ["SalesManager", "Admin"].includes(user.role || "");
    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        isMarginBlocked: true,
        threshold,
        lowMarginItems,
        message: `Quotation generation blocked: One or more items fall below the margin floor of ${threshold}%. Approval from a Sales Manager or Admin is required.`,
      }, { status: 403 });
    }
  }

  try {
    // Atomic transaction: create quotation + line items + update RFQ status
    const result = await prisma.$transaction(async (tx) => {
      // Generate quotation number: QT-YYYY-NNNNN
      const year = new Date().getFullYear();
      const yearCount = await tx.quotation.count({
        where: {
          companyId: user.companyId,
          quotationCode: { startsWith: `QT-${year}-` },
        },
      });
      const quotationCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

      const validityDays = body.validityDays ? parseInt(body.validityDays) : 30;
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + validityDays);

      const quotation = await tx.quotation.create({
        data: {
          quotationCode,
          rfqId: id,
          customerId: rfq.customerId,
          contactId: rfq.contactId,
          status: "Draft",
          validUntil: validityDate,
          totalAmount: 0,
          finalAmount: 0,
          subtotal: 0,
          taxAmount: 0,
          discountPercent: 0,
          createdById: user.id,
          companyId: user.companyId,
        },
      });

      let subtotal = 0;
      let taxAmount = 0;

      // Create quotation line items — one for each quantity break
      for (const entry of activeCostingSheets) {
        const { item, qb, costing } = entry;
        const unitPrice = costing.computedUnitPrice;
        // Cost basis = total cost BEFORE margin (reverse out the margin markup)
        const costBasisUnitPrice = costing.marginPercent > 0
          ? costing.computedUnitPrice / (1 + costing.marginPercent / 100)
          : costing.computedUnitPrice;

        // Lookup tax_percent from tax_master by hsnCode, default 18%
        let taxPercent = 18;
        let searchHsn = item.product?.hsnCode || null;
        // fallback to category HSN if not on product (if it existed) - we just use searchHsn
        if (searchHsn) {
          const taxEntry = await tx.taxMaster.findFirst({
            where: { hsnCode: searchHsn, isActive: true },
          });
          if (taxEntry) taxPercent = taxEntry.taxPercent;
        }

        const lineTotal = qb.quantity * unitPrice;
        const lineTax = lineTotal * (taxPercent / 100);

        subtotal += lineTotal;
        taxAmount += lineTax;

        await tx.quotationItem.create({
          data: {
            quotationId: quotation.id,
            productId: item.productId || null,
            description: `${item.itemDescription} (Tier: ${qb.quantity} qty)`,
            quantity: qb.quantity,
            unitPrice,
            totalPrice: lineTotal,
            discountPercent: 0,
            taxPercent,
            lineTotal,
            unit: item.unit || "Pcs",
            costBasisUnitPrice,
            marginPercent: costing.marginPercent,
            priceSource: "RFQCosting",
            quantityBreakId: qb.id,
          },
        });
      }

      const grandTotal = subtotal + taxAmount;

      // Compute overall weighted margin from the items we just created
      const overallMarginPercent = computeOverallMarginPercent(
        activeCostingSheets.map((e) => {
          const costBasis = e.costing.marginPercent > 0
            ? e.costing.computedUnitPrice / (1 + e.costing.marginPercent / 100)
            : e.costing.computedUnitPrice;
          return {
            quantity: e.qb.quantity,
            unitPrice: e.costing.computedUnitPrice,
            costBasisUnitPrice: costBasis,
          };
        })
      );

      // Update quotation with computed totals
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          totalAmount: subtotal,
          subtotal,
          taxAmount,
          finalAmount: grandTotal,
          overallMarginPercent,
        },
      });

      // Update RFQ status
      await tx.rFQ.update({
        where: { id },
        data: { status: "QuotationCreated" },
      });

      await tx.rFQStatusHistory.create({
        data: {
          rfqId: id,
          fromStatus: rfq.status,
          toStatus: "QuotationCreated",
          changedById: user.id,
          notes: `Quotation ${quotationCode} generated.${lowMarginItems.length > 0 ? " Approved low-margin items." : ""}`,
        },
      });

      await logEvent(tx, {
        entityType: "Quotation",
        entityId: quotation.id,
        rootEntityId: id,
        type: "quotation_created",
        fromStatus: null,
        toStatus: "Draft",
        actorId: user.id,
        metadata: { quotationCode, rfqId: id, grandTotal },
      });

      await logEvent(tx, {
        entityType: "RFQ",
        entityId: id,
        type: "rfq_status_changed",
        fromStatus: rfq.status,
        toStatus: "QuotationCreated",
        actorId: user.id,
        metadata: { quotationId: quotation.id, quotationCode },
      });

      return { quotationId: quotation.id, quotationCode, grandTotal };
    });

    // Notify assigned sales executive
    if (rfq.assignedUserId) {
      await dispatchNotification({
        userId: rfq.assignedUserId,
        title: "Quotation Generated",
        message: `Quotation ${result.quotationCode} generated from RFQ ${rfq.rfqCode} (₹${result.grandTotal.toFixed(2)})`,
        type: "rfq",
        link: `/quotations/${result.quotationId}`,
      });
    }

    // Notify customer contact if linked
    if (rfq.contactId) {
      await dispatchNotification({
        userId: rfq.contactId,
        title: "Quotation Ready",
        message: `Your quotation ${result.quotationCode} has been generated. Total: ₹${result.grandTotal.toFixed(2)}`,
        type: "quotation",
        link: `/quotations/${result.quotationId}`,
      }).catch(() => undefined);
    }

    await logAudit(user.id, "RFQ", "GenerateQuotation", `Generated quotation ${result.quotationCode} from RFQ ${rfq.rfqCode}`, {
      resourceId: id,
      newState: { rfqStatus: "QuotationCreated", quotationId: result.quotationId, grandTotal: result.grandTotal },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: { quotation_id: result.quotationId, quotation_code: result.quotationCode } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to generate quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
