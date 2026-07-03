import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const leadSources = await prisma.leadSource.findMany();
  console.log("DB LeadSources:", leadSources);

  const leadsGrouped = await prisma.lead.groupBy({
    by: ['leadSource'],
    _count: { id: true }
  });
  console.log("Leads grouped by source:", leadsGrouped);

  const customersGrouped = await prisma.customer.groupBy({
    by: ['leadSource'],
    _count: { id: true }
  });
  console.log("Customers grouped by source:", customersGrouped);

  const nullLeads = await prisma.lead.count({ where: { leadSource: "" } });
  const nullCustomers = await prisma.customer.count({ where: { leadSource: null } });
  console.log("Leads with empty source string:", nullLeads);
  console.log("Customers with null source:", nullCustomers);
}

main().finally(() => prisma.$disconnect());
