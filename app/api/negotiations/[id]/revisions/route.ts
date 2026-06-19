import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Default discount threshold (%) above which approval is required.
// In production this should come from the Approval Matrix settings.
const DEFAULT_DISCOUNT_THRESHOLD = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.proposedAmount === undefined || body.proposedAmount === null || body.proposedAmount === "") {
    return NextResponse.json({ success: false, message: "Proposed amount is required" }, { status: 400 });
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // Only allow revisions when Active or PriceRevision
  if (!["Active", "PriceRevision"].includes(negotiation.status)) {
    return NextResponse.json({ success: false, message: "Cannot add revision to a negotiation that is not Active or in PriceRevision" }, { status: 400 });
  }

  const proposedAmount = parseFloat(body.proposedAmount);
  const discountPercent = body.discountPercent ? parseFloat(body.discountPercent) : 0;
  const reason = body.reason || null;
  const nextRevisionNumber = (negotiation.revisions[0]?.revisionNumber || 0) + 1;

  // Determine if approval is required based on discount threshold
  const threshold = DEFAULT_DISCOUNT_THRESHOLD;
  const requiresApproval = discountPercent > threshold;

  // Create the revision in a transaction along with status + approval request
  const result = await prisma.$transaction(async (tx) => {
    const revision = await tx.negotiationRevision.create({
      data: {
        negotiationId: id,
        revisionNumber: nextRevisionNumber,
        proposedAmount,
        discountPercent,
        reason,
        status: requiresApproval ? "Pending" : "Approved",
        createdById: user.id,
      },
    });

    if (requiresApproval) {
      // Set negotiation to PendingApproval; revision stays Pending
      await tx.negotiation.update({
        where: { id },
        data: {
          status: "PendingApproval",
          revisedAmount: proposedAmount,
          discountRequested: discountPercent,
        },
      });

      // Create an ApprovalRequest entry for the Approval Center
      const approvalCount = await tx.approvalRequest.count({ where: { companyId: user.companyId } });
      const approvalCode = `APR-${String(approvalCount + 1).padStart(4, "0")}`;
      await tx.approvalRequest.create({
        data: {
          approvalCode,
          approvalType: "NegotiationDiscount",
          entityType: "Negotiation",
          entityId: id,
          status: "Pending",
          requestedAmount: proposedAmount,
          requestedDiscount: discountPercent,
          justification: reason,
          requestedById: user.id,
          priority: discountPercent > threshold * 2 ? "High" : "Normal",
          companyId: user.companyId,
        },
      });
    } else {
      // Auto-approve: set negotiation to PriceRevision
      await tx.negotiation.update({
        where: { id },
        data: {
          status: "PriceRevision",
          revisedAmount: proposedAmount,
          discountRequested: discountPercent,
        },
      });
    }

    return revision;
  });

  // Fetch the updated negotiation with revisions to return
  const updated = await prisma.negotiation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      revisions: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { revisionNumber: "asc" },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: requiresApproval
      ? `Revision #${nextRevisionNumber} created. Discount ${discountPercent}% exceeds threshold ${threshold}% — sent for approval.`
      : `Revision #${nextRevisionNumber} created and auto-approved. Negotiation moved to PriceRevision.`,
  }, { status: 201 });
}
