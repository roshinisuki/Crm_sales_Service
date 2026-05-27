import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testCreate() {
  try {
    const data = {
      customerCode: `CST-5665`,
      name: "Roshini .V",
      email: "roshinivenkatesan2610@gmail.com",
      phone: "06385940921",
      city: "Hosur",
      status: "Prospect",
    };

    const existingEmail = await prisma.customer.findUnique({
      where: { email: data.email },
    });
    console.log("existingEmail check:", existingEmail);

    const newCustomer = await prisma.customer.create({
      data: {
        ...data,
      },
    });
    console.log("Created customer:", newCustomer);
  } catch (error) {
    console.error("Prisma error:", error);
  }
}

testCreate().finally(() => prisma.$disconnect());
