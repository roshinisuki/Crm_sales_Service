import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEvent } from "@/lib/activity-event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  // If this quotation inherited a negotiationId from a parent revision (clone), check the
  // linked negotiation's status — block re-negotiation if approval is pending or negotiation is closed.
  if (existing.negotiationId) {
    const linkedNeg = await prisma.negotiation.findFirst({
      where: { id: existing.negotiationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (linkedNeg) {
      if (linkedNeg.status === "PendingApproval") {
        return NextResponse.json(
          { success: false, message: "Cannot start negotiation while a discount approval is pending. Resolve it in the Approval Center first." },
          { status: 400 }
        );
      }
      if (linkedNeg.status === "Closed-Success" || linkedNeg.status === "Closed-Failure") {
        return NextResponse.json(
          { success: false, message: "This negotiation is already closed." },
          { status: 400 }
        );
      }
    }
  }

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

      // Calculate total cost basis of the quotation (sum of item.quantity * item.costBasisUnitPrice)
      let totalCostBasis = 0;
      for (const item of existing.items || []) {
        if (item.costBasisUnitPrice != null) {
          totalCostBasis += Number(item.costBasisUnitPrice) * item.quantity;
        }
      }
      // Round to 2 decimal places to match Decimal column precision and avoid SQL Server arithmetic overflow
      totalCostBasis = Math.round(totalCostBasis * 100) / 100;
      // Safety clamp: Decimal(18,2) max is 9999999999999999.99
      const MAX_COST_BASIS = 9999999999999999.99;
      if (totalCostBasis > MAX_COST_BASIS) totalCostBasis = MAX_COST_BASIS;

      // Clamp overallMarginPercent to Decimal(8,2) max (99999.99)
      const marginPercent = existing.overallMarginPercent != null ? Number(existing.overallMarginPercent) : null;
      const clampedMarginPercent = marginPercent != null ? Math.min(marginPercent, 99999.99) : null;

      // Find existing negotiation linked to this quotation — either directly via quotationId,
      // or inherited via the quotation's negotiationId field (set during clone).
      // This ensures R2/R3/R4 reuses the same negotiation as R1.
      const existingNeg = await tx.negotiation.findFirst({
        where: {
          OR: [
            { quotationId: id, deletedAt: null },
            ...(existing.negotiationId ? [{ id: existing.negotiationId, deletedAt: null }] : []),
          ],
        },
        select: { id: true, quotationId: true, status: true },
      });

      let negotiationRecord = existingNeg;
      if (!existingNeg) {
        let negotiationCode = "";
        let codeExists = true;
        let countOffset = 0;
        while (codeExists) {
          const negCount = await tx.negotiation.count({ where: { companyId: user.companyId } });
          negotiationCode = `NEG-${String(negCount + 1 + countOffset).padStart(4, "0")}`;
          const dup = await tx.negotiation.findFirst({
            where: { companyId: user.companyId, negotiationCode },
            select: { id: true },
          });
          if (!dup) {
            codeExists = false;
          } else {
            countOffset++;
          }
        }

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
            costBasisUnitPrice: totalCostBasis,
            overallMarginPercent: clampedMarginPercent,
            customerDemands: body.customerDemands || null,
            internalNotes: body.internalNotes || null,
            negotiationType: body.negotiationType || null,
            negotiationReason: body.negotiationReason || null,
          },
        });
        // Set negotiationId on the quotation so the negotiation badge shows
        await tx.quotation.update({
          where: { id },
          data: { negotiationId: negotiationRecord.id },
        });
      } else {
        // Reuse existing negotiation — update quotationId to point to THIS revision
        // so discounts land on the correct quotation (R2/R3/R4, not stale R1).
        // Reset to Active with fresh amounts since this is a new quotation revision.
        await tx.negotiation.update({
          where: { id: existingNeg.id },
          data: {
            quotationId: id,
            initialAmount: existing.finalAmount || existing.totalAmount || 0,
            costBasisUnitPrice: totalCostBasis,
            overallMarginPercent: clampedMarginPercent,
            status: "Active",
            revisedAmount: null,
            discountRequested: 0,
            discountApproved: null,
            ...(body.customerDemands ? { customerDemands: body.customerDemands } : {}),
            ...(body.internalNotes ? { internalNotes: body.internalNotes } : {}),
            ...(body.negotiationType ? { negotiationType: body.negotiationType } : {}),
            ...(body.negotiationReason ? { negotiationReason: body.negotiationReason } : {}),
          },
        });
        // Ensure negotiationId is set on the current quotation
        if (existing.negotiationId !== existingNeg.id) {
          await tx.quotation.update({
            where: { id },
            data: { negotiationId: existingNeg.id },
          });
        }
      }

      const negId = negotiationRecord?.id || existingNeg?.id || "";
      await logEvent(tx, {
        entityType: "Negotiation",
        entityId: negId,
        rootEntityId: id,
        type: "negotiation_started",
        fromStatus: null,
        toStatus: "Active",
        actorId: user.id,
        metadata: { quotationId: id, quotationCode: existing.quotationCode, initialAmount: existing.finalAmount },
      });

      return { quotation: q, negotiationId: negId };
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
