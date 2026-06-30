import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const emails = ['admin@sukisoftware.com','manager@sukisoftware.com','se1@sukisoftware.com','se2@sukisoftware.com'];

const users = await prisma.user.findMany({
  where: { email: { in: emails } },
  select: { email: true, role: true, companyId: true }
});

users.forEach(u => console.log(u.email, '-', u.companyId));
await prisma.$disconnect();
