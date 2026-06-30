import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({ 
    where: { name: 'Sri Lakshmi Enterprises' } 
  });
  
  if (company) {
    console.log('Company EXISTS');
    console.log('ID:', company.id);
    console.log('Variant:', company.variant);
    console.log('Domain:', company.domain);
  } else {
    console.log('Company NOT FOUND');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
