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
  const body = await request.json();

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Sent", "UnderReview"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Sent or UnderReview quotations can be rejected" }, { status: 400 });
  }

  // Require rejection_reason_id
  if (!body.rejectionReasonId) {
    return NextResponse.json({ success: false, message: "Rejection reason is required" }, { status: 400 });
  }

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: {
          status: "Rejected",
          rejectedAt: new Date(),
          rejectionReason: body.rejectionReasonText || null,
          rejectionReasonId: body.rejectionReasonId,
        },
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: "Rejected",
          changedById: user.id,
          notes: body.rejectionReasonText || `Rejected (reason ID: ${body.rejectionReasonId})`,
        },
      });

      // Close active negotiations
      const activeNegotiations = await tx.negotiation.findMany({
        where: {
          quotationId: id,
          status: { in: ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (activeNegotiations.length > 0) {
        await tx.negotiation.updateMany({
          where: { id: { in: activeNegotiations.map(n => n.id) } },
          data: { status: "Closed-Failure", outcome: "Lost", closedAt: new Date() },
        });
      }

      return q;
    });

    await logAudit(user.id, "Quotation", "Reject", `Rejected quotation ${existing.quotationCode}: ${body.rejectionReasonText || body.rejectionReasonId}`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: "Rejected", rejectionReasonId: body.rejectionReasonId },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: quotation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to reject quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
