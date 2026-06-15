const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deal = await prisma.deal.findFirst({
    where: {
      status: {
        in: ['SalesOpportunity', 'RequirementGathering']
      }
    }
  });

  if (!deal) {
    console.log("No suitable deal found to seed.");
    return;
  }

  console.log(`Found deal: ${deal.dealName} (${deal.id})`);

  // Update or create opportunity detail with mandatory requirement fields
  const detail = await prisma.opportunityDetail.upsert({
    where: { dealId: deal.id },
    update: {
      budgetRange: "₹5,00,000+",
      timeline: "1 Month",
      decisionMaker: "John Smith (CEO)",
      modulesRequired: JSON.stringify(["Leads Management", "Sales Pipeline", "Reports & Analytics"]),
      painPointsList: JSON.stringify(["No CRM System", "Manual Excel Tracking"]),
      userCountSales: 15,
      currentChallenges: "Using Excel and WhatsApp for all sales tracking."
    },
    create: {
      dealId: deal.id,
      budgetRange: "₹5,00,000+",
      timeline: "1 Month",
      decisionMaker: "John Smith (CEO)",
      modulesRequired: JSON.stringify(["Leads Management", "Sales Pipeline", "Reports & Analytics"]),
      painPointsList: JSON.stringify(["No CRM System", "Manual Excel Tracking"]),
      userCountSales: 15,
      currentChallenges: "Using Excel and WhatsApp for all sales tracking."
    }
  });

  // Update deal status to PreSalesReview
  await prisma.deal.update({
    where: { id: deal.id },
    data: { status: 'PreSalesReview' }
  });

  console.log(`Successfully updated Deal ID ${deal.id} to PreSalesReview stage with seeded requirement data!`);
}

main().finally(() => prisma.$disconnect());
