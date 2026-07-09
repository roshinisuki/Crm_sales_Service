import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exec1 = await prisma.user.findUnique({ where: { email: 'executive@sukisoftware.com' } });
  const exec2 = await prisma.user.findUnique({ where: { email: 'executive2@sukisoftware.com' } });

  if (!exec1 || !exec2) {
    console.error('Executive users not found');
    return;
  }

  // Get active leads
  const leads = await prisma.lead.findMany({ where: { deletedAt: null } });
  console.log(`Found ${leads.length} leads. Splitting ownership...`);
  
  for (let i = 0; i < leads.length; i++) {
    const assignedUserId = i % 2 === 0 ? exec1.id : exec2.id;
    await prisma.lead.update({
      where: { id: leads[i].id },
      data: { assignedUserId }
    });
  }

  // Get active customers
  const customers = await prisma.customer.findMany({ where: { deletedAt: null } });
  console.log(`Found ${customers.length} customers. Splitting ownership...`);

  for (let i = 0; i < customers.length; i++) {
    const assignedUserId = i % 2 === 0 ? exec1.id : exec2.id;
    await prisma.customer.update({
      where: { id: customers[i].id },
      data: { assignedUserId }
    });
  }

  console.log('Ownership split complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
