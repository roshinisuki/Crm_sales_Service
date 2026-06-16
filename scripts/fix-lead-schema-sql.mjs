import { PrismaClient } from '@prisma/client';
import { randomUUID as uuidv4 } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Step 1: Truncating existing leads...');
  await prisma.$executeRawUnsafe('DELETE FROM [Lead]');
  console.log('  Cleared.');

  console.log('Step 2: Adding [name] column...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE [Lead] ADD [name] NVARCHAR(1000) NOT NULL DEFAULT 'Unknown'
    `);
    console.log('  Added name column.');
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log('  name column already exists.');
    } else {
      throw e;
    }
  }

  console.log('Step 3: Dropping orphaned old columns...');
  const oldColumns = ['companyName', 'contactPerson', 'followUpDate', 'lastActivityDate'];
  for (const col of oldColumns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE [Lead] DROP COLUMN [${col}]`);
      console.log(`  Dropped ${col}.`);
    } catch (e) {
      console.log(`  ${col} not found or already dropped.`);
    }
  }

  console.log('Step 4: Re-seeding 12 leads...');
  const now = new Date();
  const execs = await prisma.user.findMany({
    where: { role: 'SalesExecutive' },
    select: { id: true }
  });

  const leadNames = [
    'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince',
    'Evan Wright', 'Fiona Green', 'George Hall', 'Hannah Scott',
    'Ian Adams', 'Julia Baker', 'Kevin Clark', 'Laura Davis'
  ];
  const leadStatuses = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const leadSources = ['Website', 'Referral', 'SocialMedia', 'Email', 'Event', 'ColdCall', 'Partner', 'Other'];

  for (let i = 0; i < leadNames.length; i++) {
    const exec = execs[i % execs.length];
    const slaDeadline = new Date(now.getTime() + 15 * 60 * 1000);
    await prisma.lead.create({
      data: {
        id: uuidv4(),
        leadCode: `LEAD-${String(i + 1).padStart(4, '0')}`,
        name: leadNames[i],
        email: `lead${i + 1}@example.com`,
        phone: `555-300${i}`,
        city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
        status: leadStatuses[i % leadStatuses.length],
        assignedUserId: exec.id,
        leadSource: leadSources[i % leadSources.length],
        notes: 'Sample lead created via seed script.',
        slaStatus: 'Pending',
        slaResponseDeadline: slaDeadline,
        lastInteractionAt: now,
        escalationLevel: 0,
      },
    });
  }

  const count = await prisma.lead.count();
  console.log(`\n  ${count} leads re-seeded.`);
  console.log('\nDone. Refresh the /leads page.');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
