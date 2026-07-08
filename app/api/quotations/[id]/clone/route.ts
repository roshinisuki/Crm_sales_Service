import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const negotiationId: string | undefined = body.negotiationId;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Snapshot current revision
      const snapshotJson = JSON.stringify({
        quotationCode: existing.quotationCode,
        revisionNumber: existing.revisionNumber,
        status: existing.status,
        validUntil: existing.validUntil,
        subtotal: existing.subtotal,
        taxAmount: existing.taxAmount,
        totalAmount: existing.totalAmount,
        discountPercent: existing.discountPercent,
        finalAmount: existing.finalAmount,
        termsAndConditions: existing.termsAndConditions,
        paymentTerms: existing.paymentTerms,
        deliveryTerms: existing.deliveryTerms,
        freightTerms: existing.freightTerms,
        leadTimeDays: existing.leadTimeDays,
        overallMarginPercent: existing.overallMarginPercent ? Number(existing.overallMarginPercent) : null,
        items: existing.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          lineTotal: it.lineTotal,
          hsn: it.hsn,
          unit: it.unit,
          notes: it.notes,
          costBasisUnitPrice: it.costBasisUnitPrice ? Number(it.costBasisUnitPrice) : null,
          marginPercent: it.marginPercent ? Number(it.marginPercent) : null,
          priceSource: it.priceSource,
          quantityBreakId: it.quantityBreakId,
        })),
      });

      await tx.quotationRevisionSnapshot.create({
        data: {
          quotationId: id,
          revisionNumber: existing.revisionNumber,
          snapshotJson,
          createdById: user.id,
        },
      });

      // 2. Generate new quotation code
      const year = new Date().getFullYear();
      const yearCount = await tx.quotation.count({
        where: {
          companyId: user.companyId,
          quotationCode: { startsWith: `QT-${year}-` },
        },
      });
      const newCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

      // 3. Create new quotation (clone)
      const newQuotation = await tx.quotation.create({
        data: {
          quotationCode: newCode,
          rfqId: existing.rfqId,
          customerId: existing.customerId,
          contactId: existing.contactId,
          dealId: existing.dealId,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from today
          discountPercent: existing.discountPercent,
          totalAmount: existing.totalAmount,
          subtotal: existing.subtotal,
          taxAmount: existing.taxAmount,
          finalAmount: existing.finalAmount,
          termsAndConditions: existing.termsAndConditions,
          paymentTerms: existing.paymentTerms,
          deliveryTerms: existing.deliveryTerms,
          freightTerms: existing.freightTerms,
          leadTimeDays: existing.leadTimeDays,
          overallMarginPercent: existing.overallMarginPercent,
          revisionNumber: existing.revisionNumber + 1,
          status: "Draft",
          createdById: user.id,
          companyId: user.companyId,
          negotiationId: negotiationId || existing.negotiationId || null,
          parentQuotationId: existing.parentQuotationId || id,
        },
      });

      // 4. Copy line items with cost basis fields
      for (const item of existing.items) {
        await tx.quotationItem.create({
          data: {
            quotationId: newQuotation.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            discountPercent: item.discountPercent,
            taxPercent: item.taxPercent,
            lineTotal: item.lineTotal,
            hsn: item.hsn,
            unit: item.unit,
            notes: item.notes,
            costBasisUnitPrice: item.costBasisUnitPrice,
            marginPercent: item.marginPercent,
            priceSource: item.priceSource,
            quantityBreakId: item.quantityBreakId,
          },
        });
      }

      // 5. Initial status history for new quotation
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: newQuotation.id,
          fromStatus: null,
          toStatus: "Draft",
          changedById: user.id,
          notes: `Cloned from quotation ${existing.quotationCode} (R${existing.revisionNumber})`,
        },
      });

      return { quotationId: newQuotation.id, quotationCode: newCode, revisionNumber: existing.revisionNumber + 1 };
    });

    await logAudit(user.id, "Quotation", "Clone", `Cloned quotation ${existing.quotationCode} → ${result.quotationCode} (R${result.revisionNumber})`, {
      resourceId: id,
      newState: { newQuotationId: result.quotationId, newCode: result.quotationCode, revisionNumber: result.revisionNumber },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to clone quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
