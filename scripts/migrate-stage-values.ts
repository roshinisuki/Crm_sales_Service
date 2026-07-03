import { prisma } from "../lib/prisma";

/**
 * One-time migration: normalize old stage values to new canonical pipeline stages.
 * SalesOpportunity → Qualified
 * ProposalSent → DemoConducted
 * Negotiation → DemoConducted
 * Won → DemoConducted (preserved as won deals should be handled separately)
 */
async function main() {
  const migrations: Array<[string, string]> = [
    ["SalesOpportunity", "Qualified"],
    ["ProposalSent", "DemoConducted"],
    ["Negotiation", "DemoConducted"],
    ["Won", "DemoConducted"],
  ];

  for (const [from, to] of migrations) {
    const result = await prisma.deal.updateMany({
      where: { status: from },
      data: { status: to },
    });
    console.log(`Migrated ${result.count} deals: ${from} → ${to}`);
  }

  // Also update DealStageHistory entries
  for (const [from, to] of migrations) {
    const fromResult = await prisma.dealStageHistory.updateMany({
      where: { fromStatus: from },
      data: { fromStatus: to },
    });
    const toResult = await prisma.dealStageHistory.updateMany({
      where: { toStatus: from },
      data: { toStatus: to },
    });
    console.log(`Migrated stage history: ${from} → ${to} (${fromResult.count} from, ${toResult.count} to)`);
  }

  await prisma.$disconnect();
  console.log("\nMigration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
