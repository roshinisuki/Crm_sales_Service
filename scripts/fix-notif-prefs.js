// CommonJS script to drop old NotificationPreference constraints + columns
const sql = require('mssql');

const config = {
  server: '192.168.1.160',
  port: 1433,
  database: 'suki_crm',
  user: 'sukicrm',
  password: 'sukicrm@123',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function main() {
  const pool = await sql.connect(config);

  const statements = [
    // Drop default constraints on old columns
    `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailFollowUpReminders_df') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailFollowUpReminders_df]`,
    `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailVisitReminders_df') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailVisitReminders_df]`,
    `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailSystemAlerts_df') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailSystemAlerts_df]`,
    `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_pushNotifications_df') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_pushNotifications_df]`,
    `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_createdAt_df') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_createdAt_df]`,
    // Drop old columns if they exist
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailFollowUpReminders') IS NOT NULL ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailFollowUpReminders]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailVisitReminders') IS NOT NULL ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailVisitReminders]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','emailSystemAlerts') IS NOT NULL ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailSystemAlerts]`,
    `IF COL_LENGTH('[dbo].[NotificationPreference]','pushNotifications') IS NOT NULL ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [pushNotifications]`,
  ];

  for (const stmt of statements) {
    try {
      await pool.request().query(stmt);
      console.log('OK:', stmt.substring(0, 70));
    } catch (e) {
      console.warn('ERR:', e.message.substring(0, 100));
    }
  }

  await pool.close();
  console.log('\nDone. Now run: npx prisma db push --accept-data-loss');
}

main().catch(e => { console.error(e); process.exit(1); });
