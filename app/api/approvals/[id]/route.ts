import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";
import { applyDiscountToQuotationItems } from "@/lib/quotation-margins";

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
  if (!approval) return NextResponse.json({ success: false, message: "Pending approval not found" }, { status: 404 });

  // Verify company scope
  if (approval.companyId && approval.companyId !== user.companyId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const newStatus = action === "approve" ? "Approved" : "Rejected";

  const updated = await prisma.approvalHistory.update({
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
      await prisma.purchaseOrder.update({
        where: { id: approval.entityId! },
        data: {
          status: "Approved",
          approvedById: user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
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

  // Negotiation approval side effect
  if (approval.approvalType === "Negotiation" && approval.entityType === "Negotiation") {
    if (action === "approve") {
      // Approve the pending revision and move negotiation to PriceRevision
      const pendingRevision = await prisma.negotiationRevision.findFirst({
        where: { negotiationId: approval.entityId!, status: "Pending" },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      });
      if (pendingRevision) {
        await prisma.negotiationRevision.update({
          where: { id: pendingRevision.id },
          data: { status: "Approved" },
        });
      }
      const updatedNegotiation = await prisma.negotiation.update({
        where: { id: approval.entityId! },
        data: {
          status: "PriceRevision",
          discountApproved: approval.discountPercent,
          approvedById: user.id,
        },
      });
      // Apply the approved discount to the underlying Quotation
      if (updatedNegotiation.quotationId) {
        const rootQuotation = await prisma.quotation.findFirst({
          where: { id: updatedNegotiation.quotationId, deletedAt: null },
          include: { items: true },
        });
        if (rootQuotation) {
          const totalAmount = rootQuotation.totalAmount || 0;
          // C.3/C.4: Recalculate line items + tax proportionally
          const recalc = applyDiscountToQuotationItems(
            rootQuotation.items.map(i => ({ id: i.id, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, taxPercent: i.taxPercent, discountPercent: i.discountPercent })),
            totalAmount,
            approval.discountPercent
          );
          await prisma.quotation.update({
            where: { id: rootQuotation.id },
            data: {
              discountPercent: approval.discountPercent,
              finalAmount: recalc.finalAmount,
              taxAmount: recalc.taxAmount,
              subtotal: recalc.subtotal,
            },
          });
          // Update each line item
          for (const updatedItem of recalc.items) {
            await prisma.quotationItem.update({
              where: { id: updatedItem.id },
              data: {
                unitPrice: updatedItem.unitPrice,
                totalPrice: updatedItem.totalPrice,
                lineTotal: updatedItem.lineTotal,
                discountPercent: updatedItem.discountPercent,
              },
            });
          }
          await prisma.quotationStatusHistory.create({
            data: {
              quotationId: rootQuotation.id,
              fromStatus: rootQuotation.status,
              toStatus: rootQuotation.status,
              changedById: user.id,
              notes: `Discount of ${approval.discountPercent}% applied via approved negotiation revision`,
            },
          });
        }
      }
    } else {
      // Reject: revert negotiation to previous status
      const revertStatus = approval.previousStatus || "Active";
      const pendingRevision = await prisma.negotiationRevision.findFirst({
        where: { negotiationId: approval.entityId!, status: "Pending" },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      });
      if (pendingRevision) {
        await prisma.negotiationRevision.update({
          where: { id: pendingRevision.id },
          data: { status: "Rejected" },
        });
      }
      await prisma.negotiation.update({
        where: { id: approval.entityId! },
        data: { status: revertStatus },
      });
    }
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
