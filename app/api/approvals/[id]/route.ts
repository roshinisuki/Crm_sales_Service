import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

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
  if (approval.deal && approval.deal.companyId !== user.companyId) {
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
  if (approval.deal && approval.deal.companyId !== user.companyId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: approval });
}
