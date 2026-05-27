import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.findUnique({
    where: { email: "roshinivenkatesan2610@gmail.com" },
    include: { subscriptions: true }
  });
  console.log("Customer:", customer?.name);
  console.log("Subscriptions:", customer?.subscriptions);
}

main().finally(() => prisma.$disconnect());
