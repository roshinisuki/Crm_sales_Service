/**
 * One-time data fix for existing FollowUp records that were seeded without
 * `type`/`sourceType`, causing them to never match the runtime auto-complete
 * filter (type: "Call", sourceType: "AUTO") used in createCallAction /
 * contactLeadAction. Result: leads that were already contacted (call logged)
 * kept showing "Log Follow-Up Activity" instead of "Add Follow-Up".
 *
 * For each broken FollowUp (leadId set, type/sourceType null, status Pending/Overdue):
 *   - If the lead already has a logged Call activity -> mark FollowUp Completed (backfilled).
 *   - Otherwise -> just backfill type/sourceType so future call logging completes it naturally.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.followUp.findMany({
    where: {
      leadId: { not: null },
      type: null,
      sourceType: null,
      status: { in: ["Pending", "Overdue"] },
    },
    include: {
      lead: {
        include: { communicationLogs: { where: { channel: "Call" } } },
      },
    },
  });

  console.log(`Found ${stuck.length} stuck follow-up(s).`);

  let completed = 0;
  let backfilled = 0;

  for (const fu of stuck) {
    const hasLoggedCall = (fu.lead?.communicationLogs?.length ?? 0) > 0;

    if (hasLoggedCall) {
      const lastCall = fu.lead.communicationLogs[fu.lead.communicationLogs.length - 1];
      await prisma.followUp.update({
        where: { id: fu.id },
        data: {
          type: "Call",
          sourceType: "AUTO",
          status: "Completed",
          completedAt: lastCall?.sentAt ?? new Date(),
          completionNotes: fu.completionNotes || "Backfilled: call activity was already logged for this lead.",
        },
      });
      completed++;
    } else {
      await prisma.followUp.update({
        where: { id: fu.id },
        data: { type: "Call", sourceType: "AUTO" },
      });
      backfilled++;
    }
  }

  console.log(`Completed (call already logged): ${completed}`);
  console.log(`Backfilled type/sourceType only: ${backfilled}`);
  console.log("\n✅ Done.");
}

main()
  .catch((e) => {
    console.error("❌ Fix failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
