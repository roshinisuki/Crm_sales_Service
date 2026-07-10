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

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  try {
    const newQuotation = await prisma.$transaction(async (tx) => {
      // Generate consistent quotation code: QT-YYYY-NNNNN
      const year = new Date().getFullYear();
      const yearCount = await tx.quotation.count({
        where: { companyId: user.companyId, quotationCode: { startsWith: `QT-${year}-` } },
      });
      const quotationCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

      const q = await tx.quotation.create({
        data: {
          quotationCode,
          rfqId: existing.rfqId,
          customerId: existing.customerId,
          contactId: existing.contactId,
          dealId: null, // Don't link to same deal — new quotation may be for a different opportunity
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          totalAmount: existing.totalAmount,
          subtotal: existing.subtotal,
          taxAmount: existing.taxAmount,
          discountPercent: existing.discountPercent,
          finalAmount: existing.finalAmount,
          termsAndConditions: existing.termsAndConditions,
          paymentTerms: existing.paymentTerms,
          deliveryTerms: existing.deliveryTerms,
          freightTerms: existing.freightTerms,
          leadTimeDays: existing.leadTimeDays,
          overallMarginPercent: existing.overallMarginPercent,
          revisionNumber: 1,
          status: "Draft",
          createdById: user.id,
          companyId: user.companyId,
          items: {
            create: existing.items.map((item) => ({
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
            })),
          },
        },
        include: {
          customer: { select: { id: true, name: true } },
          items: true,
        },
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: q.id,
          fromStatus: null,
          toStatus: "Draft",
          changedById: user.id,
          notes: `Duplicated from quotation ${existing.quotationCode}`,
        },
      });

      return q;
    });

    await logAudit(user.id, "Quotation", "Duplicate", `Duplicated quotation ${existing.quotationCode} → ${newQuotation.quotationCode}`, {
      resourceId: id,
      newState: { newQuotationId: newQuotation.id, newCode: newQuotation.quotationCode },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: newQuotation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to duplicate quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
