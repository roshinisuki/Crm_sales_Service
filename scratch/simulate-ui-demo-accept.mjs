import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  console.log("Creating fresh opportunity...");
  
  // Find a test customer and user
  const customer = await prisma.customer.findFirst();
  const user = await prisma.user.findFirst({ where: { role: "SalesExecutive" } });
  
  // 1. Create a fresh opportunity
  const deal = await prisma.deal.create({
    data: {
      dealName: "Manual UI Simulation Deal",
      opportunityCode: `TEST-UI-${Date.now()}`,
      customerId: customer.id,
      assignedUserId: user.id,
      companyId: user.companyId,
      status: "RequirementGathering",
      probabilityPercent: 10,
      dealValue: 5000,
      expectedCloseDate: new Date(),
    }
  });

  // 2. Add requirement item
  await prisma.opportunityRequirementItem.create({
    data: {
      dealId: deal.id,
      productName: "Test Widget",
      estimatedQuantity: 100,
      targetPriceMin: 50,
      targetPriceMax: 100,
    }
  });
  
  // Add technical note so it's "Feasible"
  const reqItem = await prisma.opportunityRequirementItem.findFirst({ where: { dealId: deal.id } });
  await prisma.opportunityTechnicalNote.create({
    data: {
      requirementItem: { connect: { id: reqItem.id } },
      feasibility: "Feasible",
      confirmedSpec: "Standard test widget",
      engineer: { connect: { id: user.id } },
    }
  });

  // 3. Move to MeetingScheduled
  await prisma.deal.update({
    where: { id: deal.id },
    data: { status: "MeetingScheduled", probabilityPercent: 40 }
  });
  await prisma.opportunityDetail.create({
    data: {
      dealId: deal.id,
      meetingDate: new Date(),
      meetingType: "Online",
      meetingStatus: "Held"
    }
  });

  // --- BEGIN UI SIMULATION ---
  console.log("\n--- SIMULATING UI TRANSITION ---");

  // Step A: User clicks "Move to Demo Conducted" (without setting outcome yet)
  console.log("1. UI: Moving to Demo Conducted...");
  // Simulate the backend logic for cross-stage transition.
  // Instead of importing typescript which needs ts-node, we'll just simulate what the backend does.
  await prisma.deal.update({
    where: { id: deal.id },
    data: { status: "DemoConducted", probabilityPercent: 60 } // targetStage = DemoConducted
  });
  // This is what transitionDealStatus does:
  const dealWithDetails = await prisma.deal.findUnique({
    where: { id: deal.id },
    include: {
      customer: true,
      opportunityDetail: true,
      requirementItems: {
        include: { technicalNote: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    }
  });
  
  // Simulate what the UI sends as 'ctx.reason' (usually standard transition notes)
  // Sometimes it's undefined, but what if they entered "Terms accepted"?
  const reason = "Proceeding. Terms accepted.";
  
  const demoAccepted = dealWithDetails.demoOutcome === "Accepted" ||
      (reason?.toLowerCase().includes("accepted") ?? false);
      
  if (demoAccepted) {
      let existingRfq = await prisma.rFQ.findFirst({ where: { opportunityId: deal.id } });
      if (!existingRfq) {
          console.log("-> Ghost RFQ created early by dealService.ts!");
          const allItems = dealWithDetails.requirementItems || [];
          await prisma.rFQ.create({
              data: {
                  rfqCode: `RFQ-EARLY-${Date.now()}`,
                  customerId: dealWithDetails.customerId,
                  opportunityId: deal.id,
                  status: "New",
                  companyId: user.companyId,
                  // In the base branch, there were NO line items here! But in Phase 1 I added them.
                  // Let's assume the user was on the codebase AFTER Phase 1.
                  // If they are after Phase 1, it WILL include line items if requirementItems exist.
                  lineItems: {
                      create: allItems.map((item, idx) => ({
                          itemDescription: item.productName,
                          quantity: item.estimatedQuantity || 1,
                          displayOrder: idx,
                          quantityBreaks: { create: [{ quantity: item.estimatedQuantity || 1 }] }
                      }))
                  }
              }
          });
      }
  }
  
  // Let's check RFQ state NOW (between the two clicks)
  let rfq = await prisma.rFQ.findFirst({ where: { opportunityId: deal.id }, include: { lineItems: true } });
  console.log("State after transition to DemoConducted:");
  console.log(`- RFQ Exists: ${!!rfq}`);
  if (rfq) {
    console.log(`- RFQ Status: ${rfq.status}`);
    console.log(`- RFQ Line Items: ${rfq.lineItems.length}`);
  }

  // Step B: User fills out Demo Summary and clicks Save.
  console.log("\n2. UI: Saving Demo Outcome as 'Accepted'...");
  
  await prisma.deal.update({
    where: { id: deal.id },
    data: { demoOutcome: "Accepted" }
  });
  
  // Simulate createRFQWithLineItems helper from stage-change/route.ts
  const latestDeal = await prisma.deal.findUnique({
    where: { id: deal.id },
    include: { requirementItems: { include: { technicalNote: true } } }
  });
  
  const existingRfq = await prisma.rFQ.findFirst({ where: { opportunityId: deal.id } });
  if (!existingRfq) {
    const allItems = latestDeal.requirementItems || [];
    await prisma.rFQ.create({
      data: {
        rfqCode: `RFQ-FINAL-${Date.now()}`,
        customerId: latestDeal.customerId,
        opportunityId: latestDeal.id,
        status: "New",
        companyId: user.companyId,
        lineItems: {
          create: allItems.map((item, idx) => ({
            itemDescription: item.productName,
            quantity: item.estimatedQuantity || 1,
            displayOrder: idx,
            quantityBreaks: { create: [{ quantity: item.estimatedQuantity || 1 }] }
          }))
        }
      }
    });
  } else {
    console.log("-> stage-change/route.ts found existing RFQ, returning early without creating items!");
  }
  
  // Final RFQ state
  rfq = await prisma.rFQ.findFirst({ where: { opportunityId: deal.id }, include: { lineItems: true } });
  console.log("\nFINAL STATE:");
  console.log(`- RFQ Status: ${rfq.status}`);
  console.log(`- RFQ Line Items Count: ${rfq.lineItems.length}`);
  
  await prisma.$disconnect();
}

run().catch(console.error);
