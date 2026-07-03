import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/quotations/[id]/negotiate
// Move quotation into UnderReview (negotiation) status after it has been sent or viewed.
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
    include: { customer: { select: { id: true, name: true } } },
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
      if (existing.dealId && existing.status !== "UnderReview") {
        const deal = await tx.deal.findUnique({
          where: { id: existing.dealId },
          select: { id: true, status: true },
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
      }

      return q;
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
