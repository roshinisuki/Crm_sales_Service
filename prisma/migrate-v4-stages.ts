/**
 * SUKI CRM — V4 Stage Migration Script
 * Migrates existing deals from legacy statuses to V4 pipeline stages.
 *
 * Legacy → V4 mapping:
 *   SalesOpportunity  → Qualified
 *   Active            → Qualified
 *   OnHold            → Qualified (with isLocked = true to preserve hold state)
 *   ProposalSent      → DemoConducted
 *   Negotiation       → DemoConducted
 *   Won               → Won (stays in Deals module, not pipeline)
 *   Lost              → Lost
 *
 * Also:
 *   - Sets stageEnteredAt for all migrated deals
 *   - Creates DealStageHistory entries documenting the migration
 *   - Deactivates legacy PipelineStageMaster entries
 *
 * Run: npx ts-node prisma/migrate-v4-stages.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_TO_V4: Record<string, string> = {
  SalesOpportunity: "Qualified",
  Active: "Qualified",
  "OnHold": "Qualified",
  "On Hold": "Qualified",
  ProposalSent: "DemoConducted",
  Negotiation: "DemoConducted",
  "Requirement Gathering": "RequirementGathering",
  Won: "Won",
  Lost: "Lost",
};

async function main() {
  console.log("🔄 V4 Stage Migration Starting...\n");

  // Resolve a system admin user for FK constraints
  const systemAdmin = await prisma.user.findFirst({
    where: { role: { in: ["SuperAdmin", "Admin"] }, isActive: true },
    select: { id: true },
  });
  const systemActorId = systemAdmin?.id;
  if (!systemActorId) {
    console.error("❌ No active SuperAdmin or Admin user found. Cannot proceed — DealStageHistory requires a valid changedById.");
    process.exit(1);
  }
  console.log(`  👤 System actor: ${systemActorId}\n`);

  // 1. Deactivate legacy PipelineStageMaster entries
  const legacyStages = ["SalesOpportunity", "ProposalSent", "Negotiation", "Active", "OnHold"];
  for (const legacy of legacyStages) {
    const result = await prisma.pipelineStageMaster.updateMany({
      where: { stageName: legacy },
      data: { isActive: false },
    });
    if (result.count > 0) {
      console.log(`  📌 Deactivated PipelineStageMaster: ${legacy} (${result.count} rows)`);
    }
  }

  // 2. Ensure V4 stages exist in PipelineStageMaster
  const v4Stages = [
    { stageName: "Qualified", displayName: "Qualified", displayOrder: 1, probabilityPercent: 20 },
    { stageName: "RequirementGathering", displayName: "Requirement Gathering", displayOrder: 2, probabilityPercent: 40 },
    { stageName: "MeetingScheduled", displayName: "Meeting Scheduled", displayOrder: 3, probabilityPercent: 55 },
    { stageName: "DemoConducted", displayName: "Demo Conducted", displayOrder: 4, probabilityPercent: 70 },
    { stageName: "Rejected", displayName: "Rejected", displayOrder: 5, probabilityPercent: 0 },
    { stageName: "Lost", displayName: "Lost", displayOrder: 6, probabilityPercent: 0 },
  ];

  for (const stage of v4Stages) {
    await prisma.pipelineStageMaster.upsert({
      where: { stageName: stage.stageName },
      update: { displayOrder: stage.displayOrder, probabilityPercent: stage.probabilityPercent, isActive: true },
      create: { ...stage, isActive: true },
    });
  }
  console.log("  ✅ V4 PipelineStageMaster entries ensured\n");

  // 3. Migrate deals with legacy statuses
  const allDeals = await prisma.deal.findMany({
    where: { deletedAt: null },
    select: { id: true, status: true, dealName: true, createdAt: true, assignedUserId: true },
  });

  let migrated = 0;
  let skipped = 0;
  let alreadyV4 = 0;

  for (const deal of allDeals) {
    const currentStatus = deal.status;
    const newStatus = LEGACY_TO_V4[currentStatus];

    // Already a V4 stage
    if (!newStatus) {
      if (["Qualified", "RequirementGathering", "MeetingScheduled", "DemoConducted", "Rejected", "Lost", "Won"].includes(currentStatus)) {
        alreadyV4++;
        // Ensure stageEnteredAt is set
        if (!deal.createdAt) continue;
        continue;
      }
      console.log(`  ⚠️  Skipping deal ${deal.id} ("${deal.dealName}") — unknown status: ${currentStatus}`);
      skipped++;
      continue;
    }

    if (newStatus === currentStatus) {
      alreadyV4++;
      continue;
    }

    const now = new Date();
    const isOnHold = currentStatus === "OnHold";

    // Update deal status and set stageEnteredAt
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: newStatus,
        stageEnteredAt: now,
        ...(isOnHold ? { isLocked: true } : {}),
      },
    });

    // Create DealStageHistory entry documenting the migration
    await prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: currentStatus,
        toStatus: newStatus,
        changedById: systemActorId,
        durationInPreviousStage: Math.floor(
          (now.getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        outcomeNotes: `V4 migration: ${currentStatus} → ${newStatus}${isOnHold ? " (deal was OnHold, isLocked set to preserve state)" : ""}`,
        stageDataSnapshot: JSON.stringify({ migratedFrom: currentStatus, migratedAt: now.toISOString() }),
      },
    });

    migrated++;
    console.log(`  🔄 ${deal.dealName}: ${currentStatus} → ${newStatus}`);
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Already V4: ${alreadyV4}`);
  console.log(`   Skipped (unknown): ${skipped}`);
  console.log(`   Total processed: ${allDeals.length}`);
  console.log("\n🎉 V4 Stage Migration Complete!");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
