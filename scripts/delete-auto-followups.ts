/**
 * Delete all auto-created follow-ups from existing leads
 * Run: npx ts-node scripts/delete-auto-followups.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Deleting auto-created follow-ups...\n");

  const result = await prisma.followUp.deleteMany({
    where: {
      autoCreated: true,
    },
  });

  console.log(`✅ Deleted ${result.count} auto-created follow-up(s)\n`);
  console.log("Note: New leads created after the fix will not have auto-follow-ups.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
