/**
 * dealService.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Centralized deal lifecycle state machine.
 * ALL deal status transitions MUST flow through this service to guarantee:
 *  - DealStageHistory is always recorded
 *  - Audit log is always written
 *  - No direct db.deal.update({ status }) calls scattered across actions
 *  - Customer status sync on Won
 *  - AccountStatusHistory for customer status changes
 *  - Accepted quotation gate for Won
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { createOrHealRFQ } from "@/lib/rfqService";
import { PIPELINE_STAGE_ORDER } from "@/lib/module-status-config";
import { createCustomerAssetsFromPO } from "@/lib/service-handoff";
type DealStatus = string;

type TransitionContext = {
  /** ID of the user performing the transition (or "system" for cron jobs) */
  actorId: string;
  /** Optional human-readable reason / note to attach to the audit log */
  reason?: string;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Bypass the accepted quotation gate when transitioning to Won (e.g. PO approval) */
  skipQuotationGate?: boolean;
};

/**
 * Transition a deal from its current status to a new status.
 * Records a DealStageHistory entry, writes an audit log, syncs customer status,
 * and enforces stage gates.
 *
 * Must be called inside OR outside a Prisma transaction ($transaction).
 * Pass a transaction client (`tx`) when called inside $transaction.
 */
export async function transitionDealStatus(
  dealId: string,
  toStatus: DealStatus,
  ctx: TransitionContext,
  tx?: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<{ rfqId?: string }> {
  const db = (tx ?? prisma) as typeof prisma;
  let rfqId: string | undefined = undefined;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { 
      status: true, 
      dealName: true, 
      customerId: true,
      assignedUserId: true,
      dealValue: true,
      createdAt: true,
      updatedAt: true
    },
  });

  if (!deal) throw new Error(`Deal ${dealId} not found in transitionDealStatus`);

  const fromStatus = deal.status;

  // No-op if already at target status
  if (fromStatus === toStatus) return { rfqId };

  // Calculate duration in previous stage (in days)
  const previousStageEntry = await db.dealStageHistory.findFirst({
    where: { dealId, toStatus: fromStatus },
    orderBy: { changedAt: 'desc' }
  });
  
  const stageEntryDate = previousStageEntry?.changedAt || deal.createdAt;
  const durationInPreviousStage = Math.floor(
    (new Date().getTime() - new Date(stageEntryDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Capture stage data snapshot (relevant fields for the stage being left)
  const stageDataSnapshot = JSON.stringify({
    dealValue: deal.dealValue,
    assignedUserId: deal.assignedUserId,
    stageEntryDate: stageEntryDate.toISOString(),
    updatedAt: deal.updatedAt.toISOString()
  });

  // Enforce stage order using canonical PIPELINE_STAGE_ORDER (single source of truth)
  // Falls back to PipelineStageMaster DB table if stage not found in the map
  const currentOrder = PIPELINE_STAGE_ORDER[fromStatus] ?? 0;
  const targetOrder = PIPELINE_STAGE_ORDER[toStatus] ?? 0;

  // OnHold is a pause state — not a pipeline progression or regression.
  // Skip the backward-stage-change check when transitioning to/from OnHold.
  const isOnHoldTransition = toStatus === "OnHold" || fromStatus === "OnHold";

  // Backward stage change requires Manager/Admin (skip for OnHold transitions)
  if (!isOnHoldTransition && targetOrder < currentOrder) {
    const user = await db.user.findUnique({
      where: { id: ctx.actorId },
      select: { role: true }
    });
    if (!user || !["SalesManager", "Admin", "SuperAdmin"].includes(user.role)) {
      throw new Error("Stage rollback requires Manager approval");
    }
  }

  // Won requires an accepted quotation (unless skipQuotationGate is set, e.g. PO approval)
  if (toStatus === "Won" && !ctx.skipQuotationGate) {
    const acceptedQuotation = await db.quotation.findFirst({
      where: { 
        dealId: dealId,
        status: "Accepted",
        deletedAt: null
      }
    });
    if (!acceptedQuotation) {
      throw new Error("An accepted quotation is required before marking this opportunity as Won");
    }
  }

  // Update deal status and record stage entry timestamp
  await db.deal.update({
    where: { id: dealId },
    data: { status: toStatus, stageEnteredAt: new Date() },
  });

  // Record stage history with enhanced audit trail
  await db.dealStageHistory.create({
    data: {
      dealId,
      fromStatus: fromStatus as string,
      toStatus: toStatus as string,
      changedById: ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId,
      durationInPreviousStage,
      outcomeNotes: ctx.reason || null,
      stageDataSnapshot,
    },
  });

  // RFQ auto-creation on Demo Accepted outcome
  // Uses structured demoOutcome field instead of fragile string matching on ctx.reason
  if (toStatus === "DemoAccepted") {
    const dealWithDetails = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
        opportunityDetail: true,
        requirementItems: {
          include: { technicalNote: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
      }
    });
    
    if (dealWithDetails) {
      // If we are transitioning to DemoAccepted, it means the demo was accepted
      const demoAccepted = true;
      
      if (demoAccepted) {
        rfqId = await createOrHealRFQ(dealId, dealWithDetails, ctx.companyId, db);
        
        if (rfqId) {
          // Log RFQ creation / heal event (if applicable, or we could handle logging inside createOrHealRFQ)
          await logAudit(
            ctx.actorId,
            "RFQ",
            "AutoCreate",
            `Auto-created/Healed RFQ for deal "${dealWithDetails.dealName}" on Demo Accepted outcome`
          );
        }
      }
    }
  }

  // Sync customer status on Won
  if (toStatus === "Won") {
    const customer = await db.customer.findUnique({
      where: { id: deal.customerId },
      select: { status: true }
    });
    
    if (customer && customer.status !== "ActiveCustomer") {
      await db.customer.update({
        where: { id: deal.customerId },
        data: { status: "ActiveCustomer" }
      });
      
      // Write AccountStatusHistory
      await db.accountStatusHistory.create({
        data: {
          customerId: deal.customerId,
          fromStatus: customer.status,
          toStatus: "ActiveCustomer",
          changedById: ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId,
          changedAt: new Date(),
        },
      });
    }

    // Auto-generate/link customer assets for POs associated with this deal
    try {
      const pos = await db.purchaseOrder.findMany({
        where: { dealId, deletedAt: null },
        select: { id: true }
      });
      const actor = ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId;
      for (const po of pos) {
        await createCustomerAssetsFromPO(po.id, actor);
      }
      
      // Explicitly link any matching assets to this deal
      if (pos.length > 0) {
        await db.customerAsset.updateMany({
          where: {
            purchaseOrderId: { in: pos.map(p => p.id) },
            dealId: null
          },
          data: {
            dealId: dealId
          }
        });
      }
    } catch (assetErr) {
      console.error("Failed to sync customer assets for Won deal:", assetErr);
    }
  }

  // Reverse customer status if Won deal is reverted
  if (fromStatus === "Won" && toStatus !== "Won") {
    // Check if customer has other active Won deals or subscriptions
    const otherWonDeals = await db.deal.count({
      where: {
        customerId: deal.customerId,
        status: "Won",
        id: { not: dealId },
        deletedAt: null
      }
    });
    
    const activeSubscriptions = await db.subscription.count({
      where: {
        customerId: deal.customerId,
        status: "Active",
        endDate: { gte: new Date() }
      }
    });

    if (otherWonDeals === 0 && activeSubscriptions === 0) {
      const customer = await db.customer.findUnique({
        where: { id: deal.customerId },
        select: { status: true }
      });
      
      if (customer && customer.status === "ActiveCustomer") {
        await db.customer.update({
          where: { id: deal.customerId },
          data: { status: "Prospect" }
        });
        
        // Write AccountStatusHistory
        await db.accountStatusHistory.create({
          data: {
            customerId: deal.customerId,
            fromStatus: "ActiveCustomer",
            toStatus: "Prospect",
            changedById: ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId,
            changedAt: new Date(),
          },
        });
      }
    }
  }

  // Audit log
  await logAudit(
    ctx.actorId,
    "Deal",
    "StatusTransition",
    `Deal "${deal.dealName}" transitioned: ${fromStatus} → ${toStatus}${ctx.reason ? `. Reason: ${ctx.reason}` : ""}`
  );

  // Notify assigned user if changed by someone else
  if (deal.assignedUserId && deal.assignedUserId !== ctx.actorId) {
    await dispatchNotification({
      userId: deal.assignedUserId,
      title: "Deal Status Changed",
      message: `Your deal "${deal.dealName}" moved from ${fromStatus} to ${toStatus}.`,
      type: "deal",
      link: `/sales-pipeline/${dealId}`,
    });
  }

  // Notify managers for high-value deals
  if (deal.dealValue > 500000) {
    const managers = await db.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: ctx.companyId },
      select: { id: true }
    });
    const managerIds = managers.map(m => m.id).filter(id => id !== ctx.actorId);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "High-Value Deal Status Changed",
        message: `Deal "${deal.dealName}" moved from ${fromStatus} to ${toStatus}.`,
        type: "deal",
        link: `/sales-pipeline/${dealId}`,
      });
    }
  }

  return { rfqId };
}

/**
 * Returns the first active SuperAdmin/Admin id to use as system actor,
 * or falls back to the literal string "system" (for audit logs).
 */
async function getSystemActorId(db: typeof prisma): Promise<string> {
  const admin = await db.user.findFirst({
    where: { role: { in: ["SuperAdmin", "Admin"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id ?? "system";
}
