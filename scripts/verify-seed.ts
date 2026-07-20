/**
 * Read-only verification for the DemoAdmin + variant demo seed data.
 * Run: npx tsx scripts/verify-seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, companyId: true },
    orderBy: { email: "asc" },
  });
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, variant: true },
    orderBy: { variant: "asc" },
  });
  const demoAdminPerm = await prisma.rolePermission.findMany({
    where: { role: "DemoAdmin" },
  });

  console.log("\n=== Users (" + users.length + ") ===");
  for (const u of users) console.log(`${u.email} | ${u.role} | companyId=${u.companyId}`);

  console.log("\n=== Companies (" + companies.length + ") ===");
  for (const c of companies) console.log(`${c.name} | variant=${c.variant} | id=${c.id}`);

  console.log("\n=== DemoAdmin RolePermission rows (" + demoAdminPerm.length + ") ===");
  for (const p of demoAdminPerm) console.log(p);

  console.log("\n=== Expected counts ===");
  console.log(`users=10 -> actual ${users.length} ${users.length === 10 ? "OK" : "MISMATCH"}`);
  console.log(`companies=4 -> actual ${companies.length} ${companies.length === 4 ? "OK" : "MISMATCH"}`);
  console.log(`demoAdminPermRows=1 -> actual ${demoAdminPerm.length} ${demoAdminPerm.length === 1 ? "OK" : "MISMATCH"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
