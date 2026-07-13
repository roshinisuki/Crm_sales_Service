/**
 * Backup script — reads columns that will be dropped by `prisma db push`
 * and saves them to backup/dropped-columns-backup.json
 *
 * Also migrates meeting/demo data into the new MeetingLog table where possible.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const backup = { timestamp: new Date().toISOString(), deals: [], opportunityDetails: [] };

  // ─── Backup Deal columns: demoFollowUpDate, demoOutcome ───
  console.log("Backing up Deal columns (demoFollowUpDate, demoOutcome)...");
  const deals = await prisma.$queryRawUnsafe(`
    SELECT id, demoFollowUpDate, demoOutcome
    FROM Deal
    WHERE demoFollowUpDate IS NOT NULL OR demoOutcome IS NOT NULL
  `);
  backup.deals = deals;
  console.log(`  Found ${deals.length} Deal rows with data`);

  // ─── Backup OpportunityDetail columns ───
  const odColumns = [
    "competitorInfo", "demoAttendees", "demoCompetitorName", "demoCustomerRating",
    "demoDate", "demoInterestLevel", "demoPresenter", "demoQuestionsRaised",
    "demoRejectionReason", "demoRejectionRemarks", "demoType",
    "meetingAgenda", "meetingDate", "meetingLocation", "meetingMode",
    "meetingOutcome", "meetingParticipants", "meetingStatus", "meetingType",
    "paymentTerms",
  ];
  console.log("Backing up OpportunityDetail columns...");
  const colList = odColumns.join(", ");
  const odRows = await prisma.$queryRawUnsafe(`
    SELECT id, dealId, ${colList}
    FROM OpportunityDetail
    WHERE ${odColumns.map((c) => `${c} IS NOT NULL`).join(" OR ")}
  `);
  backup.opportunityDetails = odRows;
  console.log(`  Found ${odRows.length} OpportunityDetail rows with data`);

  // ─── Write backup file ───
  const backupDir = join(__dirname, "..", "backup");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, "dropped-columns-backup.json");
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup saved to: ${backupPath}`);
  console.log(`  Deals: ${backup.deals.length} rows`);
  console.log(`  OpportunityDetails: ${backup.opportunityDetails.length} rows`);

  // ─── Migrate meeting data into MeetingLog ───
  console.log("\nMigrating meeting/demo data into MeetingLog table...");
  let migrated = 0;
  for (const od of odRows) {
    const hasMeeting = od.meetingDate || od.meetingType || od.meetingMode || od.meetingParticipants;
    const hasDemo = od.demoDate || od.demoType || od.demoPresenter || od.demoAttendees;

    if (hasMeeting) {
      await prisma.meetingLog.create({
        data: {
          dealId: od.dealId,
          attemptNumber: 1,
          meetingDate: od.meetingDate,
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
          meetingDate: od.demoDate,
          meetingType: od.demoType ? `Demo: ${od.demoType}` : "Demo",
          meetingMode: null,
          participants: od.demoAttendees,
          agenda: null,
          outcome: od.demoInterestLevel ? `Interest: ${od.demoInterestLevel}` : null,
          notes: od.demoQuestionsRaised || od.demoCustomerRating ? `Questions: ${od.demoQuestionsRaised || ""} Rating: ${od.demoCustomerRating || ""}` : null,
          rejectionReason: od.demoRejectionReason,
        },
      });
      migrated++;
    }
  }
  console.log(`  Migrated ${migrated} MeetingLog records`);

  // ─── Migrate Deal demo data ───
  let dealMigrated = 0;
  for (const deal of deals) {
    if (deal.demoOutcome || deal.demoFollowUpDate) {
      await prisma.meetingLog.create({
        data: {
          dealId: deal.id,
          attemptNumber: 3,
          meetingDate: deal.demoFollowUpDate,
          meetingType: "Demo (from Deal)",
          outcome: deal.demoOutcome,
        },
      });
      dealMigrated++;
    }
  }
  console.log(`  Migrated ${dealMigrated} Deal demo records`);

  console.log("\n✅ Backup and migration complete!");
  console.log("You can now safely run: npx prisma db push");
}

main()
  .catch((e) => {
    console.error("❌ Backup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
