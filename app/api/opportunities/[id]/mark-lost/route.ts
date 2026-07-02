import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// POST /api/opportunities/[id]/mark-lost
// Body: { lost_reason_id, competitor_id?, notes? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { lost_reason_id, competitor_id, notes } = body;

  // Require lost_reason_id
  if (!lost_reason_id) {
    return NextResponse.json(
      { success: false, message: "lost_reason_id is required to mark an opportunity as Lost" },
      { status: 400 }
    );
  }

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { stageHistories: { orderBy: { changedAt: "desc" }, take: 1 } },
  });

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  // Validate lost_reason_id exists
  const lossReason = await prisma.lossReason.findUnique({
    where: { id: lost_reason_id },
  });
  if (!lossReason) {
    return NextResponse.json({ success: false, message: "Invalid lost_reason_id" }, { status: 400 });
  }

  // Calculate days_in_previous_stage
  const lastHistoryEntry = deal.stageHistories[0];
  let daysInPreviousStage = 0;
  if (lastHistoryEntry) {
    const diffMs = Date.now() - new Date(lastHistoryEntry.changedAt).getTime();
    daysInPreviousStage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update deal to Lost
    const updated = await tx.deal.update({
      where: { id },
      data: {
        status: "Lost",
        probabilityPercent: 0,
        lostReasonRefId: lost_reason_id,
        lostReason: lossReason.name,
      },
    });

    // Insert stage history
    await tx.dealStageHistory.create({
      data: {
        dealId: id,
        fromStatus: deal.status,
        toStatus: "Lost",
        changedById: user.id,
        daysInPreviousStage,
        notes: notes || `Lost reason: ${lossReason.name}${competitor_id ? ` (Competitor won)` : ""}`,
      },
    });

    // Bulk-cancel open follow-ups for this opportunity's customer
    await tx.followUp.updateMany({
      where: {
        customerId: deal.customerId,
        status: { in: ["Pending", "Overdue"] },
        deletedAt: null,
      },
      data: {
        status: "Cancelled",
        notes: `Bulk cancelled: Opportunity marked as Lost`,
      },
    });

    return updated;
  });

  await logAudit(user.id, "Opportunity", "MarkLost", `Marked opportunity "${deal.dealName}" as Lost (Reason: ${lossReason.name})`, {
    resourceId: id,
    previousState: { stage: deal.status },
    newState: { stage: "Lost", lostReasonId: lost_reason_id },
    context: extractAuditContext(request),
    severity: "HIGH",
  });

  if (deal.assignedUserId && deal.assignedUserId !== user.id) {
    await dispatchNotification({
      userId: deal.assignedUserId,
      title: "Deal Lost",
      message: `Opportunity "${deal.dealName}" has been marked as Lost. Reason: ${lossReason.name}.`,
      type: "deal",
      link: `/sales-pipeline/${id}`,
    });
  }

  return NextResponse.json({ success: true, data: result, message: "Opportunity marked as Lost" });
}
