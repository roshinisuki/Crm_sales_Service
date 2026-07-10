import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { transitionDealStatus } from "@/lib/dealService";


// POST /api/opportunities/[id]/mark-won
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["SalesExecutive", "SalesManager", "Admin", "SuperAdmin"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { stageHistories: { orderBy: { changedAt: "desc" }, take: 1 } },
  });

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  // Validate: must have at least one Accepted quotation
  const acceptedQuotation = await prisma.quotation.findFirst({
    where: { dealId: id, status: "Accepted", deletedAt: null },
    select: { id: true, quotationCode: true },
  });

  if (!acceptedQuotation) {
    return NextResponse.json(
      { success: false, message: "Cannot mark Won — no Accepted Quotation linked to this opportunity" },
      { status: 400 }
    );
  }

  // Calculate days_in_previous_stage
  const lastHistoryEntry = deal.stageHistories[0];
  let daysInPreviousStage = 0;
  if (lastHistoryEntry) {
    const diffMs = Date.now() - new Date(lastHistoryEntry.changedAt).getTime();
    daysInPreviousStage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update deal won-specific fields
    const updated = await tx.deal.update({
      where: { id },
      data: { probabilityPercent: 100 },
    });

    // 2. Perform status transition via central state machine
    await transitionDealStatus(
      id,
      "Won",
      {
        actorId: user.id,
        companyId: user.companyId!,
      },
      tx
    );

    // 3. Sync Customer status to ActiveCustomer
    await tx.customer.update({
      where: { id: deal.customerId },
      data: { status: "ActiveCustomer" },
    });

    return updated;
  });

  await logAudit(user.id, "Opportunity", "MarkWon", `Marked opportunity "${deal.dealName}" as Won`, {
    resourceId: id,
    previousState: { stage: deal.status },
    newState: { stage: "Won" },
    context: extractAuditContext(request),
    severity: "WARN",
  });

  if (deal.assignedUserId && deal.assignedUserId !== user.id) {
    await dispatchNotification({
      userId: deal.assignedUserId,
      title: "Deal Won!",
      message: `Opportunity "${deal.dealName}" has been marked as Won.`,
      type: "deal",
      link: `/sales-pipeline/${id}`,
    });
  }

  return NextResponse.json({ success: true, data: result, message: "Opportunity marked as Won" });
}
