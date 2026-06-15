import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Drop the default constraints on the old columns so db push can alter them
  const statements = [
    // Drop defaults on old columns (may or may not exist)
    `IF OBJECT_ID('NotificationPreference_emailFollowUpReminders_df') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailFollowUpReminders_df]`,
    `IF OBJECT_ID('NotificationPreference_emailVisitReminders_df') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailVisitReminders_df]`,
    `IF OBJECT_ID('NotificationPreference_emailSystemAlerts_df') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailSystemAlerts_df]`,
    `IF OBJECT_ID('NotificationPreference_pushNotifications_df') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_pushNotifications_df]`,
    `IF OBJECT_ID('NotificationPreference_createdAt_df') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_createdAt_df]`,
    // Drop the old columns if they exist
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailFollowUpReminders') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailFollowUpReminders]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailVisitReminders') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailVisitReminders]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailSystemAlerts') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailSystemAlerts]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','pushNotifications') IS NOT NULL
       ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [pushNotifications]`,
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK:', sql.substring(0, 60).trim());
    } catch (e: any) {
      console.warn('SKIP (already gone or not needed):', e.message?.substring(0, 80));
    }
  }

  console.log('\nDone. Now run: npx prisma db push --accept-data-loss');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
