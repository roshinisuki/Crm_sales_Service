import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  console.log('Step 1: Removing existing leads (seed data, no real loss)...');
  await prisma.lead.deleteMany({});
  console.log('  Leads cleared.');

  console.log('Step 2: Syncing Prisma schema to database (prisma db push)...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    console.log('  Schema synced.');
  } catch (e) {
    console.error('  db push failed, continuing...');
  }

  console.log('Step 3: Re-seeding leads with the corrected schema...');
  const { randomUUID: uuidv4 } = await import('crypto');
  const now = new Date();

  const execs = await prisma.user.findMany({
    where: { role: 'SalesExecutive' },
    select: { id: true, name: true }
  });

  if (execs.length === 0) {
    console.error('No SalesExecutive users found. Cannot seed leads.');
    process.exit(1);
  }

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
  console.log(`  ${count} leads re-seeded successfully.`);
  console.log('\nDone. Refresh the /leads page in your browser.');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
