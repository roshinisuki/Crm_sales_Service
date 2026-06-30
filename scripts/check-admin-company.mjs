import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'admin@sukisoftware.com' },
  include: { company: true }
});

console.log('Company:', user?.company?.name);
console.log('Company ID:', user?.company?.id);
console.log('Variant:', user?.company?.variant);
console.log('Domain:', user?.company?.domain);

const users = await prisma.user.findMany({
  where: { companyId: user?.company?.id },
  select: { email: true, role: true, name: true }
});
console.log('\nAll users in this company:');
users.forEach(u => console.log(' -', u.role, u.email));

const custCount = await prisma.customer.count({ where: { companyId: user?.company?.id } });
const dealCount = await prisma.deal.count({ where: { companyId: user?.company?.id } });
console.log('\nCustomers:', custCount, '| Deals:', dealCount);

await prisma.$disconnect();
