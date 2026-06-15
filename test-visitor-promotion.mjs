import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runVisitorPromotionTest() {
  console.log("🚀 Starting Visitor Promotion & Config-based Auto-Assignment Test...");

  const testEmail = `test-visitor-${Date.now()}@example.com`;
  const testPhone = `999-${Math.floor(1000 + Math.random() * 9000)}`;
  const testName = `Walkin Guest ${Date.now()}`;

  let visitorId = null;
  let createdCustomerCode = null;

  try {
    // 1. Get first active host user
    const hostUser = await prisma.user.findFirst({
      where: { isActive: true }
    });

    if (!hostUser) {
      throw new Error("No active users found to run visitor test.");
    }

    // Create a temporary visitor record
    const visitor = await prisma.visitor.create({
      data: {
        visitorName: testName,
        visitorEmail: testEmail,
        visitorPhone: testPhone,
        company: "Test Corp",
        purpose: "Demo",
        hostUserId: hostUser.id,
        inTime: new Date()
      }
    });

    visitorId = visitor.id;
    console.log(`✅ Created test visitor: ${testName} (ID: ${visitorId})`);

    // 2. Set SystemConfig to DEFAULT_POOL mode pointing to our host user
    await prisma.systemConfig.upsert({
      where: { key: "leads_assignment_mode" },
      update: { value: "DEFAULT_POOL" },
      create: { key: "leads_assignment_mode", value: "DEFAULT_POOL" }
    });

    await prisma.systemConfig.upsert({
      where: { key: "leads_default_assignee_id" },
      update: { value: hostUser.id },
      create: { key: "leads_default_assignee_id", value: hostUser.id }
    });

    console.log(`ℹ️ Configured assignment mode to 'DEFAULT_POOL' with default assignee: ${hostUser.name}`);

    // 3. Simulate promoteVisitorToCustomerAction logic at the DB level
    // Fetch system configurations from database
    const configs = await prisma.systemConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const assignmentMode = configMap.get("leads_assignment_mode") || "ROUND_ROBIN";
    const defaultAssigneeId = configMap.get("leads_default_assignee_id") || "";

    let assignedUser = null;

    if (assignmentMode === "DEFAULT_POOL" && defaultAssigneeId) {
      assignedUser = await prisma.user.findFirst({
        where: { id: defaultAssigneeId, isActive: true },
        select: { id: true, name: true },
      });
    }

    if (!assignedUser) {
      throw new Error("Expected assignee to be retrieved under DEFAULT_POOL configuration.");
    }

    console.log(`✅ Retrieved correct assignedUser: ${assignedUser.name} (MATCHES EXPECTED hostUser.id: ${assignedUser.id === hostUser.id})`);
    if (assignedUser.id !== hostUser.id) {
      throw new Error("Assignee ID mismatch.");
    }

    // Generate unique customerCode
    let customerCode = "";
    let isUnique = false;
    while (!isUnique) {
      customerCode = `CUST-W${Math.floor(10000 + Math.random() * 90000)}`;
      const existing = await prisma.customer.findUnique({ where: { customerCode } });
      if (!existing) isUnique = true;
    }

    // Create Customer
    const customer = await prisma.customer.create({
      data: {
        customerCode,
        name: visitor.visitorName,
        email: visitor.visitorEmail,
        phone: visitor.visitorPhone,
        status: "New",
        assignedUserId: assignedUser.id,
        leadSource: "WalkIn"
      }
    });

    createdCustomerCode = customer.customerCode;
    console.log(`✅ Promoted to Customer successfully. Customer Code: ${createdCustomerCode}`);

    // Create CustomerVisit
    const visit = await prisma.customerVisit.create({
      data: {
        customerId: customer.id,
        hostedBy: visitor.hostUserId,
        purpose: visitor.purpose,
        checkInTime: visitor.inTime,
        checkOutTime: visitor.outTime,
        meetingSummary: `Promoted from Walk-in Guest entry. Original Host: ${hostUser.name}`,
        outcome: "Walk-in Guest",
        customerDecision: "APPROVED",
        status: "CHECKED_IN"
      }
    });

    console.log(`✅ Created CustomerVisit entry linked to Customer ID: ${customer.id}`);

    // Delete visitor
    await prisma.visitor.delete({ where: { id: visitor.id } });
    visitorId = null; // Cleared since deleted
    console.log("✅ Deleted original Visitor walk-in log.");

    console.log("🎉 ALL VISITOR PROMOTION & DYNAMIC CONFIG AUTO-ASSIGNMENT TESTS PASSED!");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (createdCustomerCode) {
      console.log("🧹 Cleaning up created customer and visit records...");
      const customer = await prisma.customer.findUnique({
        where: { customerCode: createdCustomerCode }
      });
      if (customer) {
        await prisma.customerVisit.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
        await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
      }
    }
    if (visitorId) {
      console.log("🧹 Cleaning up visitor record...");
      await prisma.visitor.delete({ where: { id: visitorId } }).catch(() => {});
    }

    // Reset settings
    await prisma.systemConfig.delete({ where: { key: "leads_assignment_mode" } }).catch(() => {});
    await prisma.systemConfig.delete({ where: { key: "leads_default_assignee_id" } }).catch(() => {});

    console.log("🧹 Cleanup complete.");
    await prisma.$disconnect();
  }
}

runVisitorPromotionTest();
