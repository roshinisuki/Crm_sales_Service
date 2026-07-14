import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";
import { transitionDealStatus } from "@/lib/dealService";
import { createCustomerAssetsFromPO } from "@/lib/service-handoff";
import { logEvent, logEventAsync } from "@/lib/activity-event";
import { applyNegotiationRevision, rejectNegotiationRevision } from "@/lib/negotiation-revision";

// Approve / Reject an approval request
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Only Admin or Sales Manager can approve/reject" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, remarks } = body; // action: "approve" | "reject"

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ success: false, message: "Action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const approval = await prisma.approvalHistory.findFirst({
    where: { id, deletedAt: null, status: "Pending" },
    include: { deal: true },
  });

  // Recovery path: if the approval was already marked Approved but the negotiation revision
  // is still Pending (due to a previous failed transaction), allow re-applying the revision.
  if (!approval) {
    const stuckApproval = await prisma.approvalHistory.findFirst({
      where: { id, deletedAt: null, status: "Approved", approvalType: "Negotiation", entityType: "Negotiation" },
      include: { deal: true },
    });
    if (stuckApproval && action === "approve") {
      const pendingRev = await prisma.negotiationRevision.findFirst({
        where: { negotiationId: stuckApproval.entityId!, status: "Pending" },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      });
      if (pendingRev) {
        try {
          const result = await prisma.$transaction(async (tx) => {
            return await applyNegotiationRevision({
              negotiationId: stuckApproval.entityId!,
              revisionId: pendingRev.id,
              actorId: user.id,
              tx,
            });
          });
          return NextResponse.json({
            success: true,
            data: stuckApproval,
            message: `Recovery: pending revision applied successfully. Negotiation moved to ${result.negotiation.status}.`,
          });
        } catch (err: any) {
          console.error("[negotiation-approval-recovery] Failed:", err);
          return NextResponse.json(
            { success: false, message: `Recovery failed: ${err.message}` },
            { status: 500 }
          );
        }
      }
    }
    return NextResponse.json({ success: false, message: "Pending approval not found" }, { status: 404 });
  }

  // Verify company scope
  if (approval.companyId && approval.companyId !== user.companyId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const newStatus = action === "approve" ? "Approved" : "Rejected";

  // For Negotiation approvals, the approval update and revision application must be atomic.
  // For other types, update approval first (existing behavior).
  let updated: any;

  if (approval.approvalType === "Negotiation" && approval.entityType === "Negotiation") {
    try {
      updated = await prisma.$transaction(async (tx) => {
        // 1. Update approval status
        const approvalResult = await tx.approvalHistory.update({
          where: { id },
          data: {
            status: newStatus,
            resolvedById: user.id,
            resolvedAt: new Date(),
            remarks: remarks || approval.remarks,
          },
          include: {
            deal: { select: { id: true, dealName: true, customer: { select: { id: true, name: true } } } },
            requestedBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
          },
        });

        // 2. Find pending revision
        const pendingRevision = await tx.negotiationRevision.findFirst({
          where: { negotiationId: approval.entityId!, status: "Pending" },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        });

        if (action === "approve" && pendingRevision) {
          await applyNegotiationRevision({
            negotiationId: approval.entityId!,
            revisionId: pendingRevision.id,
            actorId: user.id,
            tx,
          });
        } else if (action === "reject" && pendingRevision) {
          const revertStatus = approval.previousStatus || "Active";
          await rejectNegotiationRevision({
            negotiationId: approval.entityId!,
            revisionId: pendingRevision.id,
            actorId: user.id,
            tx,
            revertStatus,
          });
        }

        return approvalResult;
      });
    } catch (err: any) {
      console.error("[negotiation-approval] Failed to apply revision:", err);
      return NextResponse.json(
        { success: false, message: `Failed to ${action} negotiation revision: ${err.message}` },
        { status: 500 }
      );
    }
  } else {
    // Non-negotiation approvals: update approval first (existing behavior)
    updated = await prisma.approvalHistory.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedById: user.id,
        resolvedAt: new Date(),
        remarks: remarks || approval.remarks,
      },
      include: {
        deal: { select: { id: true, dealName: true, customer: { select: { id: true, name: true } } } },
        requestedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Side effects based on approval type
  if (approval.approvalType === "Discount" && approval.dealId) {
    if (action === "approve") {
      await prisma.deal.update({
        where: { id: approval.dealId },
        data: {
          isLocked: false,
          discountStatus: "Approved",
          discountApprovedById: user.id,
        },
      });
    } else {
      // Revert deal to previous status
      await prisma.deal.update({
        where: { id: approval.dealId },
        data: {
          isLocked: false,
          discountStatus: "Rejected",
          ...(approval.previousStatus ? { status: approval.previousStatus } : {}),
        },
      });
    }
  }

  // PO Approval side effect
  if (approval.approvalType === "PO" && approval.entityType === "PurchaseOrder") {
    if (action === "approve") {
      const po = await prisma.purchaseOrder.update({
        where: { id: approval.entityId! },
        data: {
          status: "Approved",
          approvedById: user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      if (po.dealId) {
        await transitionDealStatus(po.dealId, "Won", {
          actorId: user.id,
          reason: `Won via PO ${po.poCode} approval from Approval Center`,
          companyId: user.companyId!,
          skipQuotationGate: true,
        });
      }
      // Sales → Service handoff: auto-create CustomerAsset records
      try {
        await createCustomerAssetsFromPO(po.id, user.id);
      } catch (err) {
        console.error(`[service-handoff] Failed to create CustomerAssets for PO ${po.poCode} via Approval Center:`, err);
      }
    } else {
      await prisma.purchaseOrder.update({
        where: { id: approval.entityId! },
        data: {
          status: "Rejected",
          rejectionReason: remarks || "Rejected by approver",
        },
      });
    }
  }

  // Quotation approval side effect
  if (approval.approvalType === "Quotation" && approval.entityType === "Quotation") {
    const newQuoteStatus = action === "approve" ? "Approved" : "Rejected";
    await prisma.quotation.update({
      where: { id: approval.entityId! },
      data: { status: newQuoteStatus },
    });
  }

  // Negotiation approval side effect is handled atomically above (approval update + revision in same transaction)

  // Log approval decision as activity event
  if (approval.approvalType === "Negotiation" && approval.entityType === "Negotiation") {
    await logEventAsync({
      entityType: "Negotiation",
      entityId: approval.entityId!,
      type: action === "approve" ? "revision_approved" : "revision_rejected",
      actorId: user.id,
      metadata: { approvalId: id, discountPercent: approval.discountPercent, remarks },
    });
  }
  if (approval.approvalType === "PO" && approval.entityType === "PurchaseOrder") {
    await logEventAsync({
      entityType: "PurchaseOrder",
      entityId: approval.entityId!,
      type: action === "approve" ? "po_approved" : "po_rejected",
      actorId: user.id,
      metadata: { approvalId: id, remarks },
    });
  }

  // B15: Notify the requester about the decision
  if (approval.requestedById) {
    await dispatchNotification({
      userId: approval.requestedById,
      title: `Approval ${newStatus}`,
      message: `Your ${approval.approvalType} approval request has been ${newStatus.toLowerCase()}.`,
      type: "approval",
      link: approval.entityType === "Negotiation" ? `/negotiations/${approval.entityId}` :
            approval.entityType === "PurchaseOrder" ? `/purchase-orders/${approval.entityId}` :
            approval.entityType === "Quotation" ? `/quotations/${approval.entityId}` :
            `/approvals`,
    });
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const approval = await prisma.approvalHistory.findFirst({
    where: { id, deletedAt: null },
    include: {
      deal: { select: { id: true, dealName: true, companyId: true, customer: { select: { id: true, name: true } } } },
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!approval) return NextResponse.json({ success: false, message: "Approval not found" }, { status: 404 });
  if (approval.companyId && approval.companyId !== user.companyId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: approval });
}
