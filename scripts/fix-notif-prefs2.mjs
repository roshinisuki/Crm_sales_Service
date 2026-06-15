import { PrismaClient } from '../node_modules/.prisma/client/default.js';

const prisma = new PrismaClient();

async function runSql(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
    return true;
  } catch (e) {
    console.warn('  SKIP:', e.message.slice(0, 120));
    return false;
  }
}

async function main() {
  console.log('Dropping old NotificationPreference default constraints...');

  // Drop each default constraint individually
  const constraints = [
    'NotificationPreference_emailFollowUpReminders_df',
    'NotificationPreference_emailVisitReminders_df',
    'NotificationPreference_emailSystemAlerts_df',
    'NotificationPreference_pushNotifications_df',
    'NotificationPreference_createdAt_df',
  ];

  for (const c of constraints) {
    const ok = await runSql(
      `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = '${c}') ALTER TABLE [dbo].[NotificationPreference] DROP CONSTRAINT [${c}]`
    );
    if (ok) console.log('  Dropped constraint:', c);
  }

  // Drop old columns if they still exist
  const cols = ['emailFollowUpReminders', 'emailVisitReminders', 'emailSystemAlerts', 'pushNotifications'];
  for (const col of cols) {
    const ok = await runSql(
      `IF COL_LENGTH('[dbo].[NotificationPreference]','${col}') IS NOT NULL ALTER TABLE [dbo].[NotificationPreference] DROP COLUMN [${col}]`
    );
    if (ok) console.log('  Dropped column:', col);
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
