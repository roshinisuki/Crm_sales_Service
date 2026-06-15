const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dealId = "8fc8d684-6666-4912-b1c4-13c219db5a6e";
  const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true
      }
    });
  console.log(deal.customer);
}

main().catch(console.error).finally(() => prisma.$disconnect());
