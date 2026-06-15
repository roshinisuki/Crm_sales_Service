import Module from "module";

// Setup global mock for lib/auth and next.js before importing any actions
let mockUserPayload: any = null;

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  let resolvedId = id;
  if (resolvedId.startsWith("@/")) {
    resolvedId = resolvedId.replace("@/", process.cwd() + "/");
  }

  if (resolvedId.includes("lib/auth") || resolvedId.includes("lib\\auth")) {
    return {
      verifyAuth: async () => {
        return mockUserPayload;
      },
      isInternalEmail: (email: string) => {
        return email.endsWith("sukisoftware.com");
      },
      requiresInternalEmail: (role: string) => {
        return ["Admin", "SalesManager", "SalesExecutive"].includes(role);
      },
      getRoleRedirect: (role: string) => "/dashboard",
      requireRole: (payload: any, roles: string[]) => {
        return payload && roles.includes(payload.role);
      }
    };
  }
  if (resolvedId === "next/headers") {
    return {
      cookies: async () => ({
        get: (name: string) => {
          if (name === "token") return { value: "mock-token" };
          return undefined;
        }
      })
    };
  }
  if (resolvedId === "next/cache") {
    return {
      revalidatePath: () => {}
    };
  }
  if (resolvedId === "next/navigation") {
    return {
      redirect: (url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      }
    };
  }
  return originalRequire.apply(this, [resolvedId] as any);
};

// Now import the PrismaClient and the route handlers/actions
import { PrismaClient } from "@prisma/client";
import { POST as leadIngestionPost } from "./app/api/leads/route";
import { getSystemConfigsAction, updateSystemConfigsAction } from "./app/actions/systemConfigs";
import { promoteVisitorToCustomerAction } from "./app/actions/visitors";

const prisma = new PrismaClient();

async function runAllTests() {
  console.log("🚀 Starting unified CRM Flow Test Suite...");

  // Fetch users needed for test authentication and assignee verification
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true } });
  const leadUser = await prisma.user.findFirst({ where: { role: "SalesManager", isActive: true } });
  const execUser = await prisma.user.findFirst({ where: { role: "SalesExecutive", isActive: true } });

  if (!adminUser || !leadUser || !execUser) {
    throw new Error("Ensure there is at least one active Admin, SalesManager, and SalesExecutive in the DB to run tests.");
  }

  console.log(`Using mock users: Admin (${adminUser.email}), Lead (${leadUser.email}), Executive (${execUser.email})`);

  // State to clean up
  const createdLeadIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdVisitorIds: string[] = [];

  // Helper function to mock request
  const createMockRequest = (body: any, apiKeyHeader: string | null = "suki_secret_key_123") => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKeyHeader !== null) {
      headers["x-api-key"] = apiKeyHeader;
    }
    return new Request("http://localhost/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Config Fetch and Save Behavior
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Config Fetch & Save ---");
    mockUserPayload = { id: adminUser.id, role: "Admin", email: adminUser.email };

    // Reset settings in DB first
    await prisma.systemConfig.deleteMany();

    // Fetch missing config -> fallback behavior check
    const initialConfigRes = await getSystemConfigsAction();
    if (!initialConfigRes.success || !initialConfigRes.data) {
      throw new Error(`Failed to fetch initial settings: ${initialConfigRes.message}`);
    }
    console.log("✅ Fetch default fallback configs succeeded.");
    if (initialConfigRes.data.leads_api_key !== "suki_secret_key_123") {
      throw new Error(`Expected fallback API key 'suki_secret_key_123', got '${initialConfigRes.data.leads_api_key}'`);
    }

    // Save custom settings
    const testApiKey = "custom_test_api_key_xyz";
    const updateRes = await updateSystemConfigsAction({
      leads_api_key: testApiKey,
      leads_assignment_mode: "ROUND_ROBIN",
      leads_default_assignee_id: execUser.id
    });
    if (!updateRes.success) {
      throw new Error(`Failed to update system configs: ${updateRes.message}`);
    }
    console.log("✅ Update system configs succeeded.");

    // Fetch again -> check if custom settings load
    const updatedConfigRes = await getSystemConfigsAction();
    if (!updatedConfigRes.success || updatedConfigRes.data?.leads_api_key !== testApiKey) {
      throw new Error("Failed to load freshly saved system configs.");
    }
    console.log("✅ Verified settings loaded successfully from DB.");

    // -------------------------------------------------------------
    // TEST 2: Lead Ingestion - Invalid API Key Rejection
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Lead Ingestion - Invalid API Key Failure ---");
    const badReq = createMockRequest({ name: "Unauth Lead" }, "incorrect_key");
    const badRes = await leadIngestionPost(badReq);
    console.log(`Response status: ${badRes.status}`);
    if (badRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${badRes.status}`);
    }
    const badJson = await badRes.json();
    if (badJson.success !== false || !badJson.message.includes("Invalid API Key")) {
      throw new Error("Invalid API key response structure mismatch.");
    }
    console.log("✅ Invalid API key rejection verified successfully.");

    // -------------------------------------------------------------
    // TEST 3: Lead Ingestion - Success & CRM Automations Check
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Lead Ingestion - Success & Auto-Assign ---");
    const testEmail = `lead-${Date.now()}@example.com`;
    const testPhone = `123-${Math.floor(1000 + Math.random() * 9000)}`;
    const testLeadName = "API Ingested Lead";
    
    // We will use the custom API key we saved
    const goodReq = createMockRequest({
      name: testLeadName,
      email: testEmail,
      phone: testPhone,
      city: "San Francisco",
      message: "Looking for premium license pricing.",
      leadSource: "LinkedIn"
    }, testApiKey);

    const goodRes = await leadIngestionPost(goodReq);
    if (goodRes.status !== 201) {
      throw new Error(`Expected 201 Created, got ${goodRes.status}`);
    }
    const goodJson = await goodRes.json();
    if (!goodJson.success || !goodJson.data?.id) {
      throw new Error(`Failed to ingest lead: ${goodJson.message}`);
    }

    const leadId = goodJson.data.id;
    createdLeadIds.push(leadId);
    console.log(`✅ Lead ingested successfully. Lead ID: ${leadId}`);

    // Verify DB writes
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { followUps: true, callLogs: true }
    });
    if (!lead) throw new Error("Lead record missing in DB.");
    const l = lead;

    if (l.status !== "New") throw new Error(`Expected lead status 'New', got '${l.status}'`);
    if (l.leadSource !== "LinkedIn") throw new Error(`Expected leadSource 'LinkedIn', got '${l.leadSource}'`);

    // Verify FollowUp Created
    if (l.followUps.length !== 1) {
      throw new Error(`Expected exactly 1 follow-up task, found ${l.followUps.length}`);
    }
    console.log("✅ Automated follow-up task verified.");

    // Verify CallLog Created
    if (l.callLogs.length !== 1 || !l.callLogs[0].notes?.includes("premium license pricing")) {
      throw new Error("Expected CallLog entry with message details.");
    }
    console.log("✅ Automated CallLog entry verified.");

    // Verify Audit Logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { details: { contains: l.leadCode } }
    });
    if (auditLogs.length === 0) {
      throw new Error("Audit logs for lead ingestion not found.");
    }
    console.log(`✅ Audit logging verified: found ${auditLogs.length} audit logs.`);

    // Verify SSE Notification is created in database
    const notification = await prisma.notification.findFirst({
      where: { link: `/leads/${l.id}` }
    });
    if (!notification) {
      throw new Error("SSE Notification record was not found in DB.");
    }
    console.log(`✅ SSE Notification dispatched successfully in DB: "${notification.title}" - ${notification.message}`);

    // -------------------------------------------------------------
    // TEST 4: Lead Ingestion - Duplicate Rejection
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Lead Ingestion - Duplicate Email Rejection ---");
    const dupEmailReq = createMockRequest({
      name: "Duplicate Email Lead",
      email: testEmail, // same email
      phone: `777-${Date.now()}`
    }, testApiKey);
    const dupEmailRes = await leadIngestionPost(dupEmailReq);
    if (dupEmailRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${dupEmailRes.status}`);
    }
    const dupEmailJson = await dupEmailRes.json();
    if (!dupEmailJson.message.includes("Email address is already registered")) {
      throw new Error("Expected email duplicate message.");
    }
    console.log("✅ Duplicate email rejection verified.");

    console.log("\n--- TEST 4b: Lead Ingestion - Duplicate Phone Rejection ---");
    const dupPhoneReq = createMockRequest({
      name: "Duplicate Phone Lead",
      email: `diff-${Date.now()}@example.com`,
      phone: testPhone // same phone
    }, testApiKey);
    const dupPhoneRes = await leadIngestionPost(dupPhoneReq);
    if (dupPhoneRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${dupPhoneRes.status}`);
    }
    const dupPhoneJson = await dupPhoneRes.json();
    if (!dupPhoneJson.message.includes("Phone number is already registered")) {
      throw new Error("Expected phone duplicate message.");
    }
    console.log("✅ Duplicate phone rejection verified.");

    // -------------------------------------------------------------
    // TEST 5: Lead Ingestion - Auto-Assignment Mode: ROUND_ROBIN
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Lead Ingestion - ROUND_ROBIN Assignment ---");
    
    // Switch to ROUND_ROBIN config
    await updateSystemConfigsAction({
      leads_api_key: testApiKey,
      leads_assignment_mode: "ROUND_ROBIN"
    });

    // Determine target exec based on ACTIVE workload (New/Contacted only) — matches new workload-based assignment
    const execsBefore = await prisma.user.findMany({
      where: { role: "SalesExecutive", isActive: true },
      select: {
        id: true,
        name: true,
        leads: {
          where: { status: { in: ["New", "Contacted"] } },
          select: { id: true }
        }
      }
    });
    execsBefore.sort((a, b) => a.leads.length - b.leads.length);
    const targetExec = execsBefore[0];

    const rrReq = createMockRequest({
      name: "Round Robin Lead",
      email: `rr-${Date.now()}@example.com`,
      phone: `rr-${Math.floor(1000 + Math.random() * 9000)}`
    }, testApiKey);

    const rrRes = await leadIngestionPost(rrReq);
    const rrJson = await rrRes.json();
    createdLeadIds.push(rrJson.data.id);

    const rrLead = await prisma.lead.findUnique({
      where: { id: rrJson.data.id }
    });
    if (!rrLead || rrLead.assignedUserId !== targetExec.id) {
      throw new Error(`Expected lead to be assigned to least busy Executive (${targetExec.name}: ${targetExec.id}), but got ${rrLead?.assignedUserId}`);
    }
    console.log(`✅ Lead assigned to least busy executive (active workload) ${targetExec.name} via Workload-Based assignment successfully.`);

    // -------------------------------------------------------------
    // TEST 6: Lead Ingestion - Auto-Assignment Mode: DEFAULT_POOL
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Lead Ingestion - DEFAULT_POOL Assignment ---");
    
    // Switch config to DEFAULT_POOL targeting the LeadUser
    await updateSystemConfigsAction({
      leads_api_key: testApiKey,
      leads_assignment_mode: "DEFAULT_POOL",
      leads_default_assignee_id: leadUser.id
    });

    const poolReq = createMockRequest({
      name: "Pool Lead",
      email: `pool-${Date.now()}@example.com`,
      phone: `pool-${Math.floor(1000 + Math.random() * 9000)}`
    }, testApiKey);

    const poolRes = await leadIngestionPost(poolReq);
    const poolJson = await poolRes.json();
    createdLeadIds.push(poolJson.data.id);

    const poolLead = await prisma.lead.findUnique({
      where: { id: poolJson.data.id }
    });
    if (!poolLead || poolLead.assignedUserId !== leadUser.id) {
      throw new Error(`Expected lead to be assigned to default assignee (${leadUser.name}: ${leadUser.id}), but got ${poolLead?.assignedUserId}`);
    }
    console.log(`✅ Lead assigned to default triage assignee ${leadUser.name} via DEFAULT_POOL successfully.`);

    // -------------------------------------------------------------
    // TEST 7: Visitor Promotion Flow - Success Check
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Visitor Promotion Success ---");
    
    // Create temporary guest visitor
    const visitor = await prisma.visitor.create({
      data: {
        visitorName: "Guest Walkin",
        visitorEmail: `guest-${Date.now()}@example.com`,
        visitorPhone: `guest-${Math.floor(1000 + Math.random() * 9000)}`,
        company: "Visitor Corp",
        purpose: "Sales Demo",
        hostUserId: execUser.id,
        inTime: new Date()
      }
    });
    createdVisitorIds.push(visitor.id);

    // Perform promotion authenticated as Admin
    mockUserPayload = { id: adminUser.id, role: "Admin", name: adminUser.name, email: adminUser.email };

    const promoteRes = await promoteVisitorToCustomerAction(visitor.id);
    if (!promoteRes.success) {
      throw new Error(`Visitor promotion action failed: ${promoteRes.message}`);
    }
    console.log("✅ Visitor promotion action succeeded.");

    // Verify visitor is deleted
    const visitorCheck = await prisma.visitor.findUnique({ where: { id: visitor.id } });
    if (visitorCheck) {
      throw new Error("Visitor record was not deleted/promoted from Visitor table.");
    }
    console.log("✅ Verified original Visitor log deleted.");

    // Verify customer record exists
    const promotedCustomer = await prisma.customer.findFirst({
      where: { email: visitor.visitorEmail },
      include: { followUps: true, callLogs: true, customerVisits: true }
    });
    if (!promotedCustomer) {
      throw new Error("Promoted customer record not found.");
    }
    const pc = promotedCustomer;
    createdCustomerIds.push(pc.id);
    console.log(`✅ Verified promoted Customer created. Customer Code: ${pc.customerCode}`);

    // Verify CustomerVisit
    if (pc.customerVisits.length !== 1) {
      throw new Error("Expected CustomerVisit record to be created.");
    }
    console.log("✅ Promoted CustomerVisit record verified.");

    // Verify FollowUp Created
    if (pc.followUps.length !== 1) {
      throw new Error("Expected FollowUp task to be created on promotion.");
    }
    console.log("✅ Promoted FollowUp task verified.");

    // Verify CallLog Created
    if (pc.callLogs.length !== 1) {
      throw new Error("Expected CallLog entry to be created on promotion.");
    }
    console.log("✅ Promoted CallLog entry verified.");

    // Verify SSE Notification was created
    const promoteNotification = await prisma.notification.findFirst({
      where: { link: `/customer-master/${pc.id}` }
    });
    if (!promoteNotification) {
      throw new Error("No SSE Notification found for visitor promotion.");
    }
    console.log(`✅ SSE Promotion Notification verified: "${promoteNotification.title}" - ${promoteNotification.message}`);

    // -------------------------------------------------------------
    // TEST 8: Visitor Promotion Flow - Role Restriction Check
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Visitor Promotion Role Restriction ---");
    const restrictedVisitor = await prisma.visitor.create({
      data: {
        visitorName: "Restricted Guest",
        visitorPhone: `res-${Math.floor(1000 + Math.random() * 9000)}`,
        company: "Restriction Test",
        purpose: "Demo",
        hostUserId: execUser.id
      }
    });
    createdVisitorIds.push(restrictedVisitor.id);

    // Mock role = SalesExecutive (which is restricted)
    mockUserPayload = { id: execUser.id, role: "SalesExecutive", name: execUser.name, email: execUser.email };

    const restrictedRes = await promoteVisitorToCustomerAction(restrictedVisitor.id);
    if (restrictedRes.success) {
      throw new Error("Visitor promotion should have been rejected for SalesExecutive role.");
    }
    console.log(`✅ Correctly rejected visitor promotion for SalesExecutive: "${restrictedRes.message}"`);

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");

  } catch (error) {
    console.error("\n❌ Test Suite Failed with error:", error);
    process.exit(1);
  } finally {
    console.log("\n🧹 Starting database cleanup...");

    // Cleanup Leads and related tables
    if (createdLeadIds.length > 0) {
      console.log(`Cleaning up ${createdLeadIds.length} lead records...`);
      await prisma.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await prisma.callLog.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      
      for (const id of createdLeadIds) {
        await prisma.notification.deleteMany({ where: { link: { contains: id } } });
      }

      await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }

    // Cleanup Customers and related tables
    if (createdCustomerIds.length > 0) {
      console.log(`Cleaning up ${createdCustomerIds.length} customer records...`);
      await prisma.followUp.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.callLog.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customerVisit.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      
      for (const id of createdCustomerIds) {
        await prisma.notification.deleteMany({ where: { link: { contains: id } } });
      }

      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }

    // Cleanup Visitors
    if (createdVisitorIds.length > 0) {
      console.log(`Cleaning up ${createdVisitorIds.length} visitor records...`);
      await prisma.visitor.deleteMany({ where: { id: { in: createdVisitorIds } } });
    }

    // Clean system config
    await prisma.systemConfig.deleteMany();

    await prisma.$disconnect();
    console.log("🧹 Cleanup complete. Disconnected from Database.");
  }
}

runAllTests();
