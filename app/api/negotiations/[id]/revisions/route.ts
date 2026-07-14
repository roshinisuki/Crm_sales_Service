import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { computeItemMarginPercent, computeOverallMarginPercent } from "@/lib/quotation-margins";
import { logEvent } from "@/lib/activity-event";
import { applyNegotiationRevision } from "@/lib/negotiation-revision";

// Default discount threshold (%) above which approval is required.
// Falls back to this if no Approval Matrix config is found.
const DEFAULT_DISCOUNT_THRESHOLD = 5;
const DEFAULT_ESCALATION_THRESHOLD = 15;
const DEFAULT_ESCALATION_ROLE = "SalesDirector";

async function getDiscountThreshold(companyId: string): Promise<number> {
  const config = await prisma.systemConfig.findFirst({
    where: { key: "approval_matrix_discount_threshold" },
  });
  if (config) {
    const val = parseFloat(config.value);
    if (!isNaN(val)) return val;
  }
  return DEFAULT_DISCOUNT_THRESHOLD;
}

async function getEscalationConfig(): Promise<{ threshold: number; role: string }> {
  const [thresholdConfig, roleConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_role" } }),
  ]);
  const threshold = thresholdConfig ? parseFloat(thresholdConfig.value) : DEFAULT_ESCALATION_THRESHOLD;
  const role = roleConfig?.value || DEFAULT_ESCALATION_ROLE;
  return { threshold: isNaN(threshold) ? DEFAULT_ESCALATION_THRESHOLD : threshold, role };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  const revisions = await prisma.negotiationRevision.findMany({
    where: { negotiationId: id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { revisionNumber: "asc" },
  });

  return NextResponse.json({ success: true, data: revisions });
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

  if (!body.reason || !body.reason.trim()) {
    return NextResponse.json({ success: false, message: "Reason is required — explain why this revision is being proposed (e.g. customer asked for lower price, competitor offered better rate, etc.)" }, { status: 400 });
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  console.log("[revisions POST] negotiation status:", negotiation.status, "currentRound:", negotiation.currentRound, "existing revisions count:", negotiation.revisions.length, "latest revision:", negotiation.revisions[0]?.revisionNumber);

  // Only allow revisions when Active or PriceRevision
  if (!["Active", "PriceRevision"].includes(negotiation.status)) {
    return NextResponse.json({ success: false, message: "Cannot add revision to a negotiation that is not Active or in PriceRevision" }, { status: 400 });
  }

  const proposedAmount = parseFloat(body.proposedAmount);
  const reason = body.reason.trim();
  const nextRevisionNumber = (negotiation.revisions[0]?.revisionNumber || 0) + 1;
  console.log("[revisions POST] nextRevisionNumber:", nextRevisionNumber, "requiresApproval will be:", null);

  // B.6: Validate proposedAmount — reject non-positive or amounts greater than current amount
  const currentAmount = negotiation.revisedAmount || negotiation.initialAmount;
  if (isNaN(proposedAmount) || proposedAmount <= 0) {
    return NextResponse.json({ success: false, message: "Proposed amount must be a positive number" }, { status: 400 });
  }
  if (proposedAmount > currentAmount) {
    return NextResponse.json({ success: false, message: `Proposed amount (${proposedAmount}) cannot exceed the current negotiated amount (${currentAmount}). Revisions can only lower the price.` }, { status: 400 });
  }

  // B.4: Compute discount percent server-side instead of trusting client
  const discountPercent = currentAmount > 0
    ? Math.max(0, ((currentAmount - proposedAmount) / currentAmount) * 100)
    : 0;

  // Calculate cumulative discount relative to initialAmount
  const cumulativeDiscount = negotiation.initialAmount > 0
    ? Math.max(0, ((negotiation.initialAmount - proposedAmount) / negotiation.initialAmount) * 100)
    : discountPercent;

  // Determine if approval is required based on discount threshold from Approval Matrix settings
  const threshold = await getDiscountThreshold(user.companyId!);
  const escalationConfig = await getEscalationConfig();
  const requiresApproval = discountPercent > threshold;
  const requiresEscalation = discountPercent > escalationConfig.threshold;
  const approverRole = requiresEscalation ? escalationConfig.role : "SalesManager";

  console.log("[revisions POST] requiresApproval:", requiresApproval, "discountPercent:", discountPercent, "threshold:", threshold, "hasQuotationId:", !!negotiation.quotationId);

  // Create the revision in a transaction along with status + approval request
  const result = await prisma.$transaction(async (tx) => {
    const revision = await tx.negotiationRevision.create({
      data: {
        negotiationId: id,
        revisionNumber: nextRevisionNumber,
        roundNumber: requiresApproval ? negotiation.currentRound : negotiation.currentRound + 1,
        proposedAmount,
        discountPercent,
        cumulativeDiscountPercent: cumulativeDiscount,
        submittedAgainstRound: negotiation.currentRound,
        reason,
        status: requiresApproval ? "Pending" : "Approved",
        createdById: user.id,
      },
    });

    let quotationRevisionId: string | null = null;

    if (!requiresApproval && negotiation.quotationId) {
      // Auto-approve: apply the revision via the single source of truth function
      const result = await applyNegotiationRevision({
        negotiationId: id,
        revisionId: revision.id,
        actorId: user.id,
        tx,
      });
      quotationRevisionId = result.afterSnapshotId;
    }

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
    }

    await logEvent(tx, {
      entityType: "Negotiation",
      entityId: id,
      rootEntityId: negotiation.quotationId || undefined,
      type: requiresApproval ? "revision_proposed" : "revision_auto_approved",
      fromStatus: negotiation.status,
      toStatus: requiresApproval ? "PendingApproval" : "PriceRevision",
      actorId: user.id,
      metadata: { revisionNumber: nextRevisionNumber, proposedAmount, discountPercent, cumulativeDiscount, requiresApproval },
    });

    return { revision, quotationRevisionId };
  });

  console.log("[revisions POST] transaction completed, revision.revisionNumber:", result.revision.revisionNumber);

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

  console.log("[revisions POST] updated negotiation revisions:", updated?.revisions?.map(r => ({ id: r.id, revisionNumber: r.revisionNumber, status: r.status })));

  // B15: Notify assigned user about the revision
  if (updated?.assignedUserId) {
    await dispatchNotification({
      userId: updated.assignedUserId,
      title: requiresApproval ? "Negotiation Revision Needs Approval" : "Negotiation Revision Created",
      message: requiresApproval
        ? `Revision #${nextRevisionNumber} for ${updated.negotiationCode} requires approval (discount ${discountPercent}%${requiresEscalation ? " — escalated to " + approverRole : ""}).`
        : `Revision #${nextRevisionNumber} for ${updated.negotiationCode} was auto-approved.`,
      type: "negotiation",
      link: `/negotiations/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: requiresApproval
      ? `Revision #${nextRevisionNumber} created. Discount ${discountPercent}% exceeds threshold ${threshold}%${requiresEscalation ? " and escalated to " + approverRole : ""} — sent for approval.`
      : `Revision #${nextRevisionNumber} created and auto-approved. Negotiation moved to PriceRevision.`,
  }, { status: 201 });
}
