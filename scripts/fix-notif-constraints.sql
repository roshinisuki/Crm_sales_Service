IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailFollowUpReminders_df')
  ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailFollowUpReminders_df];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailVisitReminders_df')
  ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailVisitReminders_df];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_emailSystemAlerts_df')
  ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_emailSystemAlerts_df];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_pushNotifications_df')
  ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_pushNotifications_df];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'NotificationPreference_createdAt_df')
  ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [NotificationPreference_createdAt_df];

IF COL_LENGTH('[dbo].[NotificationPreference]','emailFollowUpReminders') IS NOT NULL
  ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailFollowUpReminders];

IF COL_LENGTH('[dbo].[NotificationPreference]','emailVisitReminders') IS NOT NULL
  ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailVisitReminders];

IF COL_LENGTH('[dbo].[NotificationPreference]','emailSystemAlerts') IS NOT NULL
  ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [emailSystemAlerts];

IF COL_LENGTH('[dbo].[NotificationPreference]','pushNotifications') IS NOT NULL
  ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [pushNotifications];
