import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function testCreate() {
  try {
    const data = {
      email: "roshinivenkatesan2610-test2@gmail.com",
      name: "Roshini .V",
      passwordHash: "test",
      role: "Customer",
    };

    const newUser = await prisma.user.create({
      data: {
        ...data,
      },
    });
    console.log("Created user:", newUser);
  } catch (error) {
    console.error("Prisma error:", error);
  }
}

testCreate().finally(() => prisma.$disconnect());
