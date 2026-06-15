import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runLeadsIngestionTest() {
  console.log("🚀 Starting Public Lead Ingestion & Auto-Assignment API Test...");

  const testEmail = `test-lead-${Date.now()}@example.com`;
  const testPhone = `999-${Math.floor(1000 + Math.random() * 9000)}`;
  const testLeadName = `Web Lead ${Date.now()}`;

  let createdCustomerCode = null;

  try {
    // 1. Get current executives and counts before test
    const executives = await prisma.user.findMany({
      where: { role: "SalesExecutive", isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: { assignedCustomers: true }
        }
      }
    });

    if (executives.length === 0) {
      throw new Error("No active Sales Executives found to test auto-assignment.");
    }

    // Determine who should receive the assignment (the executive with the minimum assignedCustomers count)
    executives.sort((a, b) => a._count.assignedCustomers - b._count.assignedCustomers);
    const expectedExecutive = executives[0];
    console.log(`ℹ️ Expected assignee (least busy executive): ${expectedExecutive.name} (${expectedExecutive._count.assignedCustomers} customers)`);

    // 2. Perform HTTP request to localhost:3000/api/leads
    const payload = {
      name: testLeadName,
      email: testEmail,
      phone: testPhone,
      city: "Test Ingestion City",
      message: "Please contact me about the standard pricing details.",
      leadSource: "Website"
    };

    let response = null;
    let url = "http://localhost:3000/api/leads";
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      // Fallback to port 3001
      url = "http://localhost:3001/api/leads";
      console.log(`⚠️ Failed to connect to port 3000. Trying fallback: ${url}`);
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    console.log(`Response Status: ${response.status}`);
    const json = await response.json();
    console.log("Response Body:", JSON.stringify(json, null, 2));

    if (!response.ok || !json.success) {
      throw new Error(`Failed to ingest lead: ${json.message || response.statusText}`);
    }

    createdCustomerCode = json.data.customerCode;
    console.log(`✅ Ingested lead successfully. Code: ${createdCustomerCode}`);

    // 3. Verify Database records
    const customer = await prisma.customer.findUnique({
      where: { customerCode: createdCustomerCode },
      include: {
        followUps: true,
        callLogs: true
      }
    });

    if (!customer) {
      throw new Error("Customer record not found in database.");
    }

    console.log("✅ Verified Customer status is 'New':", customer.status);
    if (customer.status !== "New") {
      throw new Error(`Expected Customer status 'New', got '${customer.status}'`);
    }

    console.log("✅ Verified assignedUserId matches expected executive:", customer.assignedUserId === expectedExecutive.id ? "MATCH" : "MISMATCH");
    if (customer.assignedUserId !== expectedExecutive.id) {
      throw new Error(`Expected assignee ID ${expectedExecutive.id}, got ${customer.assignedUserId}`);
    }

    // Verify follow-up task created
    console.log(`✅ Verified automatic follow-up created: ${customer.followUps.length} record(s)`);
    if (customer.followUps.length !== 1 || customer.followUps[0].status !== "Pending") {
      throw new Error("Expected 1 pending follow-up task to be created.");
    }

    // Verify CallLog created
    console.log(`✅ Verified CallLog entry created: ${customer.callLogs.length} record(s)`);
    if (customer.callLogs.length !== 1 || !customer.callLogs[0].notes.includes(payload.message)) {
      throw new Error("Expected call log entry containing the enquiry message.");
    }

    console.log("🎉 ALL LEAD INGESTION & AUTO-ASSIGNMENT TESTS PASSED SUCCESSFULLY!");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (createdCustomerCode) {
      console.log("🧹 Cleaning up created lead and associated records...");
      const customer = await prisma.customer.findUnique({
        where: { customerCode: createdCustomerCode }
      });
      if (customer) {
        await prisma.followUp.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
        await prisma.callLog.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
        await prisma.notification.deleteMany({ where: { link: `/customer-master/${customer.id}` } }).catch(() => {});
        await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
      }
      console.log("🧹 Cleanup complete.");
    }
    await prisma.$disconnect();
  }
}

runLeadsIngestionTest();
