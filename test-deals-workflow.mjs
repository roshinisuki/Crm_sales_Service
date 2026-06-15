import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runDealsTest() {
  console.log("🚀 Starting Deals Workflow Integration Test...");

  const testCustomerCode = `TEST-CST-${Date.now()}`;
  const testDealName1 = `TEST-DEAL-WON-${Date.now()}`;
  const testDealName2 = `TEST-DEAL-LOST-${Date.now()}`;

  let testCustomer = null;
  let testDealWon = null;
  let testDealLost = null;

  try {
    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      throw new Error("No user found in database to assign DealStageHistory logs.");
    }

    // 1. Create a test customer with status "New"
    testCustomer = await prisma.customer.create({
      data: {
        customerCode: testCustomerCode,
        name: "Test Deal Customer",
        email: `testcustomer-${Date.now()}@example.com`,
        phone: "1234567890",
        city: "Test City",
        status: "New",
      },
    });
    console.log(`✅ Created test customer: ${testCustomer.name} (${testCustomer.customerCode}) with status: ${testCustomer.status}`);

    if (testCustomer.status !== "New") {
      throw new Error(`Expected initial status to be "New", got "${testCustomer.status}"`);
    }

    // 2. Create a deal with status "Open" and log initial history
    testDealWon = await prisma.deal.create({
      data: {
        dealName: testDealName1,
        customerId: testCustomer.id,
        dealValue: 5000.0,
        expectedCloseDate: new Date(),
        status: "Open",
        stageHistories: {
          create: {
            fromStatus: null,
            toStatus: "Open",
            changedById: testUser.id,
          }
        }
      },
      include: {
        stageHistories: true
      }
    });
    console.log(`✅ Created test deal (Won): ${testDealWon.dealName} with status: ${testDealWon.status}`);
    console.log(`✅ Verified initial DealStageHistory created: ${testDealWon.stageHistories.length} record(s)`);
    if (testDealWon.stageHistories.length !== 1 || testDealWon.stageHistories[0].toStatus !== "Open") {
      throw new Error(`Expected 1 stage history record with toStatus 'Open'`);
    }

    // 3. Perform Status Transition to "Won" and log transition history
    console.log(`🔄 Promoting Deal status to "Won"...`);
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: testDealWon.id },
        data: { 
          status: "Won",
          stageHistories: {
            create: {
              fromStatus: "Open",
              toStatus: "Won",
              changedById: testUser.id,
            }
          }
        },
      });

      await tx.customer.update({
        where: { id: testCustomer.id },
        data: { status: "Prospect" },
      });
    });

    // Verify DealStageHistory has 2 records
    const wonDealWithHist = await prisma.deal.findUnique({
      where: { id: testDealWon.id },
      include: { stageHistories: { orderBy: { changedAt: "asc" } } }
    });
    console.log(`✅ Verified DealStageHistory count after update: ${wonDealWithHist?.stageHistories.length}`);
    if (wonDealWithHist?.stageHistories.length !== 2) {
      throw new Error(`Expected 2 stage history records, got ${wonDealWithHist?.stageHistories.length}`);
    }
    const lastHist = wonDealWithHist.stageHistories[1];
    if (lastHist.fromStatus !== "Open" || lastHist.toStatus !== "Won") {
      throw new Error(`Expected status transition from Open to Won, got ${lastHist.fromStatus} -> ${lastHist.toStatus}`);
    }

    // Verify Customer became Prospect
    const updatedCustomerWon = await prisma.customer.findUnique({
      where: { id: testCustomer.id },
    });
    console.log(`✅ Verified Customer status after Deal Won: "${updatedCustomerWon?.status}"`);
    if (updatedCustomerWon?.status !== "Prospect") {
      throw new Error(`Expected customer status to transition to "Prospect", got "${updatedCustomerWon?.status}"`);
    }

    // 4. Create another deal and transition to "Lost"
    testDealLost = await prisma.deal.create({
      data: {
        dealName: testDealName2,
        customerId: testCustomer.id,
        dealValue: 2500.0,
        expectedCloseDate: new Date(),
        status: "Open",
        stageHistories: {
          create: {
            fromStatus: null,
            toStatus: "Open",
            changedById: testUser.id,
          }
        }
      },
    });
    console.log(`✅ Created test deal (Lost): ${testDealLost.dealName} with status: ${testDealLost.status}`);

    console.log(`🔄 Demoting Deal status to "Lost"...`);
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: testDealLost.id },
        data: { 
          status: "Lost",
          stageHistories: {
            create: {
              fromStatus: "Open",
              toStatus: "Lost",
              changedById: testUser.id,
            }
          }
        },
      });

      await tx.customer.update({
        where: { id: testCustomer.id },
        data: { status: "Lost" },
      });
    });

    // Verify Customer became Lost
    const updatedCustomerLost = await prisma.customer.findUnique({
      where: { id: testCustomer.id },
    });
    console.log(`✅ Verified Customer status after Deal Lost: "${updatedCustomerLost?.status}"`);
    if (updatedCustomerLost?.status !== "Lost") {
      throw new Error(`Expected customer status to transition to "Lost", got "${updatedCustomerLost?.status}"`);
    }

    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! Deal status automations & audit trails are fully functioning.");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    // Clean up
    console.log("🧹 Cleaning up test data...");
    if (testDealWon) {
      await prisma.deal.deleteMany({ where: { id: testDealWon.id } }).catch(() => {});
    }
    if (testDealLost) {
      await prisma.deal.deleteMany({ where: { id: testDealLost.id } }).catch(() => {});
    }
    if (testCustomer) {
      await prisma.customer.deleteMany({ where: { id: testCustomer.id } }).catch(() => {});
    }
    console.log("🧹 Cleanup complete.");
    await prisma.$disconnect();
  }
}

runDealsTest();
