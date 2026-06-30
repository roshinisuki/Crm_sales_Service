import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({
    where: { name: "Sri Lakshmi Enterprises" }
  });
  if (!company) throw new Error("Company not found");

  const updates = [
    { old: "admin@srilakshmi.sukisoftware.com", new: "admin@sukisoftware.com" },
    { old: "manager@srilakshmi.sukisoftware.com", new: "manager@sukisoftware.com" },
    { old: "se1@srilakshmi.sukisoftware.com", new: "se1@sukisoftware.com" },
    { old: "se2@srilakshmi.sukisoftware.com", new: "se2@sukisoftware.com" },
  ];

  for (const u of updates) {
    try {
      const user = await prisma.user.findUnique({ where: { email: u.old } });
      if (user) {
        await prisma.user.update({ where: { email: u.old }, data: { email: u.new } });
        console.log(`✅ ${u.old} → ${u.new}`);
      } else {
        console.log(`⚠️  Not found: ${u.old}`);
      }
    } catch (e) {
      console.log(`❌ Failed ${u.old}: ${e.message?.slice(0, 80)}`);
    }
  }

  console.log("\nDone! Login with: admin@sukisoftware.com");
}

main().finally(() => prisma.$disconnect());
