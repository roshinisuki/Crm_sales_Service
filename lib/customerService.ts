/**
 * customerService.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Centralized customer status state machine.
 * ALL customer status transitions MUST flow through this service to guarantee:
 *  - AccountStatusHistory is always recorded
 *  - Status transitions are validated
 *  - Prospect → ActiveCustomer only via Won deal, approved subscription/PO, or admin override
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type CustomerStatus = "Prospect" | "ActiveCustomer" | "Renewed" | "Churned" | "Inactive";

type SetCustomerStatusContext = {
  /** ID of the user performing the transition (or "system" for cron jobs) */
  actorId: string;
  /** Optional human-readable reason / note to attach to the audit log */
  reason?: string;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Whether this is an admin override (bypasses normal validation) */
  isAdminOverride?: boolean;
};

/**
 * Allowed customer status transitions
 */
const ALLOWED_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
  Prospect: ["ActiveCustomer", "Churned", "Inactive"],
  ActiveCustomer: ["Renewed", "Churned", "Inactive"],
  Renewed: ["ActiveCustomer", "Churned", "Inactive"],
  Churned: ["Prospect", "Inactive"],
  Inactive: ["Prospect"],
};

/**
 * Set customer status with state machine validation.
 * Records AccountStatusHistory and writes audit log.
 *
 * Must be called inside OR outside a Prisma transaction ($transaction).
 * Pass a transaction client (`tx`) when called inside $transaction.
 */
export async function setCustomerStatus(
  customerId: string,
  newStatus: CustomerStatus,
  ctx: SetCustomerStatusContext,
  tx?: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<void> {
  const db = (tx ?? prisma) as typeof prisma;

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { status: true, name: true, email: true },
  });

  if (!customer) throw new Error(`Customer ${customerId} not found in setCustomerStatus`);

  const fromStatus = customer.status;

  // No-op if already at target status
  if (fromStatus === newStatus) return;

  // Special gate: Prospect → ActiveCustomer requires justification
  if (fromStatus === "Prospect" && newStatus === "ActiveCustomer" && !ctx.isAdminOverride) {
    // Check if there's a Won deal for this customer
    const wonDeal = await db.deal.findFirst({
      where: {
        customerId,
        status: "Won",
        deletedAt: null
      }
    });

    // Check if there's an active subscription
    const activeSubscription = await db.subscription.findFirst({
      where: {
        customerId,
        status: "Active",
        endDate: { gte: new Date() }
      }
    });

    // Check if there's an approved PO (Purchase Order)
    // Note: Assuming PO model exists - if not, this check will be skipped
    let hasApprovedPO = false;
    try {
      const poCount = await db.purchaseOrder.count({
        where: {
          customerId,
          status: "Approved",
          deletedAt: null
        }
      });
      hasApprovedPO = poCount > 0;
    } catch {
      // PO model may not exist, skip this check
    }

    if (!wonDeal && !activeSubscription && !hasApprovedPO) {
      throw new Error(
        "Cannot set status to ActiveCustomer without a Won deal, active subscription, or approved PO. Use admin override with reason if needed."
      );
    }
  }

  // Validate transition is allowed
  const allowedTransitions = ALLOWED_TRANSITIONS[fromStatus as CustomerStatus] || [];
  if (!ctx.isAdminOverride && !allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${fromStatus} → ${newStatus}. Allowed: ${allowedTransitions.join(", ")}`
    );
  }

  // Update customer status
  await db.customer.update({
    where: { id: customerId },
    data: { status: newStatus },
  });

  // Write AccountStatusHistory
  await db.accountStatusHistory.create({
    data: {
      customerId,
      fromStatus,
      toStatus: newStatus,
      changedById: ctx.actorId === "system" ? (await getSystemActorId(db)) : ctx.actorId,
      changedAt: new Date(),
    },
  });

  // Audit log
  await logAudit(
    ctx.actorId,
    "Customer",
    "StatusTransition",
    `Customer "${customer.name}" (${customer.email}) status: ${fromStatus} → ${newStatus}${ctx.reason ? `. Reason: ${ctx.reason}` : ""}${ctx.isAdminOverride ? " (ADMIN OVERRIDE)" : ""}`
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
