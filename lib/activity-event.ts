/**
 * Unified activity event logger.
 *
 * Writes a single ActivityEvent row inside the caller's transaction.
 * Used to build a cross-entity timeline for quotations, negotiations,
 * RFQs, purchase orders, and deals.
 */

import { Prisma } from "@prisma/client";

type PrismaTx = Omit<
  typeof import("@/lib/prisma")["prisma"],
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface LogEventParams {
  entityType: string;
  entityId: string;
  rootEntityId?: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  roundNumber?: number;
  actorId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an ActivityEvent. Must be called inside a Prisma transaction.
 */
export async function logEvent(
  tx: PrismaTx,
  params: LogEventParams
): Promise<void> {
  await tx.activityEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      rootEntityId: params.rootEntityId ?? null,
      type: params.type,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      roundNumber: params.roundNumber ?? null,
      actorId: params.actorId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

/**
 * Log an ActivityEvent outside of a transaction (standalone).
 */
export async function logEventAsync(
  params: LogEventParams
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.activityEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      rootEntityId: params.rootEntityId ?? null,
      type: params.type,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      roundNumber: params.roundNumber ?? null,
      actorId: params.actorId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
