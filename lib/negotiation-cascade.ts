/**
 * Shared cascade logic for negotiation close (Success / Failure).
 *
 * Used by:
 * - PUT /api/negotiations/[id] (inline cascade)
 * - POST /api/quotations/[id]/accept (inline cascade)
 *
 * This ensures both paths produce identical side-effects:
 * - Quotation status update + history
 * - RFQ closure
 * - Deal stage transition
 * - Customer activation
 * - Follow-up cancellation
 * - Notifications
 * - ActivityEvent logging
 */

import { transitionDealStatus } from "@/lib/dealService";
import { logEvent } from "@/lib/activity-event";

type PrismaTx = Omit<
  typeof import("@/lib/prisma")["prisma"],
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface CascadeParams {
  quotationId?: string | null;
  dealId?: string | null;
  customerId: string;
  negotiationCode: string;
  negotiationId: string;
  actorId: string;
  companyId: string;
  finalAmount?: number;
  rejectionReason?: string;
  fromNegotiationStatus: string;
  tx: PrismaTx;
}

/**
 * Cascade for Closed-Success: quotation → Accepted, RFQ → Closed, deal → Won,
 * customer → Active, follow-ups → Cancelled, notifications.
 */
export async function cascadeNegotiationSuccess(params: CascadeParams): Promise<void> {
  const { quotationId, dealId, customerId, negotiationCode, negotiationId, actorId, companyId, finalAmount, fromNegotiationStatus, tx } = params;
  const db = tx as any;
  const now = new Date();
  const finalAmt = finalAmount ?? 0;

  // 1. Update quotation to Accepted
  if (quotationId) {
    await db.quotation.update({
      where: { id: quotationId },
      data: {
        finalAmount: finalAmt,
        status: "Accepted",
        acceptedAt: now,
      },
    });

    await db.quotationStatusHistory.create({
      data: {
        quotationId,
        fromStatus: fromNegotiationStatus === "PendingApproval" ? "UnderReview" : fromNegotiationStatus,
        toStatus: "Accepted",
        changedById: actorId,
        notes: "Quotation accepted via negotiation success",
      },
    });

    // Close RFQ if linked
    const quote = await db.quotation.findUnique({
      where: { id: quotationId },
      select: { rfqId: true, quotationCode: true },
    });
    if (quote?.rfqId) {
      const rfq = await db.rFQ.findUnique({
        where: { id: quote.rfqId },
        select: { id: true, status: true },
      });
      if (rfq && rfq.status !== "Closed") {
        await db.rFQ.update({
          where: { id: rfq.id },
          data: { status: "Closed" },
        });
        await db.rFQStatusHistory.create({
          data: {
            rfqId: rfq.id,
            fromStatus: rfq.status,
            toStatus: "Closed",
            changedById: actorId,
            notes: `RFQ closed on negotiation success for quotation ${quote.quotationCode}`,
          },
        });
      }
    }

    await logEvent(db, {
      entityType: "Quotation",
      entityId: quotationId,
      rootEntityId: quotationId,
      type: "quotation_accepted",
      fromStatus: fromNegotiationStatus,
      toStatus: "Accepted",
      actorId,
      metadata: { negotiationId, negotiationCode, finalAmount: finalAmt },
    });
  }

  // 2. Transition Deal to Won
  if (dealId) {
    await transitionDealStatus(dealId, "Won", {
      actorId,
      reason: `Negotiation ${negotiationCode} closed as success`,
      companyId,
    }, db);
  } else {
    // Prospect -> Active customer sync if no linked deal
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true },
    });
    if (customer && customer.status === "Prospect") {
      await db.customer.update({
        where: { id: customerId },
        data: { status: "Active", accountType: "Customer" },
      });
      await db.accountStatusHistory.create({
        data: {
          customerId,
          fromStatus: "Prospect",
          toStatus: "Active",
          changedById: actorId,
          notes: `Auto-activated on negotiation success (${negotiationCode})`,
        },
      });
    }
  }

  // 3. Cancel pending follow-ups
  await db.followUp.updateMany({
    where: {
      customerId,
      status: { in: ["Pending", "Overdue"] },
    },
    data: { status: "Cancelled" },
  });

  // 4. Notifications
  const managers = await db.user.findMany({
    where: { role: "SalesManager", companyId, isActive: true },
    select: { id: true },
  });
  for (const mgr of managers) {
    await db.notification.create({
      data: {
        userId: mgr.id,
        title: "Deal Won!",
        message: `Deal Won: Customer negotiation ${negotiationCode} closed as success — ₹${finalAmt.toFixed(2)}`,
        type: "Deal",
        link: `/negotiations/${negotiationId}`,
      },
    });
  }

  const financeUsers = await db.user.findMany({
    where: { role: { in: ["Admin", "CostingEngineer"] }, companyId, isActive: true },
    select: { id: true },
  });
  for (const fin of financeUsers) {
    await db.notification.create({
      data: {
        userId: fin.id,
        title: "New Order",
        message: `New order via negotiation success ${negotiationCode} — ₹${finalAmt.toFixed(2)}`,
        type: "Order",
        link: `/negotiations/${negotiationId}`,
      },
    });
  }

  await logEvent(db, {
    entityType: "Negotiation",
    entityId: negotiationId,
    rootEntityId: quotationId || undefined,
    type: "negotiation_closed_success",
    fromStatus: fromNegotiationStatus,
    toStatus: "Closed-Success",
    actorId,
    metadata: { finalAmount: finalAmt, dealId, quotationId },
  });
}

/**
 * Cascade for Closed-Failure: quotation → Rejected, deal → Lost, notifications.
 */
export async function cascadeNegotiationFailure(params: CascadeParams): Promise<void> {
  const { quotationId, dealId, negotiationCode, negotiationId, actorId, companyId, rejectionReason, fromNegotiationStatus, tx } = params;
  const db = tx as any;
  const now = new Date();
  const reason = rejectionReason || "Negotiation closed as failure";

  // 1. Update quotation to Rejected
  if (quotationId) {
    await db.quotation.update({
      where: { id: quotationId },
      data: {
        status: "Rejected",
        rejectedAt: now,
        rejectionReason: reason,
      },
    });

    await db.quotationStatusHistory.create({
      data: {
        quotationId,
        fromStatus: fromNegotiationStatus === "PendingApproval" ? "UnderReview" : fromNegotiationStatus,
        toStatus: "Rejected",
        changedById: actorId,
        notes: reason,
      },
    });

    await logEvent(db, {
      entityType: "Quotation",
      entityId: quotationId,
      rootEntityId: quotationId,
      type: "quotation_rejected",
      fromStatus: fromNegotiationStatus,
      toStatus: "Rejected",
      actorId,
      metadata: { negotiationId, negotiationCode, reason },
    });
  }

  // 2. Transition Deal to Lost
  if (dealId) {
    await transitionDealStatus(dealId, "Lost", {
      actorId,
      reason: `Negotiation ${negotiationCode} closed as failure`,
      companyId,
    }, db);
  }

  await logEvent(db, {
    entityType: "Negotiation",
    entityId: negotiationId,
    rootEntityId: quotationId || undefined,
    type: "negotiation_closed_failure",
    fromStatus: fromNegotiationStatus,
    toStatus: "Closed-Failure",
    actorId,
    metadata: { reason, dealId, quotationId },
  });
}
