import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

// POST /api/opportunities/[id]/stage-change
// Body: { to_stage, notes }
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
  const { to_stage, notes } = body;

  if (!to_stage) {
    return NextResponse.json({ success: false, message: "to_stage is required" }, { status: 400 });
  }

  // Validate stage value against allowed pipeline stages
  const VALID_STAGES = ["SalesOpportunity", "RequirementGathering", "MeetingScheduled", "ProposalSent", "Negotiation", "Won", "Lost"];
  if (!VALID_STAGES.includes(to_stage)) {
    return NextResponse.json(
      { success: false, message: `Invalid stage "${to_stage}". Valid stages: ${VALID_STAGES.join(", ")}` },
      { status: 400 }
    );
  }

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      stageHistories: { orderBy: { changedAt: "desc" }, take: 1 },
      opportunityDetail: true,
      quotations: { where: { status: "Accepted" }, take: 1 },
    },
  });

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  // Row-level scope check
  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const currentStage = deal.status;

  // No-op if same stage
  if (currentStage === to_stage) {
    return NextResponse.json({ success: true, message: "Already at this stage", data: deal });
  }

  // Stage order and default probabilities — defined inline (no PipelineStageMaster table needed)
  const STAGE_ORDER: Record<string, number> = {
    SalesOpportunity:    1,
    RequirementGathering: 2,
    MeetingScheduled:    3,
    ProposalSent:        4,
    Negotiation:         5,
    Won:                 6,
    Lost:                0,
  };
  const STAGE_PROBABILITY: Record<string, number> = {
    SalesOpportunity:    20,
    RequirementGathering: 30,
    MeetingScheduled:    50,
    ProposalSent:        70,
    Negotiation:         85,
    Won:                100,
    Lost:                  0,
  };

  const currentOrder = STAGE_ORDER[currentStage] ?? 0;
  const targetOrder  = STAGE_ORDER[to_stage]     ?? 0;

  // If backward stage change, require Sales Manager or Admin
  if (targetOrder < currentOrder) {
    if (!["SalesManager", "Admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, message: "Stage rollback requires Manager approval" },
        { status: 403 }
      );
    }
  }

  // Forward stage change: only allow moving to the next stage in sequence (no skipping),
  // except for jumping to Won when an accepted quotation exists, which bypasses Negotiation.
  const acceptedQuotation = deal.quotations[0];
  const isJumpToWon = to_stage === "Won" && acceptedQuotation;
  if (targetOrder > currentOrder && targetOrder !== currentOrder + 1 && !isJumpToWon) {
    return NextResponse.json(
      { success: false, message: "You can only move to the next stage in sequence" },
      { status: 400 }
    );
  }

  // Won gate is now enforced in the central transitionDealStatus function
  // Duplicate check removed here to avoid inconsistency

  // Requirement Gathering → next stage: server-side re-validate mandatory fields
  if (currentStage === "RequirementGathering") {
    const d = deal.opportunityDetail || {};
    const mandatoryFields = [
      { key: "contactPerson", label: "Contact Person" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "currentChallenges", label: "Current Challenges" },
      { key: "businessNeed", label: "Business Need" },
      { key: "urgencyPriority", label: "Urgency / Priority" },
      { key: "deploymentType", label: "Deployment Type" },
      { key: "budgetRange", label: "Budget Range" },
      { key: "expectedBudget", label: "Expected Budget" },
      { key: "decisionMaker", label: "Decision Maker" },
    ];
    const missing = mandatoryFields.filter((f) => {
      const val = (d as any)[f.key];
      return val === null || val === undefined || (typeof val === "string" && val.trim() === "");
    });
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot move forward. Please fill: ${missing.map((m) => m.label).join(", ")}.` },
        { status: 400 }
      );
    }
  }

  // Calculate days_in_previous_stage
  const lastHistoryEntry = deal.stageHistories[0];
  let daysInPreviousStage = 0;
  if (lastHistoryEntry) {
    const diffMs = Date.now() - new Date(lastHistoryEntry.changedAt).getTime();
    daysInPreviousStage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const newProbability = STAGE_PROBABILITY[to_stage] ?? deal.probabilityPercent;

  const result = await prisma.$transaction(async (tx) => {
    // Update deal stage and probability
    const updated = await tx.deal.update({
      where: { id },
      data: {
        status: to_stage,
        probabilityPercent: newProbability,
      },
    });

    // Insert stage history
    await tx.dealStageHistory.create({
      data: {
        dealId: id,
        fromStatus: currentStage,
        toStatus: to_stage,
        changedById: user.id,
        daysInPreviousStage,
        notes: notes || null,
      },
    });

    // Sync customer status to ActiveCustomer when deal is Won
    if (to_stage === "Won") {
      const customer = await tx.customer.findUnique({
        where: { id: deal.customerId },
        select: { status: true }
      });
      
      if (customer && customer.status !== "ActiveCustomer") {
        await tx.customer.update({
          where: { id: deal.customerId },
          data: { status: "ActiveCustomer" }
        });
        
        // Write AccountStatusHistory
        await tx.accountStatusHistory.create({
          data: {
            customerId: deal.customerId,
            fromStatus: customer.status,
            toStatus: "ActiveCustomer",
            changedById: user.id,
            changedAt: new Date(),
          },
        });
      }
    }

    // Auto-create stage-appropriate follow-up
    const stageFollowUpMap: Record<string, string> = {
      MeetingScheduled: "Confirm attendee list and demo feedback",
      RequirementGathering: "Schedule discovery call",
      ProposalSent: "Follow up on proposal delivery",
      Negotiation: "Prepare negotiation terms sheet",
    };

    const followUpTitle = stageFollowUpMap[to_stage];
    if (followUpTitle) {
      const followUpDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      await tx.followUp.create({
        data: {
          customerId: deal.customerId,
          assignedUserId: deal.assignedUserId || user.id,
          nextMeetingDate: followUpDate,
          dueDate: followUpDate,
          remarks: followUpTitle,
          status: "Pending",
          priority: "High",
          sourceType: "STAGE_CHANGE",
          sourceId: deal.id,
          autoCreated: true,
          companyId: user.companyId,
        },
      });
    }

    return updated;
  });

  // Audit log
  await logAudit(
    user.id,
    "Opportunity",
    "StageChange",
    `Opportunity "${deal.dealName}" stage: ${currentStage} → ${to_stage}${notes ? `. Notes: ${notes}` : ""}`,
    {
      resourceId: id,
      previousState: { stage: currentStage, probabilityPercent: deal.probabilityPercent },
      newState: { stage: to_stage, probabilityPercent: newProbability },
      context: extractAuditContext(request),
      severity: targetOrder < currentOrder ? "HIGH" : "WARN",
    }
  );

  // High-value stale deal notification: estimated_value > 500000 AND same stage > 14 days
  if (deal.dealValue > 500000 && daysInPreviousStage > 14) {
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: user.companyId },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "High-value deal stale",
        message: `High-value deal stale: ${deal.dealName} (${deal.opportunityCode}) — was in ${currentStage} for ${daysInPreviousStage} days`,
        type: "deal",
        link: `/sales-pipeline/${id}`,
      });
    }
  }

  // Notify assigned user if changed by someone else
  if (deal.assignedUserId && deal.assignedUserId !== user.id) {
    await dispatchNotification({
      userId: deal.assignedUserId,
      title: "Opportunity Stage Changed",
      message: `Your opportunity "${deal.dealName}" moved from ${currentStage} to ${to_stage}.`,
      type: "deal",
      link: `/sales-pipeline/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    message: `Stage changed from ${currentStage} to ${to_stage}`,
  });
}
