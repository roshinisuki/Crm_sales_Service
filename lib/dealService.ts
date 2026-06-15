/**
 * dealService.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Centralized deal lifecycle state machine.
 * ALL deal status transitions MUST flow through this service to guarantee:
 *  - DealStageHistory is always recorded
 *  - Audit log is always written
 *  - No direct db.deal.update({ status }) calls scattered across actions
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { DealStatus } from "@prisma/client";

type TransitionContext = {
  /** ID of the user performing the transition (or "system" for cron jobs) */
  actorId: string;
  /** Optional human-readable reason / note to attach to the audit log */
  reason?: string;
};

/**
 * Transition a deal from its current status to a new status.
 * Records a DealStageHistory entry and writes an audit log.
 *
 * Must be called inside OR outside a Prisma transaction ($transaction).
 * Pass a transaction client (`tx`) when called inside $transaction.
 */
export async function transitionDealStatus(
  dealId: string,
  toStatus: DealStatus,
  ctx: TransitionContext,
  tx?: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<void> {
  const db = (tx ?? prisma) as typeof prisma;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { status: true, dealName: true },
  });

  if (!deal) throw new Error(`Deal ${dealId} not found in transitionDealStatus`);

  const fromStatus = deal.status;

  // No-op if already at target status
  if (fromStatus === toStatus) return;

  await db.deal.update({
    where: { id: dealId },
    data: { status: toStatus },
  });

  await db.dealStageHistory.create({
    data: {
      dealId,
      fromStatus: fromStatus as string,
      toStatus: toStatus as string,
      changedById: ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId,
    },
  });

  await logAudit(
    ctx.actorId,
    "Deal",
    "StatusTransition",
    `Deal "${deal.dealName}" transitioned: ${fromStatus} → ${toStatus}${ctx.reason ? `. Reason: ${ctx.reason}` : ""}`
  );
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
