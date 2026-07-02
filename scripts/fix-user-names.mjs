/**
 * Fix company-name repetition bug in existing user records.
 *
 * The seed-complete.ts file created users with names like:
 *   "Admin Suki Software Solutions Pvt. Ltd."
 *   "Manager Suki Software Solutions Pvt. Ltd."
 *   "Executive 1 Suki Software Solutions Pvt. Ltd."
 *
 * This script strips the company-name suffix from all user.name fields.
 *
 * Run: node scripts/fix-user-names.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing user names with company-name suffix...\n");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });

  let fixed = 0;
  for (const u of users) {
    // Match patterns like "Admin <CompanyName>", "Manager <CompanyName>", "Executive N <CompanyName>"
    const match = u.name.match(/^(Admin|Manager|Executive \d+|Super Admin)\s+(.+)$/);
    if (match) {
      const cleanName = match[1].replace("Manager", "Sales Manager").replace("Executive", "Sales Executive");
      console.log(`  ${u.email}: "${u.name}" → "${cleanName}"`);
      await prisma.user.update({ where: { id: u.id }, data: { name: cleanName } });
      fixed++;
    }
  }

  console.log(`\n✅ Fixed ${fixed} user records out of ${users.length} total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
