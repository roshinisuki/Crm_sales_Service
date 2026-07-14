/**
 * Backfill script for PR 1: Schema Migration
 *
 * Sets currentRound = 0 on all quotations and negotiations.
 * Creates a round-0 backfill snapshot for every quotation.
 * Sets roundNumber = revisionNumber on existing negotiation revisions.
 * Sets submittedAgainstRound = 0 on existing negotiation revisions.
 *
 * Run with: npx tsx prisma/backfill-rounds.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill...");

  // 1. Set currentRound = 0 on all quotations
  const quoteResult = await prisma.quotation.updateMany({
    where: { currentRound: undefined as any },
    data: { currentRound: 0 },
  });
  // Fallback: update all quotations regardless
  const quoteResult2 = await prisma.quotation.updateMany({
    data: { currentRound: 0 },
  });
  console.log(`Updated currentRound on ${quoteResult2.count} quotations`);

  // 2. Set currentRound = 0 on all negotiations
  const negResult = await prisma.negotiation.updateMany({
    data: { currentRound: 0 },
  });
  console.log(`Updated currentRound on ${negResult.count} negotiations`);

  // 3. Set roundNumber = revisionNumber on existing negotiation revisions
  const revisions = await prisma.negotiationRevision.findMany({
    select: { id: true, revisionNumber: true },
  });
  console.log(`Found ${revisions.length} existing negotiation revisions to backfill`);

  for (const rev of revisions) {
    await prisma.negotiationRevision.update({
      where: { id: rev.id },
      data: {
        roundNumber: rev.revisionNumber,
        submittedAgainstRound: 0,
      },
    });
  }
  console.log(`Backfilled ${revisions.length} negotiation revisions with roundNumber`);

  // 4. Create a round-0 backfill snapshot for every quotation that doesn't have one
  const quotations = await prisma.quotation.findMany({
    include: { items: true },
  });
  console.log(`Checking ${quotations.length} quotations for backfill snapshots...`);

  let snapshotCount = 0;
  for (const q of quotations) {
    const existingSnapshot = await prisma.quotationRevisionSnapshot.findFirst({
      where: {
        quotationId: q.id,
        roundNumber: 0,
        triggeredBy: "backfill",
      },
    });
    if (existingSnapshot) continue;

    const snapshotJson = JSON.stringify({
      quotationCode: q.quotationCode,
      revisionNumber: q.revisionNumber,
      status: q.status,
      validUntil: q.validUntil,
      subtotal: q.subtotal,
      taxAmount: q.taxAmount,
      totalAmount: q.totalAmount,
      discountPercent: q.discountPercent,
      finalAmount: q.finalAmount,
      termsAndConditions: q.termsAndConditions,
      paymentTerms: q.paymentTerms,
      deliveryTerms: q.deliveryTerms,
      freightTerms: q.freightTerms,
      leadTimeDays: q.leadTimeDays,
      overallMarginPercent: q.overallMarginPercent ? Number(q.overallMarginPercent) : null,
      items: q.items.map((it) => ({
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

    await prisma.quotationRevisionSnapshot.create({
      data: {
        quotationId: q.id,
        revisionNumber: q.revisionNumber,
        roundNumber: 0,
        triggeredBy: "backfill",
        snapshotJson,
        subtotal: q.subtotal,
        taxAmount: q.taxAmount,
        finalAmount: q.finalAmount,
        discountPercent: q.discountPercent,
        createdById: q.createdById,
      },
    });
    snapshotCount++;
  }
  console.log(`Created ${snapshotCount} backfill snapshots`);

  console.log("Backfill complete!");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
