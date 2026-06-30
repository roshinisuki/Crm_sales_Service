import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({
    where: { name: "Sri Lakshmi Enterprises" }
  });
  
  if (!company) {
    console.log('Company NOT FOUND');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Company:', company.name, 'ID:', company.id);
  
  const companyId = company.id;
  
  // Count V4 data
  const lossReasons = await prisma.lossReason.count({ where: { companyId } });
  const competitors = await prisma.competitor.count({ where: { companyId } });
  const competitorProducts = await prisma.competitorProduct.count();
  const lostDealAnalysis = await prisma.lostDealAnalysis.count({ where: { companyId } });
  const territories = await prisma.territory.count({ where: { companyId } });
  const territoryAccounts = await prisma.territoryAccount.count();
  const salesTargets = await prisma.salesTarget.count({ where: { companyId } });
  const keyAccounts = await prisma.keyAccount.count({ where: { companyId } });
  const customers = await prisma.customer.count({ where: { companyId } });
  const deals = await prisma.deal.count({ where: { companyId } });
  
  console.log('\nV4 Data Counts:');
  console.log(`  Loss Reasons: ${lossReasons}`);
  console.log(`  Competitors: ${competitors}`);
  console.log(`  Competitor Products: ${competitorProducts}`);
  console.log(`  Lost Deal Analysis: ${lostDealAnalysis}`);
  console.log(`  Territories: ${territories}`);
  console.log(`  Territory Accounts: ${territoryAccounts}`);
  console.log(`  Sales Targets: ${salesTargets}`);
  console.log(`  Key Accounts: ${keyAccounts}`);
  console.log(`  Customers: ${customers}`);
  console.log(`  Deals: ${deals}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
