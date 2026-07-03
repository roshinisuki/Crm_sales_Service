import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const allLeads = await prisma.lead.findMany({
    select: { id: true, leadSource: true, companyId: true }
  });
  console.log("All leads count:", allLeads.length);
  console.log("Leads with null/empty/unknown source:", allLeads.filter(l => !l.leadSource || l.leadSource.toLowerCase() === "unknown"));

  const allCustomers = await prisma.customer.findMany({
    select: { id: true, leadSource: true, companyId: true }
  });
  console.log("All customers count:", allCustomers.length);
  console.log("Customers with null/empty/unknown source:", allCustomers.filter(c => !c.leadSource || c.leadSource.toLowerCase() === "unknown"));

  const allDeals = await prisma.deal.findMany({
    include: { customer: true }
  });
  console.log("All deals count:", allDeals.length);
  console.log("Deals with customer null/empty/unknown source:", allDeals.filter(d => !d.customer?.leadSource || d.customer.leadSource.toLowerCase() === "unknown").map(d => ({ id: d.id, source: d.customer?.leadSource })));
}

main().finally(() => prisma.$disconnect());
