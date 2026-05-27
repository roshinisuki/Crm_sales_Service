import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLoginType(email) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
    });
    console.log("Found user:", user);
  } catch (err) {
    console.error("Error:", err);
  }
}

checkLoginType("admin@sukisoftware.com").finally(() => prisma.$disconnect());
