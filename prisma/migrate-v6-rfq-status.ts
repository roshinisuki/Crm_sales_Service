import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting RFQ status migration...');

  // Update existing QuotationCreated RFQs -> CostingCompleted
  const updatedRfqs = await prisma.rFQ.updateMany({
    where: { status: 'QuotationCreated' },
    data: { status: 'CostingCompleted' },
  });
  console.log(`Updated ${updatedRfqs.count} RFQs.`);

  // Update RFQStatusHistory entries
  const updatedHistoryTo = await prisma.rFQStatusHistory.updateMany({
    where: { toStatus: 'QuotationCreated' },
    data: { toStatus: 'CostingCompleted' },
  });
  console.log(`Updated ${updatedHistoryTo.count} history entries (toStatus).`);

  const updatedHistoryFrom = await prisma.rFQStatusHistory.updateMany({
    where: { fromStatus: 'QuotationCreated' },
    data: { fromStatus: 'CostingCompleted' },
  });
  console.log(`Updated ${updatedHistoryFrom.count} history entries (fromStatus).`);

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
