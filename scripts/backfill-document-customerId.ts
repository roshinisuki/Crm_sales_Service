import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

async function resolveCustomerId(
  entityType: string,
  entityId: string
): Promise<string | null> {
  try {
    switch (entityType) {
      case "Customer":
        return entityId;
      case "Deal": {
        const deal = await prisma.deal.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return deal?.customerId ?? null;
      }
      case "RFQ": {
        const rfq = await prisma.rFQ.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return rfq?.customerId ?? null;
      }
      case "Quotation": {
        const quot = await prisma.quotation.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return quot?.customerId ?? null;
      }
      case "PurchaseOrder": {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return po?.customerId ?? null;
      }
      case "Negotiation": {
        const neg = await prisma.negotiation.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return neg?.customerId ?? null;
      }
      case "SampleRequest": {
        const sample = await prisma.sampleRequest.findUnique({
          where: { id: entityId },
          select: { customerId: true },
        });
        return sample?.customerId ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function main() {
  console.log("Starting backfill for CRMDocument.customerId...\n");

  const docs = await prisma.cRMDocument.findMany({
    where: { customerId: null, deletedAt: null },
    select: {
      id: true,
      documentCode: true,
      name: true,
      entityType: true,
      entityId: true,
    },
  });

  console.log(`Found ${docs.length} documents with null customerId.\n`);

  let updated = 0;
  const unresolved: Array<{
    id: string;
    documentCode: string;
    name: string;
    entityType: string;
    entityId: string;
    reason: string;
  }> = [];

  for (const doc of docs) {
    if (!doc.entityType || !doc.entityId) {
      unresolved.push({
        id: doc.id,
        documentCode: doc.documentCode,
        name: doc.name,
        entityType: doc.entityType || "(empty)",
        entityId: doc.entityId || "(empty)",
        reason: "Missing entityType or entityId",
      });
      continue;
    }

    const customerId = await resolveCustomerId(doc.entityType, doc.entityId);

    if (customerId) {
      await prisma.cRMDocument.update({
        where: { id: doc.id },
        data: { customerId },
      });
      updated++;
      console.log(`  ✓ ${doc.documentCode} → customerId: ${customerId}`);
    } else {
      unresolved.push({
        id: doc.id,
        documentCode: doc.documentCode,
        name: doc.name,
        entityType: doc.entityType,
        entityId: doc.entityId,
        reason: `Could not resolve customerId from ${doc.entityType}/${doc.entityId}`,
      });
      console.log(`  ✗ ${doc.documentCode} — unresolved (${doc.entityType})`);
    }
  }

  console.log(`\nBackfill complete: ${updated} updated, ${unresolved.length} unresolved.`);

  if (unresolved.length > 0) {
    const reportPath = "scripts/backfill-document-report.json";
    writeFileSync(reportPath, JSON.stringify(unresolved, null, 2));
    console.log(`Unresolved documents logged to ${reportPath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
