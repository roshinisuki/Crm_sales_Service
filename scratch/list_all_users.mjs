import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, companyId: true }
  });
  
  console.log('Existing users:');
  if (users.length === 0) {
    console.log('  NONE');
  } else {
    users.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) - Role: ${u.role} - CompanyId: ${u.companyId}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
