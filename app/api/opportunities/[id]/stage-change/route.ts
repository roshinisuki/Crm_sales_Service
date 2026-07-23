import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { createOrHealRFQ } from "@/lib/rfqService";
import { normalizeStage, PIPELINE_STAGE_ORDER, PIPELINE_STAGE_VALUES } from "@/lib/module-status-config";
import { transitionDealStatus } from "@/lib/dealService";
import { validateNotInPast } from "@/lib/date-validation";


// POST /api/opportunities/[id]/stage-change
// Body: { to_stage, notes?, demoOutcome?, demoFollowUpDate?, rejectedReason?, force? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { to_stage, notes, demoOutcome, rejectedReason, demoFollowUpDate, force } = body;

  if (demoFollowUpDate !== undefined && demoFollowUpDate !== null && demoFollowUpDate !== "") {
    const validationError = validateNotInPast(demoFollowUpDate, "Follow-up date");
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }
  }

  if (!to_stage) {
    return NextResponse.json({ success: false, message: "to_stage is required" }, { status: 400 });
  }

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
      requirementItems: {
        include: { technicalNote: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const currentStage = deal.status;
  const targetStage = normalizedStage;

  // No-op if same stage — UNLESS setting demoOutcome on DemoAccepted or DemoConducted
  if (currentStage === targetStage) {
    if (demoOutcome && (targetStage === "DemoAccepted" || targetStage === "DemoConducted")) {
      const updated = await prisma.deal.update({
        where: { id },
        data: {
          ...(demoOutcome ? { demoOutcome } : {}),
          ...(demoOutcome === "Follow-up needed" && demoFollowUpDate ? { demoFollowUpDate: new Date(demoFollowUpDate) } : {}),
          ...(demoOutcome === "Rejected" && rejectedReason ? { rejectedReason } : {}),
        },
      });
      // For DemoConducted: update meeting log and create follow-up if needed
      if (targetStage === "DemoConducted") {
        const activeLog = await prisma.meetingLog.findFirst({
          where: { dealId: id },
          orderBy: { attemptNumber: "desc" },
        });
        if (activeLog) {
          await prisma.meetingLog.update({
            where: { id: activeLog.id },
            data: {
              outcome: demoOutcome,
              notes: notes || undefined,
              rejectionReason: rejectedReason || undefined,
            },
          });
          if (demoOutcome === "Follow-up needed") {
            await prisma.meetingLog.create({
              data: {
                dealId: id,
                attemptNumber: activeLog.attemptNumber + 1,
                meetingDate: demoFollowUpDate ? new Date(demoFollowUpDate) : null,
                meetingType: activeLog.meetingType,
                meetingMode: activeLog.meetingMode,
                participants: activeLog.participants,
                agenda: `Follow-up discussion. Previous notes: ${notes || ""}`.trim(),
              },
            });
          }
        }
      }
      // Auto-create RFQ with line items when demoOutcome is Accepted (DemoAccepted only)
      if (demoOutcome === "Accepted" && targetStage === "DemoAccepted") {
        await prisma.$transaction(async (tx) => {
          const latestDeal = await tx.deal.findUnique({
            where: { id },
            include: { requirementItems: { include: { technicalNote: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] } }
          });
          if (latestDeal && user.companyId) {
            await createOrHealRFQ(id, latestDeal, user.companyId, tx);
          }
        });
      }
      return NextResponse.json({ success: true, data: updated });
    }
    return NextResponse.json({ success: true, message: "Already at this stage", data: deal });
  }

  // Read stage order from PipelineStageMaster when available, fallback to hardcoded constants
  const stageMasters = await prisma.pipelineStageMaster.findMany({
    where: { companyId: user.companyId, isActive: true },
    select: { stageName: true, displayOrder: true, probabilityPercent: true },
  });
  const masterOrderMap: Record<string, number> = {};
  const masterProbMap: Record<string, number> = {};
  stageMasters.forEach((s) => {
    masterOrderMap[s.stageName] = s.displayOrder;
    masterProbMap[s.stageName] = s.probabilityPercent;
  });

  const currentOrder = masterOrderMap[currentStage] ?? PIPELINE_STAGE_ORDER[currentStage] ?? 0;
  const targetOrder  = masterOrderMap[targetStage]  ?? PIPELINE_STAGE_ORDER[targetStage]  ?? 0;

  const isTerminalExit = targetStage === "Rejected" || targetStage === "Lost";

  // Backward stage change requires Manager/Admin
  // Exception: DemoConducted → MeetingScheduled is a legitimate reschedule, allowed for all sales roles
  const isReschedule = currentStage === "DemoConducted" && targetStage === "MeetingScheduled";
  if (targetOrder < currentOrder && !isTerminalExit && !force && !isReschedule) {
    if (!["SalesManager", "Admin"].includes(user.role)) {
      return NextResponse.json({ success: false, message: "Stage rollback requires Manager approval" }, { status: 403 });
    }
  }

  // Forward: only allow moving one step at a time (no skipping), unless force=true or terminal exit
  if (targetOrder > currentOrder && targetOrder !== currentOrder + 1 && !isTerminalExit && !force) {
    return NextResponse.json(
      { success: false, message: "You can only move to the next stage in sequence" },
      { status: 400 }
    );
  }

  // ─── Stage Gate: Requirement Gathering → Technical Discussion ───────────────
  // Must have at least one product requirement item logged.
  if (currentStage === "RequirementGathering" && targetStage === "TechnicalDiscussion") {
    const d = deal.opportunityDetail || {};
    const mandatoryFields = [
      { key: "contactPerson", label: "Contact person" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "currentChallenges", label: "Current challenges" },
      { key: "businessNeed", label: "Business need" },
      { key: "urgencyPriority", label: "Urgency / priority" },
      { key: "expectedBudget", label: "Expected budget" },
      { key: "decisionMaker", label: "Decision maker" },
    ];
    const missing = mandatoryFields.filter((f) => {
      const val = (d as any)[f.key];
      return val === null || val === undefined || (typeof val === "string" && val.trim() === "");
    });
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot advance. Please fill: ${missing.map((m) => m.label).join(", ")}.` },
        { status: 400 }
      );
    }

    if (!deal.requirementItems || deal.requirementItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cannot advance. At least one product requirement must be added before proceeding to Technical Discussion." },
        { status: 400 }
      );
    }
  }

  // ─── Stage Gate: Technical Discussion → Meeting Scheduled ───────────────────
  // Every product row must have a feasibility note set to Feasible or FeasibleWithChanges.
  if (currentStage === "TechnicalDiscussion" && targetStage === "MeetingScheduled") {
    const items = deal.requirementItems || [];
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cannot advance. No product requirements found — please go back to Requirement Gathering." },
        { status: 400 }
      );
    }

    const missingFeasibility = items.filter(
      (item) => !item.technicalNote || !item.technicalNote.feasibility
    );
    if (missingFeasibility.length > 0) {
      const names = missingFeasibility.map((i) => i.productName).join(", ");
      return NextResponse.json(
        { success: false, message: `Cannot advance. Feasibility review pending for: ${names}.` },
        { status: 400 }
      );
    }

    const notFeasible = items.filter((item) => item.technicalNote?.feasibility === "NotFeasible");
    if (notFeasible.length > 0 && !force) {
      const names = notFeasible.map((i) => i.productName).join(", ");
      return NextResponse.json(
        {
          success: false,
          message: `Cannot advance. The following products are marked Not Feasible: ${names}. Remove or revise them, or use force=true to override (Manager/Admin only).`,
          notFeasibleItems: notFeasible.map((i) => ({ id: i.id, productName: i.productName })),
        },
        { status: 400 }
      );
    }
  }

  // ─── Stage Gate: Meeting Scheduled → Demo Conducted ─────────────────────────
  if (currentStage === "MeetingScheduled" && targetStage === "DemoConducted") {
    // Ensure there is a pending MeetingLog with a date
    const pendingLog = await prisma.meetingLog.findFirst({
      where: { dealId: id, conductedAt: null },
      orderBy: { attemptNumber: "desc" },
    });
    if (!pendingLog || !pendingLog.meetingDate) {
      return NextResponse.json(
        { success: false, message: "Cannot advance. Please schedule a meeting date first." },
        { status: 400 }
      );
    }
  }

  // ─── Validate demoOutcome (When leaving DemoConducted) ──────────────────────
  // Exception: reschedule back to MeetingScheduled doesn't require an outcome
  if (currentStage === "DemoConducted" && targetStage !== "MeetingScheduled") {
    if (!demoOutcome) {
      return NextResponse.json(
        { success: false, message: "demoOutcome (Accepted/Rejected/Follow-up needed) is required to complete Demo Conducted" },
        { status: 400 }
      );
    }
    if (!["Accepted", "Rejected", "Follow-up needed"].includes(demoOutcome)) {
      return NextResponse.json(
        { success: false, message: "demoOutcome must be 'Accepted', 'Rejected', or 'Follow-up needed'" },
        { status: 400 }
      );
    }
  }

  // ─── Validate rejectedReason ─────────────────────────────────────────────────
  if (targetStage === "Rejected" && !rejectedReason) {
    return NextResponse.json(
      { success: false, message: "rejectedReason is required when moving to Rejected" },
      { status: 400 }
    );
  }

  // Calculate days in previous stage
  const lastHistoryEntry = deal.stageHistories[0];
  let daysInPreviousStage = 0;
  if (lastHistoryEntry) {
    const diffMs = Date.now() - new Date(lastHistoryEntry.changedAt).getTime();
    daysInPreviousStage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Read probability from PipelineStageMaster, fallback to hardcoded map
  const newProbability = masterProbMap[targetStage] ?? deal.probabilityPercent;

  let rfqId: string | undefined = undefined;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update deal fields first
    await tx.deal.update({
      where: { id },
      data: {
        probabilityPercent: newProbability,
        ...(targetStage === "Rejected" && rejectedReason ? { rejectedReason } : {}),
      },
    });

    // 1b. Update MeetingLog state based on transition
    if (currentStage === "MeetingScheduled" && targetStage === "DemoConducted") {
      // Mark the meeting as conducted
      const pendingLog = await tx.meetingLog.findFirst({
        where: { dealId: id, conductedAt: null },
        orderBy: { attemptNumber: "desc" },
      });
      if (pendingLog) {
        await tx.meetingLog.update({
          where: { id: pendingLog.id },
          data: { conductedAt: new Date() },
        });
      }
    } else if (currentStage === "DemoConducted" && targetStage === "MeetingScheduled") {
      const activeLog = await tx.meetingLog.findFirst({
        where: { dealId: id },
        orderBy: { attemptNumber: "desc" },
      });
      if (activeLog) {
        await tx.meetingLog.update({
          where: { id: activeLog.id },
          data: {
            conductedAt: null,
            outcome: null,
            notes: notes || null,
            meetingDate: demoFollowUpDate ? new Date(demoFollowUpDate) : activeLog.meetingDate,
          },
        });
      }
    } else if (currentStage === "DemoConducted" && demoOutcome) {
      // Record the outcome on the active meeting log
      const activeLog = await tx.meetingLog.findFirst({
        where: { dealId: id },
        orderBy: { attemptNumber: "desc" },
      });
      if (activeLog) {
        await tx.meetingLog.update({
          where: { id: activeLog.id },
          data: {
            outcome: demoOutcome,
            notes: notes || undefined,
            rejectionReason: rejectedReason || undefined,
          },
        });

        if (demoOutcome === "Follow-up needed") {
          const attemptNumber = activeLog.attemptNumber + 1;
          await tx.meetingLog.create({
            data: {
              dealId: id,
              attemptNumber,
              meetingDate: demoFollowUpDate ? new Date(demoFollowUpDate) : null,
              meetingType: activeLog.meetingType,
              meetingMode: activeLog.meetingMode,
              participants: activeLog.participants,
              agenda: `Follow-up discussion. Previous notes: ${notes || ""}`.trim(),
            },
          });
        }
      }
    }    // 2. Perform the transition central state machine
    const transitionRes = await transitionDealStatus(
      id,
      targetStage,
      {
        actorId: user.id,
        companyId: user.companyId!,
        reason: notes ||
          (demoOutcome ? `Demo ${demoOutcome}${demoFollowUpDate ? ` — follow-up on ${demoFollowUpDate}` : ""}` : null) ||
          (rejectedReason ? `Rejected: ${rejectedReason}` : null) ||
          undefined,
      },
      tx
    );
    rfqId = transitionRes?.rfqId;

    // 3. Auto-create stage-appropriate follow-up
    const stageFollowUpMap: Record<string, string> = {
      TechnicalDiscussion: "Schedule technical discussion with engineering team",
      MeetingScheduled: "Confirm attendee list and meeting agenda",
      RequirementGathering: "Schedule discovery call",
      DemoConducted: "Follow up on demo outcome and next steps",
      DemoAccepted: "Create and review RFQ",
      Rejected: "Internal review: understand rejection reasons and lessons learned",
      Lost: "Internal review: analyse loss reasons and improvement areas",
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
          stageAtCreation: "Deal",
        },
      });
    }

    return tx.deal.findUnique({
      where: { id },
      include: { rfqs: true },
    });
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

  // High-value stale deal notification
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
      title: "Opportunity stage changed",
      message: `Your opportunity "${deal.dealName}" moved from ${currentStage} to ${targetStage}.`,
      type: "deal",
      link: `/sales-pipeline/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    rfqId,
    message: `Stage changed from ${currentStage} to ${targetStage}`,
  });
}


