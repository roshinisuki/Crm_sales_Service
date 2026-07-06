import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      lineItems: { include: { product: { select: { id: true, productCode: true } } }, orderBy: { displayOrder: "asc" } },
      costingSheets: { orderBy: { createdAt: "desc" } },
      customer: { select: { id: true, name: true } },
    },
  });

  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Validate: at least one costing sheet exists
  if (rfq.costingSheets.length === 0) {
    return NextResponse.json(
      { success: false, message: "Cannot generate quotation — no costing sheet submitted for this RFQ" },
      { status: 400 }
    );
  }

  // Build a map: lineItemId -> latest costing sheet for that line item
  const lineItemCostingMap = new Map<string, any>();
  const rfqLevelCosting = rfq.costingSheets.find((cs) => !cs.rfqLineItemId);
  for (const cs of rfq.costingSheets) {
    if (cs.rfqLineItemId && !lineItemCostingMap.has(cs.rfqLineItemId)) {
      lineItemCostingMap.set(cs.rfqLineItemId, cs);
    }
  }

  try {
    // Atomic transaction: create quotation + line items + update RFQ status
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate quotation number: QT-YYYY-NNNNN
      const year = new Date().getFullYear();
      const yearCount = await tx.quotation.count({
        where: {
          companyId: user.companyId,
          quotationCode: { startsWith: `QT-${year}-` },
        },
      });
      const quotationCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

      // 2. Create quotation
      const quotationDate = new Date();
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);

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

      // 3. Create quotation line items from RFQ line items — use per-line-item costing
      let subtotal = 0;
      let taxAmount = 0;

      for (const item of rfq.lineItems) {
        // Lookup per-line-item costing, fallback to RFQ-level costing
        const lineCosting = lineItemCostingMap.get(item.id);
        const costing = lineCosting || rfqLevelCosting;
        if (!costing) {
          throw new Error(`No costing found for line item: ${item.itemDescription}`);
        }
        const unitPrice = costing.computedUnitPrice;

        // Lookup tax_percent from tax_master by product HSN code (default 18%)
        let taxPercent = 18;
        if (item.product?.productCode) {
          const taxEntry = await tx.taxMaster.findFirst({
            where: { hsnCode: item.product.productCode, isActive: true },
          });
          if (taxEntry) taxPercent = taxEntry.taxPercent;
        }

        const lineTotal = item.quantity * unitPrice;
        const lineTax = lineTotal * (taxPercent / 100);

        subtotal += lineTotal;
        taxAmount += lineTax;

        await tx.quotationItem.create({
          data: {
            quotationId: quotation.id,
            productId: item.productId || null,
            description: item.itemDescription,
            quantity: item.quantity,
            unitPrice,
            totalPrice: lineTotal,
            discountPercent: 0,
            taxPercent,
            lineTotal,
            unit: item.unit || null,
          },
        });
      }

      const grandTotal = subtotal + taxAmount;

      // 4. Update quotation with computed totals
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          totalAmount: subtotal,
          subtotal,
          taxAmount,
          finalAmount: grandTotal,
        },
      });

      // 5. Update RFQ status
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
          notes: `Quotation ${quotationCode} generated`,
        },
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
