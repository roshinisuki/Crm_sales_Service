import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Lead'
    ORDER BY ORDINAL_POSITION
  `;
  console.log('Current Lead columns:');
  cols.forEach(c => console.log(`  ${c.COLUMN_NAME}: ${c.DATA_TYPE} (nullable=${c.IS_NULLABLE})`));
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
