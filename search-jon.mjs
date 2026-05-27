import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { contains: "jon", mode: "insensitive" } }
  });
  const customers = await prisma.customer.findMany({
    where: { name: { contains: "jon", mode: "insensitive" } }
  });
  
  console.log("Users:", users.map(u => ({ name: u.name, role: u.role, userType: u.userType })));
  console.log("Customers:", customers.map(c => ({ name: c.name, email: c.email })));
}

main().finally(() => prisma.$disconnect());
