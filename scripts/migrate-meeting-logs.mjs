/**
 * Migration script — runs AFTER `prisma db push` has created the MeetingLog table.
 * Reads backup/dropped-columns-backup.json and populates MeetingLog with
 * meeting/demo data that was previously stored as flat columns.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const backupPath = join(__dirname, "..", "backup", "dropped-columns-backup.json");
  const backup = JSON.parse(readFileSync(backupPath, "utf-8"));

  console.log(`Loaded backup from: ${backupPath}`);
  console.log(`  Deals: ${backup.deals.length} rows`);
  console.log(`  OpportunityDetails: ${backup.opportunityDetails.length} rows`);

  let migrated = 0;

  // ─── Migrate meeting/demo data from OpportunityDetail ───
  for (const od of backup.opportunityDetails) {
    const hasMeeting = od.meetingDate || od.meetingType || od.meetingMode || od.meetingParticipants;
    const hasDemo = od.demoDate || od.demoType || od.demoPresenter || od.demoAttendees;

    if (hasMeeting) {
      await prisma.meetingLog.create({
        data: {
          dealId: od.dealId,
          attemptNumber: 1,
          meetingDate: od.meetingDate ? new Date(od.meetingDate) : null,
          meetingType: od.meetingType,
          meetingMode: od.meetingMode,
          participants: od.meetingParticipants,
          agenda: od.meetingAgenda,
          outcome: od.meetingOutcome,
          notes: null,
          rejectionReason: null,
        },
      });
      migrated++;
    }

    if (hasDemo) {
      await prisma.meetingLog.create({
        data: {
          dealId: od.dealId,
          attemptNumber: 2,
          meetingDate: od.demoDate ? new Date(od.demoDate) : null,
          meetingType: od.demoType ? `Demo: ${od.demoType}` : "Demo",
          meetingMode: null,
          participants: od.demoAttendees,
          agenda: null,
          outcome: od.demoInterestLevel ? `Interest: ${od.demoInterestLevel}` : null,
          notes: od.demoQuestionsRaised || od.demoCustomerRating
            ? `Questions: ${od.demoQuestionsRaised || ""} Rating: ${od.demoCustomerRating || ""}`
            : null,
          rejectionReason: od.demoRejectionReason,
        },
      });
      migrated++;
    }
  }

  // ─── Migrate Deal demo data ───
  for (const deal of backup.deals) {
    if (deal.demoOutcome || deal.demoFollowUpDate) {
      await prisma.meetingLog.create({
        data: {
          dealId: deal.id,
          attemptNumber: 3,
          meetingDate: deal.demoFollowUpDate ? new Date(deal.demoFollowUpDate) : null,
          meetingType: "Demo (from Deal)",
          outcome: deal.demoOutcome,
        },
      });
      migrated++;
    }
  }

  console.log(`\n✅ Migrated ${migrated} MeetingLog records from backup`);
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
