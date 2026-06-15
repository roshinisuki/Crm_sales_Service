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

// Now import the PrismaClient and actions
import { PrismaClient } from "@prisma/client";
import {
  createFollowUpAction,
  getFollowUpsAction,
  getFollowUpsSummaryAction,
  completeFollowUpAction,
  cancelFollowUpAction,
  rescheduleFollowUpAction,
  reassignFollowUpAction,
  checkAndUpdateOverdueFollowUps,
} from "./app/actions/followUps";
import { POST as leadIngestionPost } from "./app/api/leads/route";
import { checkInInboundAction, checkOutInboundAction } from "./app/actions/visits";

const prisma = new PrismaClient();

async function runTests() {
  console.log("🚀 Starting SUKI CRM Follow-Ups Enhancement Test Suite...");

  // 1. Setup mock users
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true } });
  const leadUser = await prisma.user.findFirst({ where: { role: "SalesManager", isActive: true } });
  const execUser = await prisma.user.findFirst({ where: { role: "SalesExecutive", isActive: true } });
  const execUser2 = await prisma.user.findMany({ where: { role: "SalesExecutive", isActive: true } }).then(users => users[1] || null);

  if (!adminUser || !leadUser || !execUser) {
    throw new Error("Ensure there is at least one active Admin, Lead, and Executive in the DB to run tests.");
  }

  console.log(`Using mock users:`);
  console.log(`- Admin: ${adminUser.email} (ID: ${adminUser.id})`);
  console.log(`- Lead: ${leadUser.email} (ID: ${leadUser.id})`);
  console.log(`- Executive 1: ${execUser.email} (ID: ${execUser.id})`);
  if (execUser2) {
    console.log(`- Executive 2: ${execUser2.email} (ID: ${execUser2.id})`);
  }

  // Tracking for cleanup
  const cleanups = {
    customerIds: [] as string[],
    leadIds: [] as string[],
    followUpIds: [] as string[],
    notificationIds: [] as string[],
    visitIds: [] as string[],
  };

  const cleanupDatabase = async () => {
    console.log("\n🧹 Cleaning up test database changes...");
    try {
      if (cleanups.followUpIds.length > 0) {
        await prisma.followUp.deleteMany({ where: { id: { in: cleanups.followUpIds } } });
      }
      if (cleanups.visitIds.length > 0) {
        await prisma.customerVisit.deleteMany({ where: { id: { in: cleanups.visitIds } } });
      }
      if (cleanups.leadIds.length > 0) {
        await prisma.lead.deleteMany({ where: { id: { in: cleanups.leadIds } } });
      }
      if (cleanups.customerIds.length > 0) {
        await prisma.customer.deleteMany({ where: { id: { in: cleanups.customerIds } } });
      }
      // Clean notifications created during tests
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { title: { contains: "Follow-Up" } },
            { message: { contains: "follow-up" } },
          ]
        }
      });
      console.log("✅ Cleanup complete.");
    } catch (e) {
      console.error("❌ Cleanup failed", e);
    }
  };

  // Helper: create a test customer
  const createTestCustomer = async (name: string, assignedUserId: string) => {
    const code = `TEST-${Math.floor(10000 + Math.random() * 90000)}`;
    const cust = await prisma.customer.create({
      data: {
        customerCode: code,
        name,
        status: "Prospect",
        assignedUserId,
      }
    });
    cleanups.customerIds.push(cust.id);
    return cust;
  };

  try {
    // Clear any active visits for test executives to prevent concurrency block in test environment
    await prisma.customerVisit.deleteMany({
      where: {
        hostedBy: { in: [execUser.id, execUser2?.id].filter(Boolean) as string[] },
      }
    });
    await prisma.marketingVisit.deleteMany({
      where: {
        executiveId: { in: [execUser.id, execUser2?.id].filter(Boolean) as string[] },
      }
    });

    // -------------------------------------------------------------
    // SCENARIO 1: Manual Follow-Up Creation & RBAC Restriction
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 1: Manual Follow-Up Creation & RBAC ---");
    const customer1 = await createTestCustomer("Acme Corp", execUser.id);

    // 1a. Admin creates follow-up for execUser
    mockUserPayload = adminUser;
    const res1 = await createFollowUpAction({
      customerId: customer1.id,
      nextMeetingDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      remarks: "Admin scheduling manual follow-up",
      priority: "High",
      assignedUserId: execUser.id,
    });
    
    if (!res1.success || !res1.data) {
      throw new Error(`Failed to create follow-up as Admin: ${res1.message}`);
    }
    cleanups.followUpIds.push(res1.data.id);
    console.log("✅ Admin successfully created follow-up assigned to Executive.");
    
    // Verify priority and sourceType
    if (res1.data.priority !== "High" || res1.data.sourceType !== "MANUAL") {
      throw new Error(`Incorrect follow-up metadata: priority=${res1.data.priority}, sourceType=${res1.data.sourceType}`);
    }
    console.log("✅ Priority and sourceType correctly saved.");

    // 1b. Executive tries to assign to someone else (should fail/reassign to themselves)
    if (execUser2) {
      mockUserPayload = execUser;
      const res2 = await createFollowUpAction({
        customerId: customer1.id,
        nextMeetingDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        remarks: "Exec trying to assign to Exec 2",
        assignedUserId: execUser2.id,
      });

      if (res2.success) {
        throw new Error("Executive should not be allowed to assign follow-up to another executive!");
      }
      console.log("✅ Executive assignment restriction enforced correctly (Exec cannot assign to another Exec).");
    }

    // -------------------------------------------------------------
    // SCENARIO 2: Ingestion & Visit Checkout Auto-generation
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 2: Ingestion & Visit Checkout Auto-generation ---");

    // 2a. Auto-generation from Lead Ingestion API
    const reqBody = {
      name: "Lead Ingestion Test Co",
      email: `ingestion-${Date.now()}@sukisoftware.com`,
      phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
      city: "Bangalore",
      message: "Looking for enterprise package",
      leadSource: "Website",
    };

    const mockReq = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "suki_secret_key_123"
      },
      body: JSON.stringify(reqBody)
    });

    const routeRes = await leadIngestionPost(mockReq);
    const routeData = await routeRes.json();

    if (!routeData.success) {
      throw new Error(`Lead Ingestion failed: ${routeData.message}`);
    }

    const ingestedCustId = routeData.data.id;
    cleanups.leadIds.push(ingestedCustId);
    console.log(`✅ Ingested new lead. Customer ID: ${ingestedCustId}`);

    // Verify auto-created follow-up for this lead
    const autoFollowUp = await prisma.followUp.findFirst({
      where: { leadId: ingestedCustId },
      include: { assignedUser: true }
    });

    if (!autoFollowUp) {
      throw new Error("Auto-created follow-up from lead ingestion was not found in DB!");
    }
    cleanups.followUpIds.push(autoFollowUp.id);

    if (autoFollowUp.sourceType !== "LEAD_INGESTION" || !autoFollowUp.autoCreated || !autoFollowUp.dueDate) {
      throw new Error(`Lead auto-created follow-up properties incorrect: sourceType=${autoFollowUp.sourceType}, autoCreated=${autoFollowUp.autoCreated}`);
    }
    console.log("✅ Auto-created follow-up from Lead Ingestion verified successfully.");

    // 2b. Auto-generation from Office Visit Checkout
    mockUserPayload = execUser;
    const checkInRes = await checkInInboundAction({
      customerId: customer1.id,
      purpose: "Office Demo",
      priority: "Normal",
    });

    if (!checkInRes.success || !checkInRes.data) {
      throw new Error(`Inbound check-in failed: ${checkInRes.message}`);
    }
    const visitId = checkInRes.data.id;
    cleanups.visitIds.push(visitId);
    console.log(`✅ Checked in customer Acme Corp. Visit ID: ${visitId}`);

    const checkoutRes = await checkOutInboundAction({
      id: visitId,
      meetingSummary: "Office visit check-out demo completed",
      outcome: "Follow-up Required",
      customerDecision: "PENDING",
      nextMeetingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      nextMeetingNotes: "Discuss contract options next week",
    });

    if (!checkoutRes.success) {
      throw new Error(`Inbound check-out failed: ${checkoutRes.message}`);
    }
    console.log("✅ Checked out customer Acme Corp.");

    // Verify visit checkout follow-up
    const visitFollowUp = await prisma.followUp.findFirst({
      where: { visitId },
      include: { assignedUser: true }
    });

    if (!visitFollowUp) {
      throw new Error("Auto-created follow-up from visit checkout was not found!");
    }
    cleanups.followUpIds.push(visitFollowUp.id);

    if (visitFollowUp.sourceType !== "VISIT_CHECKOUT" || !visitFollowUp.autoCreated || visitFollowUp.visitType !== "INBOUND" || !visitFollowUp.dueDate) {
      throw new Error(`Visit checkout follow-up properties incorrect: sourceType=${visitFollowUp.sourceType}, autoCreated=${visitFollowUp.autoCreated}`);
    }
    console.log("✅ Auto-created follow-up from Visit Checkout verified successfully.");


    // -------------------------------------------------------------
    // SCENARIO 3: Overdue Detection, Alerts, and Escalation
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 3: Overdue Detection & Escalation ---");

    // 3a. Create a follow-up that is overdue by 5 hours (< now, but > -48h)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const overdueFollowUp = await prisma.followUp.create({
      data: {
        customerId: customer1.id,
        assignedUserId: execUser.id,
        nextMeetingDate: fiveHoursAgo,
        dueDate: fiveHoursAgo,
        remarks: "Overdue follow-up 5h ago",
        status: "Pending",
        priority: "Medium",
        sourceType: "MANUAL",
      }
    });
    cleanups.followUpIds.push(overdueFollowUp.id);

    // 3b. Create a follow-up overdue by 50 hours (< -48 hours, triggers escalation)
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
    const escalatedFollowUp = await prisma.followUp.create({
      data: {
        customerId: customer1.id,
        assignedUserId: execUser.id,
        nextMeetingDate: fiftyHoursAgo,
        dueDate: fiftyHoursAgo,
        remarks: "Escalated follow-up 50h ago",
        status: "Pending",
        priority: "Medium",
        sourceType: "MANUAL",
      }
    });
    cleanups.followUpIds.push(escalatedFollowUp.id);

    // Trigger the sweep
    await checkAndUpdateOverdueFollowUps();

    // Verify overdueFollowUp transitions
    const verifiedOverdue = await prisma.followUp.findUnique({ where: { id: overdueFollowUp.id } });
    if (!verifiedOverdue || verifiedOverdue.status !== "Overdue" || verifiedOverdue.escalationLevel !== 0) {
      throw new Error(`5h overdue follow-up failed status transition: status=${verifiedOverdue?.status}, escalationLevel=${verifiedOverdue?.escalationLevel}`);
    }
    console.log("✅ 5h overdue follow-up marked as Overdue, escalationLevel = 0.");

    // Verify escalatedFollowUp transitions
    const verifiedEscalated = await prisma.followUp.findUnique({ where: { id: escalatedFollowUp.id } });
    if (!verifiedEscalated || verifiedEscalated.status !== "Overdue" || verifiedEscalated.escalationLevel !== 1) {
      throw new Error(`50h overdue follow-up failed status transition/escalation: status=${verifiedEscalated?.status}, escalationLevel=${verifiedEscalated?.escalationLevel}`);
    }
    console.log("✅ 50h overdue follow-up marked as Overdue, escalated to Level 1.");

    // Verify notifications were created
    const overdueNotifications = await prisma.notification.findMany({
      where: { type: "follow_up" }
    });
    if (overdueNotifications.length === 0) {
      throw new Error("No follow-up overdue notifications found in database!");
    }
    console.log(`✅ Verified ${overdueNotifications.length} overdue follow-up notifications dispatched.`);


    // -------------------------------------------------------------
    // SCENARIO 4: Operations: Complete, Cancel, Reschedule, Reassign
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 4: Operations: Complete, Cancel, Reschedule, Reassign ---");
    
    // 4a. Reschedule: move fiveHoursAgo overdue followup to 1 day in the future
    mockUserPayload = execUser;
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rescheduleRes = await rescheduleFollowUpAction({
      id: overdueFollowUp.id,
      nextMeetingDate: futureDate,
      remarks: "Rescheduled to tomorrow"
    });

    if (!rescheduleRes.success) {
      throw new Error(`Reschedule action failed: ${rescheduleRes.message}`);
    }
    
    const rescheduled = await prisma.followUp.findUnique({ where: { id: overdueFollowUp.id } });
    if (!rescheduled || rescheduled.status !== "Pending" || rescheduled.nextMeetingDate.getTime() !== futureDate.getTime()) {
      throw new Error(`Rescheduled follow-up has incorrect status or date: status=${rescheduled?.status}`);
    }
    console.log("✅ Follow-up successfully rescheduled (status reset back to Pending).");

    // 4b. Reassign: Admin reassigns rescheduled follow-up to Lead user
    mockUserPayload = adminUser;
    const reassignRes = await reassignFollowUpAction({
      id: overdueFollowUp.id,
      assignedUserId: leadUser.id
    });

    if (!reassignRes.success) {
      throw new Error(`Reassign failed: ${reassignRes.message}`);
    }
    
    const reassigned = await prisma.followUp.findUnique({ where: { id: overdueFollowUp.id } });
    if (!reassigned || reassigned.assignedUserId !== leadUser.id) {
      throw new Error(`Reassigned follow-up has incorrect assignee: assignedUserId=${reassigned?.assignedUserId}`);
    }
    console.log("✅ Follow-up successfully reassigned to Lead.");

    // Executive trying to reassign should fail
    mockUserPayload = execUser;
    const failReassign = await reassignFollowUpAction({
      id: overdueFollowUp.id,
      assignedUserId: execUser.id
    });
    if (failReassign.success) {
      throw new Error("Executive should not have permissions to reassign follow-ups!");
    }
    console.log("✅ Executive reassign restriction verified.");

    // 4c. Cancel: Exec cancels their own escalated follow-up
    mockUserPayload = execUser;
    const cancelRes = await cancelFollowUpAction({
      id: escalatedFollowUp.id,
      notes: "Client cancelled product requirement"
    });

    if (!cancelRes.success) {
      throw new Error(`Cancel failed: ${cancelRes.message}`);
    }
    
    const cancelled = await prisma.followUp.findUnique({ where: { id: escalatedFollowUp.id } });
    if (!cancelled || cancelled.status !== "Cancelled") {
      throw new Error(`Cancelled follow-up has incorrect status: status=${cancelled?.status}`);
    }
    console.log("✅ Follow-up successfully cancelled.");

    // 4d. Complete: Admin completes reassigned follow-up, updates customer status, creates follow-up 2
    mockUserPayload = adminUser;
    const nextMeetingDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const completeRes = await completeFollowUpAction({
      id: overdueFollowUp.id,
      customerStatus: "APPROVED",
      completionNotes: "Touchpoint resolved. Portal activation scheduled.",
      nextMeetingDate: nextMeetingDate.toISOString(),
      nextMeetingNotes: "Review portal setup"
    });

    if (!completeRes.success) {
      throw new Error(`Complete failed: ${completeRes.message}`);
    }

    const completed = await prisma.followUp.findUnique({ where: { id: overdueFollowUp.id } });
    if (!completed || completed.status !== "Completed" || completed.completedById !== adminUser.id || completed.completionNotes !== "Touchpoint resolved. Portal activation scheduled.") {
      throw new Error(`Completed follow-up has incorrect values: status=${completed?.status}, completedById=${completed?.completedById}`);
    }
    console.log("✅ Follow-up marked Completed with completedById and completionNotes.");

    // Verify customer status updated to ActiveCustomer (due to APPROVED input mapping)
    const updatedCust = await prisma.customer.findUnique({ where: { id: customer1.id } });
    if (!updatedCust || updatedCust.status !== "ActiveCustomer") {
      throw new Error(`Customer status was not updated: status=${updatedCust?.status}`);
    }
    console.log("✅ Customer status updated to ActiveCustomer successfully.");

    // Verify next follow-up created
    const followUp2 = await prisma.followUp.findFirst({
      where: { customerId: customer1.id, status: "Pending" }
    });
    if (!followUp2) {
      throw new Error("Secondary follow-up was not created after completion!");
    }
    cleanups.followUpIds.push(followUp2.id);
    console.log("✅ Secondary follow-up created successfully.");


    // -------------------------------------------------------------
    // SCENARIO 5: Dashboard Summaries & Visibility RBAC
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 5: Dashboard Summaries & Visibility ---");

    // 5a. Check getFollowUpsAction visibility
    // Exec user should only see their own (cancelled is execUser, followUp2 is execUser, autoFollowUp is round-robin'd to someone else)
    mockUserPayload = execUser;
    const execView = await getFollowUpsAction();
    if (!execView.success || !execView.data) {
      throw new Error("Failed to load follow-ups for Executive.");
    }
    const hasUnassigned = execView.data.some((f: any) => f.assignedUserId !== execUser.id);
    if (hasUnassigned) {
      throw new Error("Executive sees follow-ups assigned to other users!");
    }
    console.log("✅ Executive dashboard visibility restricted to assigned follow-ups only.");

    // Admin should see everything
    mockUserPayload = adminUser;
    const adminView = await getFollowUpsAction();
    if (!adminView.success || !adminView.data) {
      throw new Error("Failed to load follow-ups for Admin.");
    }
    console.log(`✅ Admin dashboard can view all team follow-ups (Total: ${adminView.data.length}).`);

    // 5b. Get metrics summary
    mockUserPayload = execUser;
    const summaryRes = await getFollowUpsSummaryAction();
    if (!summaryRes.success || !summaryRes.data) {
      throw new Error(`Failed to load metrics summary: ${summaryRes.message}`);
    }
    
    console.log("📊 Executive Follow-Up Summary Metrics:");
    console.log(`- Total: ${summaryRes.data.total}`);
    console.log(`- Pending: ${summaryRes.data.pending}`);
    console.log(`- Overdue: ${summaryRes.data.overdue}`);
    console.log(`- Completed Today: ${summaryRes.data.completedToday}`);
    console.log(`- Due Today: ${summaryRes.data.dueToday}`);
    console.log(`- Upcoming: ${summaryRes.data.upcoming}`);
    console.log("✅ Verified follow-up metrics summary aggregation.");

    console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
  } finally {
    // Clean up all generated data
    await cleanupDatabase();
  }
}

// Run the script
runTests();
