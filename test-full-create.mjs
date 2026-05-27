import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function testCreate() {
  try {
    const data = {
      customerCode: `CST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: "Roshini .V",
      email: "roshinivenkatesan2610@gmail.com",
      phone: "06385940921",
      city: "Hosur",
      status: "Prospect",
    };

    let { customerCode, name, email, phone, city, status, assignedUserId } = data;

    if (email) {
      const existingEmail = await prisma.customer.findUnique({
        where: { email },
      });
      if (existingEmail) {
        console.log("Customer email exists", existingEmail);
        return;
      }
    }

    const newCustomer = await prisma.customer.create({
      data: {
        customerCode,
        name,
        email,
        phone,
        city,
        status: status || "Active",
        assignedUserId: null,
      },
    });

    console.log("Customer created:", newCustomer);

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash("Welcome@123", 10);
        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "Customer",
          },
        });
        console.log("User created");
      } else {
        console.log("User already exists", existingUser.email);
      }
    }

  } catch (error) {
    console.error("Caught Error:", error);
  }
}

testCreate().finally(() => prisma.$disconnect());
