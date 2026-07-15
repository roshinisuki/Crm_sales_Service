/**
 * Single source of truth for applying a negotiation revision to a quotation.
 *
 * This function is called from:
 * - Negotiation revisions route (auto-approve path)
 * - Approvals route (manual approve path)
 * - Quotation approval route (manual approve path)
 *
 * It handles:
 * 1. Concurrency guard (stale revision detection)
 * 2. Cumulative discount computation relative to initialAmount
 * 3. Before/after snapshot creation
 * 4. Proportional discount application using original cost-basis prices
 * 5. Quotation + negotiation + revision status updates
 * 6. ActivityEvent logging
 *
 * IMPORTANT: The quotation status is NEVER changed by this function.
 * It stays whatever it was (typically UnderReview) throughout the negotiation.
 */

import { Prisma } from "@prisma/client";
import { applyDiscountToQuotationItems, computeOverallMarginPercent } from "@/lib/quotation-margins";
import { logEvent } from "@/lib/activity-event";

type PrismaTx = Omit<
  typeof import("@/lib/prisma")["prisma"],
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class StaleRevisionError extends Error {
  constructor(
    message: string,
    public submittedAgainstRound: number,
    public currentRound: number
  ) {
    super(message);
    this.name = "StaleRevisionError";
  }
}

interface ApplyRevisionParams {
  negotiationId: string;
  revisionId: string;
  actorId: string;
  tx: PrismaTx;
}

interface ApplyRevisionResult {
  negotiation: any;
  quotation: any;
  revision: any;
  beforeSnapshotId: string;
  afterSnapshotId: string;
  roundNumber: number;
  cumulativeDiscountPercent: number;
}

/**
 * Build a snapshot JSON from a quotation and its items.
 */
function buildSnapshotJson(quotation: any, items: any[]): string {
  return JSON.stringify({
    quotationCode: quotation.quotationCode,
    revisionNumber: quotation.revisionNumber,
    status: quotation.status,
    validUntil: quotation.validUntil,
    subtotal: quotation.subtotal,
    taxAmount: quotation.taxAmount,
    totalAmount: quotation.totalAmount,
    discountPercent: quotation.discountPercent,
    finalAmount: quotation.finalAmount,
    termsAndConditions: quotation.termsAndConditions,
    paymentTerms: quotation.paymentTerms,
    deliveryTerms: quotation.deliveryTerms,
    freightTerms: quotation.freightTerms,
    leadTimeDays: quotation.leadTimeDays,
    overallMarginPercent: quotation.overallMarginPercent ? Number(quotation.overallMarginPercent) : null,
    items: items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      lineTotal: it.lineTotal,
      hsn: it.hsn,
      unit: it.unit,
      notes: it.notes,
      costBasisUnitPrice: it.costBasisUnitPrice ? Number(it.costBasisUnitPrice) : null,
      marginPercent: it.marginPercent ? Number(it.marginPercent) : null,
      priceSource: it.priceSource,
      quantityBreakId: it.quantityBreakId,
    })),
  });
}

/**
 * Apply a negotiation revision to the linked quotation.
 *
 * MUST be called inside a Prisma transaction.
 *
 * @throws StaleRevisionError if the revision was submitted against a round
 *   that is no longer the current round (concurrent modification detected).
 */
export async function applyNegotiationRevision(
  params: ApplyRevisionParams
): Promise<ApplyRevisionResult> {
  const { negotiationId, revisionId, actorId, tx } = params;
  const db = tx as any;

  // 1. Load negotiation + quotation + revision + items
  const negotiation = await db.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      quotation: { include: { items: true } },
    },
  });

  if (!negotiation) {
    throw new Error(`Negotiation ${negotiationId} not found in applyNegotiationRevision`);
  }

  if (!negotiation.quotation) {
    throw new Error(`Negotiation ${negotiationId} has no linked quotation`);
  }

  const revision = await db.negotiationRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error(`NegotiationRevision ${revisionId} not found in applyNegotiationRevision`);
  }

  if (revision.status === "Approved") {
    throw new Error(`Revision ${revisionId} is already approved — cannot apply twice`);
  }

  // 2. Concurrency guard
  if (revision.submittedAgainstRound !== negotiation.currentRound) {
    throw new StaleRevisionError(
      `Stale revision: submitted against round ${revision.submittedAgainstRound} but current round is ${negotiation.currentRound}`,
      revision.submittedAgainstRound,
      negotiation.currentRound
    );
  }

  const quotation = negotiation.quotation;
  const nextRound = negotiation.currentRound + 1;

  // 3. Compute cumulative discount relative to initialAmount
  const initialAmount = negotiation.initialAmount || quotation.totalAmount || 0;
  const proposedAmount = revision.proposedAmount;
  const cumulativeDiscountPercent =
    initialAmount > 0
      ? Math.round(((initialAmount - proposedAmount) / initialAmount) * 10000) / 100
      : 0;

  // 4. Build original unit prices map from costBasisUnitPrice or current unitPrice
  //    If costBasisUnitPrice exists, we can derive the original price:
  //    originalUnitPrice = costBasis / (1 - originalMarginPercent/100)
  //    But we don't have originalMarginPercent stored separately.
  //    Instead, we use the round-0 snapshot's unit prices as the anchor.
  //
  //    Fallback: if no round-0 snapshot, use the reverse-engineering approach
  //    (legacy behavior in applyDiscountToQuotationItems).

  let originalUnitPrices: Record<string, number> | undefined;

  // Try to get the round-0 snapshot for original prices
  const round0Snapshot = await db.quotationRevisionSnapshot.findFirst({
    where: {
      quotationId: quotation.id,
      roundNumber: 0,
    },
    orderBy: { createdAt: "asc" },
  });

  if (round0Snapshot) {
    try {
      const snap = JSON.parse(round0Snapshot.snapshotJson);
      if (snap.items && Array.isArray(snap.items)) {
        originalUnitPrices = {};
        for (const snapItem of snap.items) {
          // We need the item ID — but snapshots store items without IDs in some cases.
          // Match by description + quantity as a fallback.
          const matchingItem = quotation.items.find(
            (it: any) => it.description === snapItem.description && it.quantity === snapItem.quantity
          );
          if (matchingItem && snapItem.unitPrice != null) {
            originalUnitPrices[matchingItem.id] = snapItem.unitPrice;
          }
        }
        // If we couldn't match all items, fall back to undefined (legacy behavior)
        if (Object.keys(originalUnitPrices).length === 0) {
          originalUnitPrices = undefined;
        }
      }
    } catch {
      // Snapshot parse failed — fall back to legacy behavior
      originalUnitPrices = undefined;
    }
  }

  // 5. Create BEFORE snapshot
  const beforeSnapshotJson = buildSnapshotJson(quotation, quotation.items);
  const beforeSnapshot = await db.quotationRevisionSnapshot.create({
    data: {
      quotationId: quotation.id,
      revisionNumber: quotation.revisionNumber,
      roundNumber: nextRound,
      triggeredBy: "negotiation_revision",
      triggerRefId: revision.id,
      snapshotJson: beforeSnapshotJson,
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      finalAmount: quotation.finalAmount,
      discountPercent: quotation.discountPercent,
      createdById: actorId,
    },
  });

  // 6. Apply proportional discount using original prices
  const recalc = applyDiscountToQuotationItems(
    quotation.items.map((it: any) => ({
      id: it.id,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      taxPercent: it.taxPercent,
      discountPercent: it.discountPercent,
    })),
    quotation.totalAmount,
    cumulativeDiscountPercent,
    originalUnitPrices
  );

  // 7. Update quotation line items
  for (const updatedItem of recalc.items) {
    await db.quotationItem.update({
      where: { id: updatedItem.id },
      data: {
        unitPrice: updatedItem.unitPrice,
        totalPrice: updatedItem.totalPrice,
        lineTotal: updatedItem.lineTotal,
        discountPercent: updatedItem.discountPercent,
      },
    });
  }

  // 8. Recompute overall margin
  const updatedItemsForMargin = quotation.items.map((it: any, idx: number) => ({
    quantity: it.quantity,
    unitPrice: recalc.items[idx].unitPrice,
    costBasisUnitPrice: it.costBasisUnitPrice ? Number(it.costBasisUnitPrice) : null,
  }));
  const newOverallMargin = computeOverallMarginPercent(updatedItemsForMargin);
  const clampedMargin = newOverallMargin != null ? Math.min(Math.round(newOverallMargin * 100) / 100, 99999.99) : null;

  // 9. Update quotation header — status stays unchanged!
  const updatedQuotation = await db.quotation.update({
    where: { id: quotation.id },
    data: {
      discountPercent: cumulativeDiscountPercent,
      subtotal: recalc.subtotal,
      taxAmount: recalc.taxAmount,
      finalAmount: recalc.finalAmount,
      currentRound: nextRound,
      ...(clampedMargin != null ? { overallMarginPercent: clampedMargin } : {}),
    },
    include: { items: true },
  });

  // 10. Create AFTER snapshot
  const afterSnapshotJson = buildSnapshotJson(updatedQuotation, updatedQuotation.items);
  const afterSnapshot = await db.quotationRevisionSnapshot.create({
    data: {
      quotationId: quotation.id,
      revisionNumber: quotation.revisionNumber,
      roundNumber: nextRound,
      triggeredBy: "negotiation_revision",
      triggerRefId: revision.id,
      snapshotJson: afterSnapshotJson,
      subtotal: recalc.subtotal,
      taxAmount: recalc.taxAmount,
      finalAmount: recalc.finalAmount,
      discountPercent: cumulativeDiscountPercent,
      createdById: actorId,
    },
  });

  // 11. Update negotiation
  const updatedNegotiation = await db.negotiation.update({
    where: { id: negotiationId },
    data: {
      currentRound: nextRound,
      revisedAmount: proposedAmount,
      discountApproved: cumulativeDiscountPercent,
      status: "PriceRevision",
    },
  });

  // 12. Update revision
  const updatedRevision = await db.negotiationRevision.update({
    where: { id: revisionId },
    data: {
      status: "Approved",
      roundNumber: nextRound,
      cumulativeDiscountPercent,
      previousAmount: negotiation.revisedAmount || negotiation.initialAmount,
      approvedById: actorId,
      resolvedAt: new Date(),
      quotationSnapshotBeforeId: beforeSnapshot.id,
      quotationSnapshotAfterId: afterSnapshot.id,
    },
  });

  // 12a. Bug 3 fix: Create a QuotationApproval record so the Approvals tab surfaces
  // negotiation revision approvals with resolved approver name, round, and timestamp.
  const actorUser = await db.user.findUnique({ where: { id: actorId }, select: { name: true, role: true } });
  await db.quotationApproval.create({
    data: {
      quotationId: quotation.id,
      requestedById: actorId,
      approverId: actorId,
      status: "Approved",
      discountPercent: cumulativeDiscountPercent,
      notes: `Negotiation round ${nextRound} revision approved. Discount: ${cumulativeDiscountPercent}%. Amount: ${proposedAmount}. Reason: ${revision.reason || "N/A"}`,
      decidedAt: new Date(),
      requiredApproverRole: actorUser?.role || null,
      revisionAuthorId: quotation.createdById,
    },
  });

  // 13. Log ActivityEvents
  await logEvent(db, {
    entityType: "Negotiation",
    entityId: negotiationId,
    rootEntityId: quotation.id,
    type: "revision_applied",
    fromStatus: negotiation.status,
    toStatus: "PriceRevision",
    roundNumber: nextRound,
    actorId,
    metadata: {
      revisionId,
      proposedAmount,
      cumulativeDiscountPercent,
      previousAmount: updatedRevision.previousAmount,
      reason: revision.reason,
    },
  });

  await logEvent(db, {
    entityType: "Quotation",
    entityId: quotation.id,
    rootEntityId: quotation.id,
    type: "quotation_discount_applied",
    roundNumber: nextRound,
    actorId,
    metadata: {
      negotiationId,
      revisionId,
      cumulativeDiscountPercent,
      finalAmount: recalc.finalAmount,
      subtotal: recalc.subtotal,
      taxAmount: recalc.taxAmount,
      reason: revision.reason,
    },
  });

  // 14. Save revision snapshot as a CRMDocument for document management
  // Point fileUrl to the PDF API endpoint which returns real PDF bytes with
  // Content-Type: application/pdf (not a frontend page route that downloads as HTML).
  const revisionDocCode = `QT-REV-${quotation.quotationCode}-R${nextRound}`;
  await db.cRMDocument.create({
    data: {
      documentCode: revisionDocCode,
      name: `Quotation ${quotation.quotationCode} — Revision R${nextRound} (Negotiation).pdf`,
      documentType: "QuotationRevision",
      entityType: "Quotation",
      entityId: quotation.id,
      fileUrl: `/api/quotations/${quotation.id}/pdf?round=${nextRound}`,
      mimeType: "application/pdf",
      fileSize: afterSnapshotJson.length,
      description: `Negotiation round ${nextRound} snapshot. Discount: ${cumulativeDiscountPercent}%. Amount: ${proposedAmount}. Reason: ${revision.reason || "N/A"}`,
      tags: `negotiation,revision,R${nextRound},${negotiation.negotiationCode}`,
      uploadedById: actorId,
      companyId: negotiation.companyId || null,
      customerId: negotiation.customerId || null,
      revisionNumber: nextRound,
      isCurrent: true,
    },
  });

  // 15. Append revision summary to quotation termsAndConditions (only existing nvarchar(max) field for notes)
  const discountAmount = (negotiation.initialAmount || 0) - proposedAmount;
  const revisionSummary = `\n[R${nextRound}] Discount: ${cumulativeDiscountPercent}% (₹${discountAmount.toFixed(2)} off). Final: ₹${proposedAmount.toFixed(2)}. Reason: ${revision.reason || "N/A"}. Approved by: ${actorUser?.name || actorId}.`;
  const existingTerms = updatedQuotation.termsAndConditions || "";
  await db.quotation.update({
    where: { id: quotation.id },
    data: {
      termsAndConditions: existingTerms + revisionSummary,
    },
  });

  return {
    negotiation: updatedNegotiation,
    quotation: updatedQuotation,
    revision: updatedRevision,
    beforeSnapshotId: beforeSnapshot.id,
    afterSnapshotId: afterSnapshot.id,
    roundNumber: nextRound,
    cumulativeDiscountPercent,
  };
}

/**
 * Reject a negotiation revision — no quotation changes, no snapshots.
 * Just updates the revision status and reverts negotiation to a sensible state.
 */
export async function rejectNegotiationRevision(
  params: {
    negotiationId: string;
    revisionId: string;
    actorId: string;
    tx: PrismaTx;
    revertStatus?: string;
  }
): Promise<void> {
  const { negotiationId, revisionId, actorId, tx } = params;
  const db = tx as any;
  const revertStatus = params.revertStatus || "Active";

  const negotiation = await db.negotiation.findUnique({
    where: { id: negotiationId },
    select: { status: true, quotationId: true },
  });

  if (!negotiation) {
    throw new Error(`Negotiation ${negotiationId} not found in rejectNegotiationRevision`);
  }

  await db.negotiationRevision.update({
    where: { id: revisionId },
    data: {
      status: "Rejected",
      resolvedAt: new Date(),
      approvedById: actorId,
    },
  });

  // Bug 3 fix: Create a QuotationApproval record for rejected revisions too,
  // so the Approvals tab shows both approvals and rejections.
  const revision = await db.negotiationRevision.findUnique({
    where: { id: revisionId },
    select: { proposedAmount: true, cumulativeDiscountPercent: true, reason: true },
  });
  const rejectActorUser = await db.user.findUnique({ where: { id: actorId }, select: { name: true, role: true } });
  await db.quotationApproval.create({
    data: {
      quotationId: negotiation.quotationId,
      requestedById: actorId,
      approverId: actorId,
      status: "Rejected",
      discountPercent: revision?.cumulativeDiscountPercent || 0,
      notes: `Negotiation revision rejected. Proposed amount: ${revision?.proposedAmount || "N/A"}. Reason: ${revision?.reason || "N/A"}`,
      decidedAt: new Date(),
      requiredApproverRole: rejectActorUser?.role || null,
      revisionAuthorId: null,
    },
  });

  await db.negotiation.update({
    where: { id: negotiationId },
    data: { status: revertStatus },
  });

  await logEvent(db, {
    entityType: "Negotiation",
    entityId: negotiationId,
    rootEntityId: negotiation.quotationId || undefined,
    type: "revision_rejected",
    fromStatus: "PendingApproval",
    toStatus: revertStatus,
    actorId,
    metadata: { revisionId },
  });
}
