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
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Sent", "UnderReview"].includes(existing.status)) {
    return NextResponse.json(
      { success: false, message: "Only Sent or already UnderReview quotations can be moved to negotiation" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "UnderReview" },
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: "UnderReview",
          changedById: user.id,
          notes: "Moved to negotiation — customer requested changes",
        },
      });

      // If linked to an opportunity, move it to Negotiation stage so the negotiation form is surfaced
      let deal: { id: string; status: string; assignedUserId: string | null } | null = null;
      if (existing.dealId && existing.status !== "UnderReview") {
        deal = await tx.deal.findUnique({
          where: { id: existing.dealId },
          select: { id: true, status: true, assignedUserId: true },
        });
        if (deal && deal.status !== "Negotiation" && deal.status !== "Won" && deal.status !== "Lost") {
          await tx.deal.update({
            where: { id: deal.id },
            data: { status: "Negotiation" },
          });
          await tx.dealStageHistory.create({
            data: {
              dealId: deal.id,
              fromStatus: deal.status,
              toStatus: "Negotiation",
              changedById: user.id,
              outcomeNotes: `Moved to negotiation from quotation ${existing.quotationCode}`,
            },
          });
        }
      } else if (existing.dealId) {
        // Even if quotation was already UnderReview, fetch the deal for assignedUserId
        deal = await tx.deal.findUnique({
          where: { id: existing.dealId },
          select: { id: true, status: true, assignedUserId: true },
        });
      }

      // Calculate costBasisUnitPrice average
      let totalCostBasis = 0;
      let costBasisCount = 0;
      for (const item of existing.items || []) {
        if (item.costBasisUnitPrice != null) {
          totalCostBasis += Number(item.costBasisUnitPrice);
          costBasisCount++;
        }
      }
      const costBasisAvg = costBasisCount > 0 ? (totalCostBasis / costBasisCount) : null;

      // Auto-create a Negotiation record so it appears in the Negotiations module
      const existingNeg = await tx.negotiation.findFirst({
        where: { quotationId: id, deletedAt: null },
        select: { id: true },
      });

      let negotiationRecord = existingNeg;
      if (!existingNeg) {
        const negCount = await tx.negotiation.count({ where: { companyId: user.companyId } });
        const negotiationCode = `NEG-${String(negCount + 1).padStart(4, "0")}`;
        negotiationRecord = await tx.negotiation.create({
          data: {
            negotiationCode,
            customerId: existing.customerId,
            quotationId: id,
            dealId: existing.dealId || null,
            initialAmount: existing.finalAmount || existing.totalAmount || 0,
            status: "Active",
            assignedUserId: deal?.assignedUserId || null,
            companyId: user.companyId,
            costBasisUnitPrice: costBasisAvg,
            overallMarginPercent: existing.overallMarginPercent,
          },
        });
        // Set negotiationId on the root quotation so the negotiation badge shows on R1's page
        await tx.quotation.update({
          where: { id },
          data: { negotiationId: negotiationRecord.id },
        });
      } else {
        await tx.negotiation.update({
          where: { id: existingNeg.id },
          data: {
            costBasisUnitPrice: costBasisAvg,
            overallMarginPercent: existing.overallMarginPercent,
          },
        });
      }

      return { quotation: q, negotiationId: negotiationRecord?.id };
    });

    await logAudit(user.id, "Quotation", "Negotiate", `Moved quotation ${existing.quotationCode} to UnderReview`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: "UnderReview" },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to move to negotiation: ${error.message}` },
      { status: 500 }
    );
  }
}
