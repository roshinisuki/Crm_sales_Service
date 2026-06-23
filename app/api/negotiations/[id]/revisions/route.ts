import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// Default discount threshold (%) above which approval is required.
// Falls back to this if no Approval Matrix config is found.
const DEFAULT_DISCOUNT_THRESHOLD = 5;

async function getDiscountThreshold(companyId: string): Promise<number> {
  const config = await prisma.systemConfig.findFirst({
    where: { key: "approval_matrix_discount_threshold", companyId },
  });
  if (config) {
    const val = parseFloat(config.value);
    if (!isNaN(val)) return val;
  }
  return DEFAULT_DISCOUNT_THRESHOLD;
}

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

  // Determine if approval is required based on discount threshold from Approval Matrix settings
  const threshold = await getDiscountThreshold(user.companyId!);
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

      // Create an ApprovalHistory entry so it appears in the Approval Center
      await tx.approvalHistory.create({
        data: {
          approvalType: "Negotiation",
          entityType: "Negotiation",
          entityId: id,
          status: "Pending",
          discountPercent,
          remarks: reason,
          requestedById: user.id,
          previousStatus: negotiation.status,
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

  // B15: Notify assigned user about the revision
  if (updated?.assignedUserId) {
    await dispatchNotification({
      userId: updated.assignedUserId,
      title: requiresApproval ? "Negotiation Revision Needs Approval" : "Negotiation Revision Created",
      message: requiresApproval
        ? `Revision #${nextRevisionNumber} for ${updated.negotiationCode} requires approval (discount ${discountPercent}%).`
        : `Revision #${nextRevisionNumber} for ${updated.negotiationCode} was auto-approved.`,
      type: "negotiation",
      link: `/negotiations/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: requiresApproval
      ? `Revision #${nextRevisionNumber} created. Discount ${discountPercent}% exceeds threshold ${threshold}% — sent for approval.`
      : `Revision #${nextRevisionNumber} created and auto-approved. Negotiation moved to PriceRevision.`,
  }, { status: 201 });
}
