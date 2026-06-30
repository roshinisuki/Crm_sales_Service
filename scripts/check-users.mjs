import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({ 
    where: { name: 'Sri Lakshmi Enterprises' } 
  });
  
  if (!company) {
    console.log('Company NOT FOUND');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Company:', company.name, 'ID:', company.id);
  
  const users = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, email: true, role: true }
  });
  
  console.log('\nExisting users:');
  if (users.length === 0) {
    console.log('  NONE');
  } else {
    users.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) - ${u.role}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
