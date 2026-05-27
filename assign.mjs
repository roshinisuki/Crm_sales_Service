import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sophia = await prisma.user.findFirst({ where: { name: "Sophia Exec" } });
  if (sophia) {
    await prisma.customer.updateMany({
      where: { email: "roshinivenkatesan2610@gmail.com" },
      data: { assignedUserId: sophia.id }
    });
    console.log("Assigned Roshini to Sophia Exec.");
  }
}

main().finally(() => prisma.$disconnect());
