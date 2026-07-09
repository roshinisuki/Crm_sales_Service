import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const defaultCompany = await prisma.company.findFirst();
  if (!defaultCompany) {
    console.log("No company found.");
    return;
  }

  const passwordHash = await bcrypt.hash("Password@123", 10);

  // SalesManager
  let manager = await prisma.user.findFirst({ where: { email: "lead@sukisoftware.com" } });
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        email: "lead@sukisoftware.com",
        name: "Demo Lead",
        role: "SalesManager",
        userType: "internal",
        passwordHash,
        isActive: true,
        isFirstLogin: false,
        companyId: defaultCompany.id,
        theme: "blue",
      }
    });
    console.log("Created SalesManager: lead@sukisoftware.com / Password@123");
  } else {
    await prisma.user.update({
      where: { id: manager.id },
      data: { passwordHash, isFirstLogin: false, isActive: true }
    });
    console.log("Reset SalesManager: lead@sukisoftware.com / Password@123");
  }

  // SalesExecutive
  let exec = await prisma.user.findFirst({ where: { email: "exec1@sukisoftware.com" } });
  if (!exec) {
    exec = await prisma.user.create({
      data: {
        email: "exec1@sukisoftware.com",
        name: "Demo Exec",
        role: "SalesExecutive",
        userType: "internal",
        passwordHash,
        isActive: true,
        isFirstLogin: false,
        companyId: defaultCompany.id,
        theme: "blue",
      }
    });
    console.log("Created SalesExecutive: exec1@sukisoftware.com / Password@123");
  } else {
    await prisma.user.update({
      where: { id: exec.id },
      data: { passwordHash, isFirstLogin: false, isActive: true }
    });
    console.log("Reset SalesExecutive: exec1@sukisoftware.com / Password@123");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
