import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixDuplicates() {
  console.log("Finding customers with duplicate emails...");
  const customers = await prisma.customer.findMany({
    where: { email: { not: null } },
    orderBy: { createdAt: 'asc' }
  });

  const seenEmails = new Set();
  let fixedCount = 0;

  for (const customer of customers) {
    if (!customer.email) continue;
    const lowerEmail = customer.email.toLowerCase();
    
    if (seenEmails.has(lowerEmail)) {
      const newEmail = `${customer.email.split('@')[0]}-dup-${customer.id.substring(0,4)}@${customer.email.split('@')[1]}`;
      console.log(`Fixing duplicate for ${customer.name}: ${customer.email} -> ${newEmail}`);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { email: newEmail }
      });
      fixedCount++;
    } else {
      seenEmails.add(lowerEmail);
    }
  }

  console.log(`Fixed ${fixedCount} duplicate emails.`);
}

fixDuplicates().finally(() => prisma.$disconnect());
