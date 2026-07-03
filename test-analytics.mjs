import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Let's find a SalesManager user
  const manager = await prisma.user.findFirst({
    where: { role: "SalesManager", isActive: true }
  });

  if (!manager) {
    console.log("No SalesManager found!");
    return;
  }

  console.log("Found SalesManager:", manager.email);

  // We mock verifyAuth to return this manager
  // Let's run a query to mimic the action's behavior
  const rbacCustomerFilter = { companyId: manager.companyId };
  const rbacDealFilter = { companyId: manager.companyId };

  const customersBySource = await prisma.customer.groupBy({
    by: ["leadSource"],
    _count: { id: true },
    where: rbacCustomerFilter
  });

  console.log("customersBySource:", customersBySource);

  const wonDealsWithSource = await prisma.deal.findMany({
    where: {
      AND: [
        rbacDealFilter,
        { status: "Won" }
      ]
    },
    include: {
      customer: { select: { leadSource: true } }
    }
  });

  const sourceValueMap = {};
  const sourceWonCountMap = {};

  wonDealsWithSource.forEach((d) => {
    const source = d.customer?.leadSource || "Unknown";
    sourceValueMap[source] = (sourceValueMap[source] || 0) + d.dealValue;
    sourceWonCountMap[source] = (sourceWonCountMap[source] || 0) + 1;
  });

  const sourceAnalytics = customersBySource.map((s) => {
    const sourceName = s.leadSource || "Unknown";
    const totalLeadsForSource = s._count.id;
    const wonCount = sourceWonCountMap[sourceName] || 0;
    const totalRevenue = sourceValueMap[sourceName] || 0;
    const convRate = totalLeadsForSource > 0 ? Math.round((wonCount / totalLeadsForSource) * 100) : 0;

    return {
      source: sourceName,
      count: totalLeadsForSource,
      revenue: totalRevenue,
      conversionRate: convRate
    };
  });

  console.log("sourceAnalytics result:", sourceAnalytics);
}

main().finally(() => prisma.$disconnect());
