import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

async function main() {
  // Find the assigned user of the deal
  const user = await prisma.user.findUnique({
    where: { id: "08b03b84-6af7-4764-a886-f82e5b61f950" },
    select: { id: true, email: true, role: true, companyId: true },
  });
  console.log("User:", JSON.stringify(user, null, 2));

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyId: user.companyId, variant: user.variant || 1 },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  console.log("\nTOKEN=" + token);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
