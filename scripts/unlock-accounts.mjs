import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      lockedUntil: { gt: new Date() }
    },
    data: {
      loginAttempts: 0,
      lockedUntil: null
    }
  });
  console.log(`Unlocked ${result.count} account(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
