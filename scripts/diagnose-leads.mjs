import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leadCount = await prisma.lead.count();
  console.log(`Total leads in DB: ${leadCount}`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, companyId: true }
  });
  console.log('\nUsers:');
  users.forEach(u => console.log(`  ${u.email} | role=${u.role} | companyId=${u.companyId}`));

  if (leadCount > 0) {
    const leads = await prisma.lead.findMany({
      take: 3,
      select: { id: true, leadCode: true, name: true, companyId: true, status: true, assignedUserId: true, deletedAt: true }
    });
    console.log('\nSample leads:');
    leads.forEach(l => console.log(`  ${l.leadCode} | ${l.name} | companyId=${l.companyId} | status=${l.status} | deletedAt=${l.deletedAt}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
