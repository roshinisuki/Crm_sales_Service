import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill for FollowUp records...");
  const followUps = await prisma.followUp.findMany({
    where: {
      OR: [
        { entityType: null },
        { entityId: null }
      ]
    }
  });

  console.log(`Found ${followUps.length} follow-up records to backfill.`);

  let updatedCount = 0;
  for (const f of followUps) {
    let targetType: string | null = null;
    let targetId: string | null = null;

    if (f.customerId) {
      targetType = "account";
      targetId = f.customerId;
    } else if (f.leadId) {
      targetType = "lead";
      targetId = f.leadId;
    }

    if (targetType && targetId) {
      await prisma.followUp.update({
        where: { id: f.id },
        data: {
          entityType: targetType,
          entityId: targetId
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully backfilled ${updatedCount} follow-up records.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
