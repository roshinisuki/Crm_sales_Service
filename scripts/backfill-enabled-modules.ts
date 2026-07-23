// Phase 2 backfill: compute Company.enabledModules from the existing
// Company.variant, using the same mapping the sidebar already uses
// (isVariant2/3/4). Purely additive — does not touch `variant` or any
// other field, and does not change any visible/enforced behavior since
// nothing reads `enabledModules` yet.
//
// Usage:
//   npx tsx scripts/backfill-enabled-modules.ts            (dry run, no writes)
//   npx tsx scripts/backfill-enabled-modules.ts --apply    (writes changes)

import { PrismaClient } from "@prisma/client";
import { getModulesForVariant } from "../lib/config/moduleVariantMap";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Starting enabledModules backfill... (${APPLY ? "APPLY mode" : "DRY RUN — no writes"})`);

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, variant: true, enabledModules: true },
  });

  console.log(`Found ${companies.length} companies.\n`);

  let wouldUpdate = 0;
  let skippedAlreadySet = 0;

  for (const c of companies) {
    const computed = getModulesForVariant(c.variant);
    const computedJson = JSON.stringify(computed);

    // Skip companies that already have a non-default enabledModules value —
    // never overwrite manual/previous customization.
    if (c.enabledModules && c.enabledModules !== "[]") {
      skippedAlreadySet++;
      console.log(`SKIP  ${c.name} (variant ${c.variant}) — enabledModules already set: ${c.enabledModules}`);
      continue;
    }

    console.log(`${APPLY ? "WRITE" : "PLAN "} ${c.name} (variant ${c.variant}) -> ${computedJson}`);
    wouldUpdate++;

    if (APPLY) {
      await prisma.company.update({
        where: { id: c.id },
        data: { enabledModules: computedJson },
      });
    }
  }

  console.log(`\nSummary: ${wouldUpdate} ${APPLY ? "updated" : "would be updated"}, ${skippedAlreadySet} skipped (already set).`);
  if (!APPLY) {
    console.log("This was a dry run. Re-run with --apply to write changes.");
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
