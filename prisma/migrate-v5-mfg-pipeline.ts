/**
 * prisma/migrate-v5-mfg-pipeline.ts
 *
 * V5 Manufacturing Pipeline — Seed & Migration Helper
 *
 * Run after `npx prisma migrate dev --name mfg-pipeline-v5`:
 *   npx ts-node --project tsconfig.json prisma/migrate-v5-mfg-pipeline.ts
 *
 * What this does:
 *   1. Upserts canonical PipelineStageMaster rows (idempotent)
 *   2. Re-sequences displayOrder to include TechnicalDiscussion at order=3
 *   3. No destructive drops — all existing data is preserved
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANONICAL_STAGES = [
  { stageName: "Qualified",             displayName: "Qualified",              displayOrder: 1, probabilityPercent: 20, isClosedStage: false },
  { stageName: "RequirementGathering",  displayName: "Requirement gathering",  displayOrder: 2, probabilityPercent: 35, isClosedStage: false },
  { stageName: "TechnicalDiscussion",   displayName: "Technical discussion",   displayOrder: 3, probabilityPercent: 50, isClosedStage: false },
  { stageName: "MeetingScheduled",      displayName: "Meeting scheduled",      displayOrder: 4, probabilityPercent: 60, isClosedStage: false },
  { stageName: "DemoConducted",         displayName: "Demo conducted",         displayOrder: 5, probabilityPercent: 75, isClosedStage: false },
  { stageName: "Won",                   displayName: "Won",                    displayOrder: 6, probabilityPercent: 100, isClosedStage: true  },
  { stageName: "Rejected",              displayName: "Rejected",               displayOrder: 0, probabilityPercent: 0,  isClosedStage: true  },
  { stageName: "Lost",                  displayName: "Lost",                   displayOrder: 0, probabilityPercent: 0,  isClosedStage: true  },
];

async function main() {
  console.log("=== V5 Manufacturing Pipeline Migration ===\n");

  // 1. Get all companies to upsert stages per-company (or globally if no companyId)
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const targets = companies.length > 0 ? companies : [{ id: null as string | null, name: "Global" }];

  for (const company of targets) {
    console.log(`\nProcessing company: ${company.name || "Global (companyId=null)"}`);

    for (const stage of CANONICAL_STAGES) {
      const existing = await prisma.pipelineStageMaster.findFirst({
        where: { stageName: stage.stageName, companyId: company.id },
      });

      if (existing) {
        // Update displayOrder and probabilityPercent to new canonical values
        await prisma.pipelineStageMaster.update({
          where: { id: existing.id },
          data: {
            displayName:       stage.displayName,
            displayOrder:      stage.displayOrder,
            probabilityPercent: stage.probabilityPercent,
            isClosedStage:     stage.isClosedStage,
            isActive:          true,
          },
        });
        console.log(`  ✓ Updated: ${stage.stageName} (order=${stage.displayOrder}, prob=${stage.probabilityPercent}%)`);
      } else {
        await prisma.pipelineStageMaster.create({
          data: {
            ...stage,
            companyId: company.id,
            isActive:  true,
          },
        });
        console.log(`  + Created: ${stage.stageName} (order=${stage.displayOrder}, prob=${stage.probabilityPercent}%)`);
      }
    }
  }

  // 2. Summary
  const totalStages = await prisma.pipelineStageMaster.count();
  const totalDeals  = await prisma.deal.count({ where: { deletedAt: null } });
  console.log(`\n=== Summary ===`);
  console.log(`  PipelineStageMaster rows: ${totalStages}`);
  console.log(`  Active deals:             ${totalDeals}`);
  console.log(`\n✅ Migration complete. Schema changes will be applied by: npx prisma migrate dev --name mfg-pipeline-v5`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
