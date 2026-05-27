import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany();
  console.log("Total customers:", customers.length);
  const roshini = customers.find(c => c.email === "roshinivenkatesan2610@gmail.com");
  console.log("Roshini customer:", roshini);
}

main().finally(() => prisma.$disconnect());
