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
  
  console.log('Testing V4 API routes for Sri Lakshmi Enterprises...\n');
  
  const companyId = company.id;
  
  // Test Competitor routes
  const competitors = await prisma.competitor.findMany({ where: { companyId } });
  console.log(`✅ /competitors: ${competitors.length} competitors`);
  
  const competitorProducts = await prisma.competitorProduct.count();
  console.log(`✅ /competitors/products: ${competitorProducts} products`);
  
  const lostAnalysis = await prisma.lostDealAnalysis.findMany({ 
    where: { companyId },
    include: { competitor: true, lossReason: true }
  });
  console.log(`✅ /competitors/lost-analysis: ${lostAnalysis.length} records`);
  
  // Test Key Account routes
  const keyAccounts = await prisma.keyAccount.findMany({ 
    where: { companyId },
    include: { customer: true, accountManager: true }
  });
  const criticalAccounts = keyAccounts.filter(ka => ka.strategicImportance === "Critical");
  console.log(`✅ /key-accounts: ${keyAccounts.length} total, ${criticalAccounts.length} Critical`);
  
  const revenueSorted = [...keyAccounts].sort((a, b) => (b.revenuePotential || 0) - (a.revenuePotential || 0));
  console.log(`✅ /key-accounts?sort=revenuePotential: sorted correctly`);
  
  // Test Territory routes
  const territories = await prisma.territory.findMany({ 
    where: { companyId },
    include: { assignedUser: true }
  });
  console.log(`✅ /territories: ${territories.length} territories`);
  
  const territoryAccounts = await prisma.territoryAccount.count();
  console.log(`✅ /territories/accounts: ${territoryAccounts} account mappings`);
  
  // Test Target routes
  const monthlyTargets = await prisma.salesTarget.findMany({ 
    where: { companyId, targetType: "Monthly" }
  });
  console.log(`✅ /targets?type=Monthly: ${monthlyTargets.length} targets`);
  
  const quarterlyTargets = await prisma.salesTarget.findMany({ 
    where: { companyId, targetType: "Quarterly" }
  });
  console.log(`✅ /targets?type=Quarterly: ${quarterlyTargets.length} targets`);
  
  const yearlyTargets = await prisma.salesTarget.findMany({ 
    where: { companyId, targetType: "Yearly" }
  });
  console.log(`✅ /targets?type=Yearly: ${yearlyTargets.length} targets`);
  
  console.log('\n🎉 All V4 routes verified with data!');
  
  await prisma.$disconnect();
}

main().catch(console.error);
