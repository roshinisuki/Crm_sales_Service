import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { normalizeStage, PIPELINE_STAGE_ORDER, PIPELINE_STAGE_PROBABILITY, PIPELINE_STAGE_VALUES } from "@/lib/module-status-config";

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
  const { to_stage, notes, demoOutcome, rejectedReason, demoFollowUpDate, force } = body;

  if (!to_stage) {
    return NextResponse.json({ success: false, message: "to_stage is required" }, { status: 400 });
  }

  // Validate stage value against canonical pipeline stages (with normalization)
  const normalizedStage = normalizeStage(to_stage);
  if (!normalizedStage) {
    return NextResponse.json(
      { success: false, message: `Invalid stage "${to_stage}". Valid stages: ${PIPELINE_STAGE_VALUES.join(", ")}` },
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

  // Use normalized stage value for all downstream logic
  const targetStage = normalizedStage;

  // No-op if same stage — UNLESS setting demoOutcome on DemoConducted (edge case: deal moved to DemoConducted without outcome)
  if (currentStage === targetStage) {
    if (demoOutcome && targetStage === "DemoConducted") {
      const updated = await prisma.deal.update({
        where: { id },
        data: {
          ...(demoOutcome ? { demoOutcome } : {}),
          ...(demoOutcome === "Follow-up needed" && demoFollowUpDate ? { demoFollowUpDate: new Date(demoFollowUpDate) } : {}),
          ...(demoOutcome === "Rejected" && rejectedReason ? { rejectedReason } : {}),
        },
      });
      await prisma.dealStageHistory.create({
        data: {
          dealId: id,
          fromStatus: currentStage,
          toStatus: targetStage,
          changedById: user.id,
          outcomeNotes: `Demo outcome set: ${demoOutcome}${demoFollowUpDate ? ` — follow-up on ${demoFollowUpDate}` : ""}${rejectedReason ? ` — reason: ${rejectedReason}` : ""}`,
        },
      });
      // Auto-create RFQ when demoOutcome is Accepted
      if (demoOutcome === "Accepted") {
        const existingRfq = await prisma.rFQ.findFirst({ where: { opportunityId: deal.id } });
        if (!existingRfq) {
          const year = new Date().getFullYear();
          const rfqPrefix = `RFQ-${year}-`;
          const rfqCount = await prisma.rFQ.count({ where: { rfqCode: { startsWith: rfqPrefix } } });
          const rfqCode = `${rfqPrefix}${String(rfqCount + 1).padStart(5, "0")}`;
          await prisma.rFQ.create({
            data: {
              rfqCode,
              customerId: deal.customerId,
              opportunityId: deal.id,
              status: "New",
              receivedDate: new Date(),
              priority: "Normal",
              companyId: user.companyId,
            },
          });
        }
      }
      await logAudit(user.id, "Opportunity", "StageChange", `Demo outcome set: ${demoOutcome} for "${deal.dealName}"`, {
        resourceId: id,
        previousState: { demoOutcome: deal.demoOutcome },
        newState: { demoOutcome },
        context: extractAuditContext(request),
        severity: "WARN",
      });
      return NextResponse.json({ success: true, data: updated });
    }
    return NextResponse.json({ success: true, message: "Already at this stage", data: deal });
  }

  const currentOrder = PIPELINE_STAGE_ORDER[currentStage] ?? 0;
  const targetOrder  = PIPELINE_STAGE_ORDER[targetStage]   ?? 0;

  // Terminal stages (Rejected, Lost) have order 0 — they're not backward moves, they're terminal exits
  const isTerminalExit = (targetStage === "Rejected" || targetStage === "Lost");

  // If backward stage change (non-terminal), require Sales Manager or Admin
  if (targetOrder < currentOrder && !isTerminalExit && !force) {
    if (!["SalesManager", "Admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, message: "Stage rollback requires Manager approval" },
        { status: 403 }
      );
    }
  }

  // Forward stage change: only allow moving to the next stage in sequence (no skipping)
  // Terminal exits (Rejected, Lost) can happen from any stage
  // force=true bypasses this check (used by sample approval to jump to RequirementGathering)
  if (targetOrder > currentOrder && targetOrder !== currentOrder + 1 && !isTerminalExit && !force) {
    return NextResponse.json(
      { success: false, message: "You can only move to the next stage in sequence" },
      { status: 400 }
    );
  }

  // Validate demoOutcome when moving to DemoConducted
  if (targetStage === "DemoConducted" && !demoOutcome) {
    return NextResponse.json(
      { success: false, message: "demoOutcome (Accepted/Rejected/Follow-up needed) is required when moving to DemoConducted" },
      { status: 400 }
    );
  }
  if (demoOutcome && !["Accepted", "Rejected", "Follow-up needed"].includes(demoOutcome)) {
    return NextResponse.json(
      { success: false, message: "demoOutcome must be 'Accepted', 'Rejected', or 'Follow-up needed'" },
      { status: 400 }
    );
  }
  // V2: Follow-up needed requires a follow-up date
  if (demoOutcome === "Follow-up needed" && !demoFollowUpDate) {
    return NextResponse.json(
      { success: false, message: "demoFollowUpDate is required when demoOutcome is 'Follow-up needed'" },
      { status: 400 }
    );
  }

  // Validate rejectedReason when moving to Rejected
  if (targetStage === "Rejected" && !rejectedReason) {
    return NextResponse.json(
      { success: false, message: "rejectedReason is required when moving to Rejected" },
      { status: 400 }
    );
  }

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
    // V2: Require tech discussion confirmed checkbox
    if (!(d as any).techDiscussionConfirmed) {
      return NextResponse.json(
        { success: false, message: "Cannot move forward. Please confirm technical discussion in Part B." },
        { status: 400 }
      );
    }
  }

  // MeetingScheduled → next stage: server-side validate meeting details (P3 fix)
  if (currentStage === "MeetingScheduled") {
    const d = deal.opportunityDetail || {};
    const meetingMandatory = [
      { key: "meetingDate", label: "Meeting Date" },
      { key: "meetingType", label: "Meeting/Demo Type" },
      { key: "meetingStatus", label: "Outcome / Status" },
    ];
    const missing = meetingMandatory.filter((f) => {
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

  const newProbability = PIPELINE_STAGE_PROBABILITY[targetStage] ?? deal.probabilityPercent;

  const result = await prisma.$transaction(async (tx) => {
    // Update deal stage, probability, and stage entry timestamp
    const updated = await tx.deal.update({
      where: { id },
      data: {
        status: targetStage,
        probabilityPercent: newProbability,
        stageEnteredAt: new Date(),
        // Set demoOutcome when entering DemoConducted
        ...(targetStage === "DemoConducted" && demoOutcome ? { demoOutcome } : {}),
        // V2: Save demoFollowUpDate when Follow-up needed
        ...(targetStage === "DemoConducted" && demoOutcome === "Follow-up needed" && demoFollowUpDate ? { demoFollowUpDate: new Date(demoFollowUpDate) } : {}),
        // Set rejectedReason when entering Rejected
        ...(targetStage === "Rejected" && rejectedReason ? { rejectedReason } : {}),
      },
    });

    // Insert stage history
    await tx.dealStageHistory.create({
      data: {
        dealId: id,
        fromStatus: currentStage,
        toStatus: targetStage,
        changedById: user.id,
        durationInPreviousStage: daysInPreviousStage,
        outcomeNotes: notes || (demoOutcome ? `Demo ${demoOutcome}${demoFollowUpDate ? ` — follow-up on ${demoFollowUpDate}` : ""}` : null) || (rejectedReason ? `Rejected: ${rejectedReason}` : null) || null,
      },
    });

    // Customer status sync on Won is handled by Deals module, not Sales Pipeline
    // Won is a Deals module status — pipeline exits at DemoConducted (Accepted → RFQ) or Rejected/Lost

    // Auto-create stage-appropriate follow-up
    const stageFollowUpMap: Record<string, string> = {
      MeetingScheduled: "Confirm attendee list and demo feedback",
      RequirementGathering: "Schedule discovery call",
      DemoConducted: "Follow up on demo outcome and next steps",
      Rejected: "Internal review: understand rejection reasons and lessons learned",
      Lost: "Internal review: analyze loss reasons and improvement areas",
    };

    const followUpTitle = stageFollowUpMap[targetStage];
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

    // Auto-create RFQ when DemoConducted with Accepted outcome
    if (targetStage === "DemoConducted" && demoOutcome === "Accepted") {
      const existingRfq = await tx.rFQ.findFirst({
        where: { opportunityId: deal.id },
      });
      if (!existingRfq) {
        const year = new Date().getFullYear();
        const rfqPrefix = `RFQ-${year}-`;
        const rfqCount = await tx.rFQ.count({
          where: { rfqCode: { startsWith: rfqPrefix } },
        });
        const rfqCode = `${rfqPrefix}${String(rfqCount + 1).padStart(5, "0")}`;
        await tx.rFQ.create({
          data: {
            rfqCode,
            customerId: deal.customerId,
            opportunityId: deal.id,
            status: "New",
            receivedDate: new Date(),
            priority: "Normal",
            companyId: user.companyId,
          },
        });
      }
    }

    return updated;
  });

  // Audit log
  await logAudit(
    user.id,
    "Opportunity",
    "StageChange",
    `Opportunity "${deal.dealName}" stage: ${currentStage} → ${targetStage}${demoOutcome ? ` (Demo ${demoOutcome})` : ""}${rejectedReason ? ` (Reason: ${rejectedReason})` : ""}${notes ? `. Notes: ${notes}` : ""}`,
    {
      resourceId: id,
      previousState: { stage: currentStage, probabilityPercent: deal.probabilityPercent },
      newState: { stage: targetStage, probabilityPercent: newProbability },
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
      message: `Your opportunity "${deal.dealName}" moved from ${currentStage} to ${targetStage}.`,
      type: "deal",
      link: `/sales-pipeline/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    message: `Stage changed from ${currentStage} to ${targetStage}`,
  });
}
