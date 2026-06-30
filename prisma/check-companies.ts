import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, variant: true }
  });
  
  console.log('Companies in database:');
  console.table(companies);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
