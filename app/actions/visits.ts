"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { getFollowUpsAction } from "@/app/actions/followUps";
import { buildScope, checkRecordScope } from "@/lib/scopes";

// ═══════════════════════════════════════════════════════════════
// 1. DASHBOARD DATA LOADER
// ═══════════════════════════════════════════════════════════════
export async function getDashboardDataAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const userId = userPayload.id;
    const isExecutive = userPayload.role === "SalesExecutive";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOf7Days = new Date();
    startOf7Days.setHours(0, 0, 0, 0);
    const endOf7Days = new Date();
    endOf7Days.setDate(endOf7Days.getDate() + 7);
    endOf7Days.setHours(23, 59, 59, 999);

    const customerVisitScope = buildScope(userPayload, "CustomerVisit");
    const marketingVisitScope = buildScope(userPayload, "MarketingVisit");
    const followUpScope = buildScope(userPayload, "FollowUp");
    const customerScope = buildScope(userPayload, "Customer");

    // 1. Today's Inbound Visits
    const inboundVisits = await prisma.customerVisit.findMany({
      where: {
        ...customerVisitScope,
        OR: [
          { status: "CHECKED_IN" },
          { checkInTime: { gte: startOfToday, lte: endOfToday } }
        ]
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true } },
        host: { select: { id: true, name: true } }
      },
      orderBy: { checkInTime: "desc" }
    });

    // 2. Today's Outbound Visits
    const outboundVisits = await prisma.marketingVisit.findMany({
      where: {
        ...marketingVisitScope,
        OR: [
          { status: "CHECKED_IN" },
          { checkIn: { gte: startOfToday, lte: endOfToday } }
        ]
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        executive: { select: { id: true, name: true } }
      },
      orderBy: { checkIn: "desc" }
    });

    // 3. Upcoming Follow-ups (Next 7 Days)
    const upcomingFollowUps = await prisma.followUp.findMany({
      where: {
        ...followUpScope,
        nextMeetingDate: { gte: startOf7Days, lte: endOf7Days },
        status: "Pending"
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } }
      },
      orderBy: { nextMeetingDate: "asc" }
    });

    // 4. Overdue Follow-ups — exclude completed/cancelled ones
    const overdueFollowUps = await prisma.followUp.findMany({
      where: {
        ...followUpScope,
        nextMeetingDate: { lt: startOfToday },
        status: { in: ["Pending", "Overdue"] },
        NOT: { status: "Completed" }
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } }
      },
      orderBy: { nextMeetingDate: "asc" }
    });

    // 5. Pending Visit Approvals
    const pendingApprovals = await prisma.marketingVisit.findMany({
      where: {
        ...marketingVisitScope,
        status: "REQUESTED",
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        executive: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Compute Engagement Metrics (for the top mock banner)
    // Counts for this billing month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const totalCustomers = await prisma.customer.count({
      where: customerScope
    });

    const activeSubs = await prisma.subscription.count({
      where: {
        status: "Active",
        customer: customerScope
      }
    });

    const { checkAndUpdateOverdueFollowUps } = await import("@/app/actions/followUps");
    await checkAndUpdateOverdueFollowUps(userPayload.companyId);

    const [totalFollowUps, pendingFollowUps, overdueFollowUpsCount, completedTodayFollowUps, dueTodayFollowUps, upcomingFollowUpsCount] = await Promise.all([
      prisma.followUp.count({
        where: { ...followUpScope, status: { in: ["Pending", "Completed", "Overdue"] } }
      }),
      prisma.followUp.count({
        where: { ...followUpScope, status: "Pending" }
      }),
      prisma.followUp.count({
        where: { ...followUpScope, status: "Overdue" }
      }),
      prisma.followUp.count({
        where: { ...followUpScope, status: "Completed", completedAt: { gte: startOfToday, lte: endOfToday } }
      }),
      prisma.followUp.count({
        where: { ...followUpScope, nextMeetingDate: { gte: startOfToday, lte: endOfToday }, status: { in: ["Pending", "Overdue"] } }
      }),
      prisma.followUp.count({
        where: { ...followUpScope, nextMeetingDate: { gt: endOfToday }, status: "Pending" }
      })
    ]);

    const monthlyVisits = await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        checkIn: { gte: startOfMonth }
      }
    }) + await prisma.customerVisit.count({
      where: {
        ...customerVisitScope,
        checkInTime: { gte: startOfMonth }
      }
    });

    // 5. Inbound Walk-Ins (Checked-In today, not checked out)
    const inboundWalkIns = await prisma.visitor.count({
      where: {
        host: { companyId: userPayload.companyId },
        ...(isExecutive ? { hostUserId: userId } : {}),
        inTime: { gte: startOfToday, lte: endOfToday },
        outTime: null
      }
    });

    // 6. Outbound Walk-Ins (Checked-out today)
    const outboundWalkIns = await prisma.visitor.count({
      where: {
        host: { companyId: userPayload.companyId },
        ...(isExecutive ? { hostUserId: userId } : {}),
        inTime: { gte: startOfToday, lte: endOfToday },
        outTime: { not: null }
      }
    });

    const teamCount = await prisma.user.count({
      where: { isActive: true, role: { in: ["SalesExecutive", "SalesManager"] }, companyId: userPayload.companyId }
    });

    const visitsToday = await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        checkIn: { gte: startOfToday, lte: endOfToday }
      }
    }) + await prisma.customerVisit.count({
      where: {
        ...customerVisitScope,
        checkInTime: { gte: startOfToday, lte: endOfToday }
      }
    });

    const approvedCount = await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        status: "APPROVED"
      }
    });

    const rejectedCount = await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        status: "REJECTED"
      }
    });

    const pendingCount = await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        status: "REQUESTED"
      }
    });

    const conversionRate = totalCustomers > 0 
      ? Math.round((approvedCount / totalCustomers) * 100)
      : 0;

    // Subscription metrics for dashboard concentric ring chart
    const totalPlans = await prisma.subscription.count({
      where: {
        customer: customerScope
      }
    });

    const pendingPlans = await prisma.subscription.count({
      where: {
        status: "Pending",
        customer: customerScope
      }
    });

    const expiredPlans = await prisma.subscription.count({
      where: {
        status: "Expired",
        customer: customerScope
      }
    });

    // Calculate customer growth over the last 6 months
    const allCustomersObj = await prisma.customer.findMany({
      where: customerScope,
      select: { createdAt: true }
    });

    const monthlyCounts: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const todayDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      monthlyCounts[label] = 0;
    }

    allCustomersObj.forEach(c => {
      const d = new Date(c.createdAt);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (monthlyCounts[label] !== undefined) {
        monthlyCounts[label]++;
      }
    });

    const monthlyGrowth = Object.entries(monthlyCounts).map(([month, count]) => ({ month, count }));

    // Calculate Marketing Visit Activity over the last 6 months
    const marketingVisits = await prisma.marketingVisit.findMany({
      where: {
        ...marketingVisitScope,
        checkIn: {
          gte: new Date(todayDate.getFullYear(), todayDate.getMonth() - 5, 1),
          not: null
        }
      },
      select: { checkIn: true }
    });

    const customerVisits = await prisma.customerVisit.findMany({
      where: {
        ...customerVisitScope,
        checkInTime: { gte: new Date(todayDate.getFullYear(), todayDate.getMonth() - 5, 1) }
      },
      select: { checkInTime: true }
    });

    const visitCounts: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      visitCounts[label] = 0;
    }

    marketingVisits.forEach(v => {
      if (v.checkIn) {
        const d = new Date(v.checkIn);
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
        if (visitCounts[label] !== undefined) {
          visitCounts[label]++;
        }
      }
    });

    customerVisits.forEach(v => {
      const d = new Date(v.checkInTime);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (visitCounts[label] !== undefined) {
        visitCounts[label]++;
      }
    });

    const monthlyVisitActivity = Object.entries(visitCounts).map(([month, count]) => ({ month, count }));


    const recentLeads = await prisma.lead.findMany({
      where: {
        companyId: userPayload.companyId,
        deletedAt: null,
        ...(isExecutive ? { assignedUserId: userId } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        assignedUser: { select: { name: true } }
      }
    });

    const serializeVisit = (v: any) => ({
      ...v,
      checkInTime: v.checkInTime ? v.checkInTime.toISOString() : null,
      checkOutTime: v.checkOutTime ? v.checkOutTime.toISOString() : null,
      checkIn: v.checkIn ? v.checkIn.toISOString() : null,
      checkOut: v.checkOut ? v.checkOut.toISOString() : null,
      createdAt: v.createdAt ? v.createdAt.toISOString() : null,
      updatedAt: v.updatedAt ? v.updatedAt.toISOString() : null,
      nextMeetingDate: v.nextMeetingDate ? v.nextMeetingDate.toISOString() : null,
    });

    const serializeFollowUp = (f: any) => ({
      ...f,
      nextMeetingDate: f.nextMeetingDate ? f.nextMeetingDate.toISOString() : null,
      createdAt: f.createdAt ? f.createdAt.toISOString() : null,
      updatedAt: f.updatedAt ? f.updatedAt.toISOString() : null,
    });

    const serializeLead = (l: any) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      leadSource: l.leadSource,
      createdAt: l.createdAt.toISOString(),
      assignedUser: l.assignedUser ? { name: l.assignedUser.name } : null
    });

    return {
      success: true,
      data: {
        inboundVisits: inboundVisits.map(serializeVisit),
        outboundVisits: outboundVisits.map(serializeVisit),
        upcomingFollowUps: upcomingFollowUps.map(serializeFollowUp),
        overdueFollowUps: overdueFollowUps.map(serializeFollowUp),
        recentLeads: recentLeads.map(serializeLead),
        pendingApprovals: pendingApprovals,
        stats: {
          activeEngagement: conversionRate || 0,
          monthlyVisits: monthlyVisits || 0,
          activeSubs: activeSubs || 0,
          teamCount: teamCount || 0,
          totalCustomers: totalCustomers || 0,
          visitsToday: visitsToday || 0,
          inboundWalkIns,
          outboundWalkIns,
          approvedCount,
          rejectedCount,
          pendingCount,
          totalPlans,
          pendingPlans,
          expiredPlans,
          monthlyGrowth: monthlyGrowth || [],
          monthlyVisitActivity: monthlyVisitActivity || [],
          followUpMetrics: {
            total: totalFollowUps,
            pending: pendingFollowUps,
            overdue: overdueFollowUpsCount,
            completedToday: completedTodayFollowUps,
            dueToday: dueTodayFollowUps,
            upcoming: upcomingFollowUpsCount
          }
        }
      }
    };
  } catch (error) {
    console.error("Dashboard Data Action Error:", error);
    return { success: false, message: "Failed to load dashboard statistics" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. INBOUND WORKFLOWS (Customer Visits Suki Office)
// ═══════════════════════════════════════════════════════════════
export async function checkInInboundAction(data: {
  customerId: string;
  purpose: string;
  notes?: string;
  priority?: string;
  meetingType?: string;
  source?: string;
  agenda?: string;
  department?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, purpose, notes, priority, meetingType, source, agenda, department } = data;
    if (!customerId || !purpose) {
      return { success: false, message: "Customer ID and Purpose are required" };
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } });
    const userName = dbUser?.name || "Employee";

    // 1. Validate executive customer assignment / tenant scoping
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    // 2. Prevent check-in if this executive already has ANY active visit (Inbound or Outbound)
    const activeInbound = await prisma.customerVisit.findFirst({
      where: { hostedBy: userPayload.id, status: "CHECKED_IN", companyId: userPayload.companyId },
      include: { customer: { select: { name: true } } }
    });
    const activeOutbound = await prisma.marketingVisit.findFirst({
      where: { executiveId: userPayload.id, status: "CHECKED_IN", companyId: userPayload.companyId },
      include: { customer: { select: { name: true } } }
    });

    if (activeInbound) {
      return { success: false, message: `You already have an active office visit with ${activeInbound.customer?.name || "a customer"}. Please check out first before starting a new visit.` };
    }
    if (activeOutbound) {
      return { success: false, message: `You already have an active field visit with ${activeOutbound.customer?.name || "a customer"}. Please check out first before starting a new visit.` };
    }

    // 3. Create Inbound Visit
    const visit = await prisma.customerVisit.create({
      data: {
        customerId,
        hostedBy: userPayload.id,
        purpose,
        meetingSummary: notes || null,
        status: "CHECKED_IN",
        checkInTime: new Date(),
        priority: priority || "Normal",
        meetingType: meetingType || null,
        source: source || null,
        agenda: agenda || null,
        department: department || null,
        companyId: userPayload.companyId,
      }
    });

    // Notify admins, leads, and the executive about inbound check-in (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });
    const notifyUsers = Array.from(new Set([...adminsAndLeads.map(u => u.id), userPayload.id]));

    if (notifyUsers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: notifyUsers,
        title: "Customer Inbound Check-In",
        message: `${customer.name} arrived for ${purpose}. Hosted by ${userName}.`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "VISIT", "INBOUND_CHECK_IN", `Office visit registered: ${customerId} — ${purpose}`);
    revalidatePath("/dashboard");
    revalidatePath("/visitor-management");
    return { success: true, message: "Check-in successful", data: { id: visit.id } };
  } catch (error) {
    console.error("Inbound Checkin Error:", error);
    return { success: false, message: "Failed to register inbound check-in" };
  }
}

export async function checkOutInboundAction(data: {
  id: string;
  meetingSummary: string;
  outcome: string;
  customerDecision: string;
  rejectionReason?: string;
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, meetingSummary, outcome, customerDecision, rejectionReason, nextMeetingDate, nextMeetingNotes } = data;

    if (!id || !meetingSummary || !outcome || !customerDecision) {
      return { success: false, message: "Missing required checkout fields." };
    }

    // Outcomes that require a follow-up next meeting date
    const closedLostOutcomes = ["Closed Lost", "Not Interested", "Not Qualified"];

    const visit = await prisma.customerVisit.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!visit || !checkRecordScope(userPayload, visit, "CustomerVisit")) {
      return { success: false, message: "Visit not found or access denied." };
    }
    if (visit.status === "CHECKED_OUT") return { success: false, message: "Visit has already been checked out." };

    const { processVisitOutcome } = await import("@/lib/crm-pipeline");
    const pipelineRes = await processVisitOutcome(visit.id, "Inbound", outcome, customerDecision);

    if (!pipelineRes.success) {
      return { success: false, message: pipelineRes.error || "Invalid pipeline transition." };
    }

    const portalMsg = pipelineRes.portalMsg || "";

    if (customerDecision === "REJECTED" || closedLostOutcomes.includes(outcome)) {
      await logAudit(userPayload.id, "CUSTOMER", "REJECT", `Customer ${visit.customer.name} rejected. Reason: ${rejectionReason || "None"}. Outcome: ${outcome}`);
    }

    // Trigger Notification back to Customer if they submitted support/renewal requests and employee updates it
    if (["Support", "Subscription Discussion"].includes(visit.purpose)) {
      if (visit.customer?.email) {
        const customerUser = await prisma.user.findFirst({
          where: { email: visit.customer.email, role: "Customer", companyId: userPayload.companyId }
        });
        if (customerUser) {
          await dispatchNotification({
            userId: customerUser.id,
            title: visit.purpose === "Support" ? "Support Ticket Update" : "Renewal Request Update",
            message: `Your ${visit.purpose === "Support" ? "support request" : "renewal request"} status has been updated to: ${outcome}.`,
            type: "visit",
            link: visit.purpose === "Support" ? "/support" : "/subscription"
          });
        }
      }
    }

    // Create follow-up reminder if next date is provided
    if (nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId,
          assignedUserId: userPayload.id,
          nextMeetingDate: new Date(nextMeetingDate),
          dueDate: new Date(nextMeetingDate),
          remarks: nextMeetingNotes || null,
          status: "Pending",
          visitId: visit.id,
          visitType: "INBOUND",
          sourceType: "VISIT_CHECKOUT",
          sourceId: visit.id,
          autoCreated: true,
          companyId: userPayload.companyId,
        }
      });
    }

    // Update Visit Record
    const updatedVisit = await prisma.customerVisit.update({
      where: { id },
      data: {
        checkOutTime: new Date(),
        meetingSummary,
        outcome,
        customerDecision,
        rejectionReason: rejectionReason || null,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
        nextMeetingNotes: nextMeetingNotes || null,
        status: "CHECKED_OUT"
      }
    });

    // Notify admins, leads, and the executive about inbound check-out (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });
    const notifyUsers = Array.from(new Set([...adminsAndLeads.map(u => u.id), userPayload.id]));

    if (notifyUsers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: notifyUsers,
        title: "Customer Inbound Check-Out",
        message: `Inbound Customer Checked Out: ${visit.customer.name} visit completed. Outcome: ${outcome}.`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "VISIT", "INBOUND_CHECK_OUT", `Checked out customer from inbound visit ${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: `Checked out successfully.${portalMsg}`, data: { id: updatedVisit.id } };
  } catch (error) {
    console.error("Inbound Checkout Error:", error);
    return { success: false, message: "Failed to process checkout." };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. OUTBOUND WORKFLOWS (Executive Field Outbound Visits)
// ═══════════════════════════════════════════════════════════════
export async function checkInOutboundAction(data: {
  visitId?: string;
  customerId?: string;
  leadId?: string;
  purpose?: string;
  notes?: string;
  checkInLat?: number;
  checkInLng?: number;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { visitId, customerId, leadId, purpose, notes, checkInLat, checkInLng } = data;

    const dbUser = await prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } });
    const userName = dbUser?.name || "Employee";

    // Prevent check-in if this executive already has ANY active visit (Inbound or Outbound)
    const activeInbound = await prisma.customerVisit.findFirst({
      where: { hostedBy: userPayload.id, status: "CHECKED_IN", companyId: userPayload.companyId },
      include: { customer: { select: { name: true } } }
    });
    const activeOutboundVisit = await prisma.marketingVisit.findFirst({
      where: { executiveId: userPayload.id, status: "CHECKED_IN", companyId: userPayload.companyId },
      include: { customer: { select: { name: true } }, lead: { select: { name: true } } }
    });

    if (activeInbound) {
      return { success: false, message: `You already have an active office visit with ${activeInbound.customer?.name || "a customer"}. Please check out first before starting a new field visit.` };
    }
    if (activeOutboundVisit) {
      return { success: false, message: `You already have an active field visit with ${activeOutboundVisit.customer?.name || activeOutboundVisit.lead?.name || "a lead/customer"}. Please check out first before starting a new visit.` };
    }

    let updatedVisit;
    let targetName = "";

    if (visitId) {
      // Find the existing visit request
      const existingVisit = await prisma.marketingVisit.findUnique({
        where: { id: visitId },
        include: { customer: true, lead: true }
      });
      if (!existingVisit || !checkRecordScope(userPayload, existingVisit, "MarketingVisit")) {
        return { success: false, message: "Visit request not found or access denied." };
      }
      if (existingVisit.status !== "APPROVED" && existingVisit.status !== "REQUESTED") {
        return { success: false, message: `Cannot check in to a visit that is currently in status ${existingVisit.status}.` };
      }
      // If status is REQUESTED and user is SalesExecutive, block check-in
      if (existingVisit.status === "REQUESTED" && userPayload.role === "SalesExecutive") {
        return { success: false, message: "Marketing Executives must submit a visit request for approval before checking in." };
      }

      // Check-in to the approved request
      updatedVisit = await prisma.marketingVisit.update({
        where: { id: visitId },
        data: {
          status: "CHECKED_IN",
          checkIn: new Date(),
          checkInLat: checkInLat || null,
          checkInLng: checkInLng || null,
          remarks: notes || existingVisit.remarks
        },
        include: { customer: { select: { name: true } }, lead: { select: { name: true } } }
      });
      targetName = updatedVisit.customer?.name || updatedVisit.lead?.name || "Lead/Customer";
    } else {
      // Direct check-in (without a pre-approved request)
      if (userPayload.role === "SalesExecutive") {
        return { success: false, message: "Marketing Executives must submit a visit request for approval before checking in." };
      }

      if (!customerId && !leadId) {
        return { success: false, message: "Customer ID or Lead ID is required for direct check-in." };
      }
      if (!purpose) {
        return { success: false, message: "Purpose is required for direct check-in." };
      }

      if (customerId) {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
          return { success: false, message: "Customer not found or access denied." };
        }
      }
      if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead || !checkRecordScope(userPayload, lead, "Lead")) {
          return { success: false, message: "Lead not found or access denied." };
        }
      }

      // Create new visit and directly set status as CHECKED_IN
      updatedVisit = await prisma.marketingVisit.create({
        data: {
          executiveId: userPayload.id,
          customerId: customerId || null,
          leadId: leadId || null,
          purpose,
          remarks: notes || null,
          checkInLat: checkInLat || null,
          checkInLng: checkInLng || null,
          status: "CHECKED_IN",
          checkIn: new Date(),
          companyId: userPayload.companyId,
        },
        include: { customer: { select: { name: true } }, lead: { select: { name: true } } }
      });
      targetName = updatedVisit.customer?.name || updatedVisit.lead?.name || "Lead/Customer";
    }

    // Notify Admin and Leads about the outbound check-in (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });
    
    if (adminsAndLeads.length > 0) {
      await dispatchNotificationsToMany({
        userIds: adminsAndLeads.map(u => u.id),
        title: "New Outbound Field Visit",
        message: `${userName} started a field visit with ${targetName} for ${updatedVisit.purpose}`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "VISITS", "OUTBOUND_CHECKIN", `Field visit check-in: ${targetName} — ${updatedVisit.purpose}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: "Field Check-in successful", data: { id: updatedVisit.id } };
  } catch (error) {
    console.error("Outbound Checkin Error:", error);
    return { success: false, message: "Failed to register field visit check-in" };
  }
}

export async function checkOutOutboundAction(data: {
  id: string;
  meetingDescription: string;
  outcome: string;
  customerDecision: string;
  rejectionReason?: string;
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
  checkOutLat?: number;
  checkOutLng?: number;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, meetingDescription, outcome, customerDecision, rejectionReason, nextMeetingDate, nextMeetingNotes, checkOutLat, checkOutLng } = data;

    const dbUser = await prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } });
    const userName = dbUser?.name || "Employee";

    if (!id || !meetingDescription || !outcome || !customerDecision) {
      return { success: false, message: "Missing required checkout fields." };
    }

    const visit = await prisma.marketingVisit.findUnique({
      where: { id },
      include: { customer: true, lead: true }
    });

    if (!visit || !checkRecordScope(userPayload, visit, "MarketingVisit")) {
      return { success: false, message: "Field visit not found or access denied." };
    }
    if (visit.status === "CHECKED_OUT") return { success: false, message: "Visit has already been checked out." };

    const { processVisitOutcome } = await import("@/lib/crm-pipeline");
    const pipelineRes = await processVisitOutcome(visit.id, "Outbound", outcome, customerDecision);

    if (!pipelineRes.success) {
      return { success: false, message: pipelineRes.error || "Invalid pipeline transition." };
    }

    const portalMsg = pipelineRes.portalMsg || "";
    const targetName = visit.customer?.name || visit.lead?.name || "Lead/Customer";

    if (customerDecision === "REJECTED") {
      await logAudit(userPayload.id, "CUSTOMER", "REJECT", `Customer/Lead ${targetName} outcome: ${outcome}. Rejection reason: ${rejectionReason || "None"}.`);
    }

    // Create follow-up reminder if next date is provided
    if (nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId || null,
          leadId: visit.leadId || null,
          assignedUserId: userPayload.id,
          nextMeetingDate: new Date(nextMeetingDate),
          dueDate: new Date(nextMeetingDate),
          remarks: nextMeetingNotes || null,
          status: "Pending",
          visitId: visit.id,
          visitType: "OUTBOUND",
          sourceType: "VISIT_CHECKOUT",
          sourceId: visit.id,
          autoCreated: true,
          companyId: userPayload.companyId,
        }
      });
    }

    // Update Field Visit Record
    const updatedVisit = await prisma.marketingVisit.update({
      where: { id },
      data: {
        checkOut: new Date(),
        meetingDescription,
        outcome,
        customerDecision,
        rejectionReason: rejectionReason || null,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
        nextMeetingNotes: nextMeetingNotes || null,
        checkOutLat: checkOutLat || null,
        checkOutLng: checkOutLng || null,
        status: "CHECKED_OUT"
      }
    });

    // Notify admins, leads, and the executive about outbound check-out (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });
    const notifyUsers = Array.from(new Set([...adminsAndLeads.map(u => u.id), userPayload.id]));

    if (notifyUsers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: notifyUsers,
        title: "Outbound Visit Check-Out",
        message: `${userName} checked out from field visit with ${targetName}. Outcome: ${outcome}.`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "VISIT", "OUTBOUND_CHECK_OUT", `Executive checked out from field visit ${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: `Checked out successfully.${portalMsg}`, data: { id: updatedVisit.id } };
  } catch (error) {
    console.error("Outbound Checkout Error:", error);
    return { success: false, message: "Failed to process field check-out." };
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. VISIT HISTORY & MANAGEMENT
// ═══════════════════════════════════════════════════════════════
export async function getVisitHistoryAction(filters?: {
  startDate?: string;
  endDate?: string;
  visitType?: string; // Inbound / Outbound
  outcome?: string;
  decision?: string;
  executiveId?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Setup date filters
    let dateFilter = {};
    if (filters?.startDate || filters?.endDate) {
      dateFilter = {
        gte: filters?.startDate ? new Date(filters.startDate) : undefined,
        lte: filters?.endDate ? new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)) : undefined
      };
    }

    const customerVisitScope = buildScope(userPayload, "CustomerVisit");
    const marketingVisitScope = buildScope(userPayload, "MarketingVisit");

    // 1. Fetch Inbound visits (if type matches or is empty)
    let inbound: any[] = [];
    if (!filters?.visitType || filters.visitType === "Inbound") {
      inbound = await prisma.customerVisit.findMany({
        where: {
          ...customerVisitScope,
          ...(filters?.executiveId ? { hostedBy: filters.executiveId } : {}),
          checkInTime: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
          outcome: filters?.outcome || undefined,
          customerDecision: filters?.decision || undefined
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          host: { select: { id: true, name: true } }
        },
        orderBy: { checkInTime: "desc" }
      });
    }

    // 2. Fetch Outbound visits
    let outbound: any[] = [];
    if (!filters?.visitType || filters.visitType === "Outbound") {
      outbound = await prisma.marketingVisit.findMany({
        where: {
          ...marketingVisitScope,
          ...(filters?.executiveId ? { executiveId: filters.executiveId } : {}),
          checkIn: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
          outcome: filters?.outcome || undefined,
          customerDecision: filters?.decision || undefined
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          lead: { select: { id: true, name: true, leadCode: true } },
          executive: { select: { id: true, name: true } }
        },
        orderBy: { checkIn: "desc" }
      });
    }

    // Normalize and combine
    const normalizedInbound = inbound.map(v => ({
      id: v.id,
      customerId: v.customerId,
      customerName: v.customer.name,
      customerCode: v.customer.customerCode,
      visitType: "Inbound",
      purpose: v.purpose,
      checkInTime: v.checkInTime.toISOString(),
      checkOutTime: v.checkOutTime ? v.checkOutTime.toISOString() : null,
      status: v.status,
      outcome: v.outcome || "Pending Checkout",
      customerDecision: v.customerDecision || "Pending Decision",
      rejectionReason: v.rejectionReason,
      nextMeetingDate: v.nextMeetingDate ? v.nextMeetingDate.toISOString() : null,
      notes: v.meetingSummary,
      executiveName: v.host.name,
      executiveId: v.hostedBy,
      priority: v.priority,
      approvalStatus: v.approvalStatus,
      department: v.department,
      createdAt: v.createdAt.toISOString()
    }));

    const normalizedOutbound = outbound.map(v => ({
      id: v.id,
      customerId: v.customerId,
      customerName: v.customer?.name || v.lead?.name || "Unknown",
      customerCode: v.customer?.customerCode || v.lead?.leadCode || "N/A",
      leadId: v.leadId,
      visitType: "Outbound",
      purpose: v.purpose || "Field Visit",
      checkInTime: v.checkIn ? v.checkIn.toISOString() : "N/A",
      checkOutTime: v.checkOut ? v.checkOut.toISOString() : null,
      status: v.status,
      outcome: v.outcome || "Pending Checkout",
      customerDecision: v.customerDecision || "Pending Decision",
      rejectionReason: v.rejectionReason,
      nextMeetingDate: v.nextMeetingDate ? v.nextMeetingDate.toISOString() : null,
      notes: v.meetingDescription || v.remarks,
      executiveName: v.executive.name,
      executiveId: v.executiveId,
      createdAt: v.createdAt.toISOString()
    }));

    const allVisits = [...normalizedInbound, ...normalizedOutbound].sort(
      (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    );

    return { success: true, data: allVisits };
  } catch (error) {
    console.error("Get Visit History Error:", error);
    return { success: false, message: "Failed to load visit history" };
  }
}

export async function editVisitRemarksAction(id: string, type: "Inbound" | "Outbound", remarks: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    if (type === "Inbound") {
      const visit = await prisma.customerVisit.findUnique({ where: { id } });
      if (!visit || !checkRecordScope(userPayload, visit, "CustomerVisit")) {
        return { success: false, message: "Visit not found or access denied." };
      }
      
      const hoursDiff = (new Date().getTime() - visit.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) return { success: false, message: "Remarks can only be edited within 24 hours." };

      await prisma.customerVisit.update({
        where: { id },
        data: { meetingSummary: remarks }
      });
    } else {
      const visit = await prisma.marketingVisit.findUnique({ where: { id } });
      if (!visit || !checkRecordScope(userPayload, visit, "MarketingVisit")) {
        return { success: false, message: "Visit not found or access denied." };
      }

      const hoursDiff = (new Date().getTime() - visit.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) return { success: false, message: "Remarks can only be edited within 24 hours." };

      await prisma.marketingVisit.update({
        where: { id },
        data: { meetingDescription: remarks }
      });
    }

    await logAudit(userPayload.id, "VISIT", "EDIT_REMARKS", `Edited remarks for ${type} visit ${id}`);
    revalidatePath("/marketing-log");
    return { success: true, message: "Remarks updated successfully" };
  } catch (error) {
    console.error("Edit Remarks Error:", error);
    return { success: false, message: "Failed to edit remarks" };
  }
}

export async function deleteVisitAction(id: string, type: "Inbound" | "Outbound") {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    if (type === "Inbound") {
      const visit = await prisma.customerVisit.findUnique({ where: { id } });
      if (!visit || !checkRecordScope(userPayload, visit, "CustomerVisit")) {
        return { success: false, message: "Visit not found or access denied." };
      }
      await prisma.customerVisit.delete({ where: { id } });
    } else {
      const visit = await prisma.marketingVisit.findUnique({ where: { id } });
      if (!visit || !checkRecordScope(userPayload, visit, "MarketingVisit")) {
        return { success: false, message: "Visit not found or access denied." };
      }
      await prisma.marketingVisit.delete({ where: { id } });
    }

    await logAudit(userPayload.id, "VISIT", "DELETE", `Deleted ${type} visit ${id}`);
    revalidatePath("/marketing-log");
    return { success: true, message: "Visit record deleted successfully." };
  } catch (error) {
    console.error("Delete Visit Error:", error);
    return { success: false, message: "Failed to delete visit record." };
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. FOLLOW-UP REMINDER LIST
// ═══════════════════════════════════════════════════════════════
export async function getFollowUpsListAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const followUpsRes = await getFollowUpsAction();
    if (!followUpsRes.success || !followUpsRes.data) {
      return { success: false, message: followUpsRes.message || "Failed to fetch follow-ups" };
    }

    const now = new Date();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const normalized = (followUpsRes.data as any[]).map(f => {
      let badgeStatus: "UPCOMING" | "OVERDUE" | "TODAY" = "UPCOMING";
      if (f.status === "Completed" || f.status === "Cancelled") {
        badgeStatus = "UPCOMING";
      } else {
        const nextDate = new Date(f.nextMeetingDate);
        // Use current time (not midnight) for overdue detection
        if (nextDate < now) {
          badgeStatus = "OVERDUE";
        } else if (nextDate >= startOfToday && nextDate <= endOfToday) {
          badgeStatus = "TODAY";
        }
      }

      return {
        id: f.id,
        customerId: f.customerId,
        customerName: f.customer?.name,
        customer: f.customer || { phone: null } as any,
        customerCode: f.customer?.customerCode,
        customerStatus: f.customer?.status,
        leadId: f.leadId,
        leadName: f.lead?.name,
        leadCode: f.lead?.leadCode,
        nextMeetingDate: f.nextMeetingDate,
        createdAt: f.createdAt,
        notes: f.notes,
        remarks: f.remarks,
        completionNotes: f.completionNotes,
        completedAt: f.completedAt,
        completedById: f.completedById,
        completedBy: f.completedBy,
        assignedToName: f.user?.name,
        assignedUser: { name: f.user?.name } as any,
        assignedUserId: f.assignedUserId,
        visitId: f.visitId,
        visitType: f.visitType,
        status: f.status,
        priority: f.priority,
        sourceType: f.sourceType,
        sourceId: f.sourceId,
        autoCreated: f.autoCreated,
        escalationLevel: f.escalationLevel,
        badgeStatus
      };
    });

    return { success: true, data: normalized };
  } catch (error) {
    console.error("Get Followups Error:", error);
    return { success: false, message: "Failed to fetch follow-ups list" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. CUSTOMER DECISION SUMMARY (Lead View Only)
// ═══════════════════════════════════════════════════════════════
export async function getCustomerDecisionSummaryAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Marketing Lead or Admin only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const customerScope = buildScope(userPayload, "Customer");
    const customerVisitScope = buildScope(userPayload, "CustomerVisit");
    const marketingVisitScope = buildScope(userPayload, "MarketingVisit");

    // Dynamic stats aggregates
    const totalVisitedThisMonth = await prisma.customerVisit.count({
      where: {
        ...customerVisitScope,
        checkInTime: { gte: startOfMonth }
      }
    }) + await prisma.marketingVisit.count({
      where: {
        ...marketingVisitScope,
        checkIn: { gte: startOfMonth }
      }
    });

    const approvedCount = await prisma.marketingVisit.count({
      where: { ...marketingVisitScope, status: "APPROVED" }
    });

    const rejectedCount = await prisma.marketingVisit.count({
      where: { ...marketingVisitScope, status: "REJECTED" }
    });

    const pendingCount = await prisma.marketingVisit.count({
      where: { ...marketingVisitScope, status: "REQUESTED" }
    });

    const totalCustomers = await prisma.customer.count({
      where: customerScope
    });
    const conversionRate = totalCustomers > 0 
      ? Math.round((approvedCount / totalCustomers) * 100)
      : 0;

    const pendingCustomersList = await prisma.marketingVisit.findMany({
      where: {
        ...marketingVisitScope,
        status: "REQUESTED"
      },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, status: true, email: true, phone: true }
        },
        lead: {
          select: { id: true, name: true, leadCode: true, status: true, email: true, phone: true }
        },
        executive: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const visitHistory = await prisma.customerVisit.findMany({
      where: customerVisitScope,
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, status: true, email: true, phone: true }
        },
        host: {
          select: { id: true, name: true }
        }
      },
      orderBy: { checkInTime: "desc" }
    });

    return {
      success: true,
      data: {
        totalVisitedThisMonth,
        approvedCount,
        rejectedCount,
        pendingCount,
        conversionRate,
        pendingCustomersList,
        visitHistory
      }
    };
  } catch (error) {
    console.error("Get Decision Summary Error:", error);
    return { success: false, message: "Failed to fetch customer decision summary." };
  }
}

export async function updateCustomerStatusAction(params: { id: string; status: string; reason?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Lead or Admin only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, status, reason } = params;
    if (!id || !status) return { success: false, message: "ID and status are required." };

    // Check if updating a visit request status or a customer status
    const isVisitRequest = await prisma.marketingVisit.findUnique({ where: { id } });
    if (isVisitRequest) {
      if (!checkRecordScope(userPayload, isVisitRequest, "MarketingVisit")) {
        return { success: false, message: "Visit request not found or access denied." };
      }
      const updated = await prisma.marketingVisit.update({
        where: { id },
        data: {
          status: status as any,
          rejectionReason: status === "REJECTED" ? reason || null : null,
          approvedByUserId: userPayload.id,
          approvedAt: new Date()
        }
      });
      await logAudit(
        userPayload.id,
        "VISITS",
        status === "APPROVED" ? "APPROVE_VISIT" : "REJECT_VISIT",
        `Visit request ${id} updated to ${status}. Reason: ${reason || "None"}`
      );
    } else {
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
        return { success: false, message: "Customer not found or access denied." };
      }
      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: { status: status as any }
      });

      await logAudit(
        userPayload.id,
        "Customer",
        status === "APPROVED" ? "APPROVED" : "REJECTED",
        `Customer ${updatedCustomer.name} status updated to ${status}. Reason: ${reason || "None"}`
      );
    }

    revalidatePath("/decision-summary");
    return { success: true, message: `Status updated successfully.` };
  } catch (error) {
    console.error("Update Status Error:", error);
    return { success: false, message: "Failed to update status." };
  }
}

export async function createCustomerSupportAction(data: { subject: string; description: string; severity: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { subject, description, severity } = data;
    if (!subject || !description || !severity) {
      return { success: false, message: "Subject, description, and severity are required" };
    }

    const customer = await prisma.customer.findUnique({
      where: { email: userPayload.email },
    });
    if (!customer || customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Customer profile not found or access denied." };
    }

    let hostId = customer.assignedUserId;
    if (!hostId) {
      const firstAdmin = await prisma.user.findFirst({
        where: { role: "Admin", isActive: true, companyId: userPayload.companyId }
      });
      hostId = firstAdmin?.id || "";
    }

    if (!hostId) {
      return { success: false, message: "System error: No employee is available to host this request." };
    }

    const visit = await prisma.customerVisit.create({
      data: {
        customerId: customer.id,
        hostedBy: hostId,
        purpose: "Support",
        meetingSummary: `Support Ticket Subject: ${subject}. Description: ${description}`,
        outcome: "Enquired to IT",
        customerDecision: "PENDING",
        status: "CHECKED_IN",
        companyId: userPayload.companyId,
      }
    });

    const internalUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        companyId: userPayload.companyId,
        OR: [
          { role: { in: ["Admin", "SalesManager"] } },
          { id: hostId }
        ]
      }
    });

    if (internalUsers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: internalUsers.map(u => u.id),
        title: "New Support Request",
        message: `${customer.name} submitted a Support Ticket: '${subject}' (Severity: ${severity})`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "CUSTOMER_PORTAL", "SUPPORT_REQUESTED", `Customer filed support ticket: ${subject}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: "Support ticket registered successfully." };
  } catch (error) {
    console.error("Create Customer Support Error:", error);
    return { success: false, message: "Failed to submit support ticket." };
  }
}

export async function createCustomerRenewalRequestAction(data: { planName: string; notes: string; startDate: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { planName, notes, startDate } = data;
    if (!planName || !startDate) {
      return { success: false, message: "Plan name and start date are required" };
    }

    const customer = await prisma.customer.findUnique({
      where: { email: userPayload.email },
    });
    if (!customer || customer.companyId !== userPayload.companyId) {
      return { success: false, message: "Customer profile not found or access denied." };
    }

    let hostId = customer.assignedUserId;
    if (!hostId) {
      const firstAdmin = await prisma.user.findFirst({
        where: { role: "Admin", isActive: true, companyId: userPayload.companyId }
      });
      hostId = firstAdmin?.id || "";
    }

    if (!hostId) {
      return { success: false, message: "System error: No employee is available to host this request." };
    }

    const visit = await prisma.customerVisit.create({
      data: {
        customerId: customer.id,
        hostedBy: hostId,
        purpose: "Subscription Discussion",
        meetingSummary: `Renewal requested for plan: ${planName}. Notes: ${notes || "None"}`,
        outcome: "Renewal Requested",
        customerDecision: "PENDING",
        status: "CHECKED_IN",
        companyId: userPayload.companyId,
      }
    });

    const internalUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        companyId: userPayload.companyId,
        OR: [
          { role: { in: ["Admin", "SalesManager"] } },
          { id: hostId }
        ]
      }
    });

    if (internalUsers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: internalUsers.map(u => u.id),
        title: "Renewal Requested",
        message: `${customer.name} requested renewal for: '${planName}'`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "CUSTOMER_PORTAL", "RENEWAL_REQUESTED", `Customer requested renewal for: ${planName}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: "Renewal request submitted successfully." };
  } catch (error) {
    console.error("Create Customer Renewal Request Error:", error);
    return { success: false, message: "Failed to submit renewal request." };
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. VISIT APPROVAL ACTIONS (Admin / Lead only)
// ═══════════════════════════════════════════════════════════════
export async function requestOutboundVisitAction(data: {
  customerId?: string;
  leadId?: string;
  purpose: string;
  remarks?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, leadId, purpose, remarks } = data;
    if (!customerId && !leadId) {
      return { success: false, message: "Either Customer ID or Lead ID is required" };
    }
    if (!purpose) {
      return { success: false, message: "Purpose is required" };
    }

    // Access checks
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
        return { success: false, message: "Customer not found or access denied." };
      }
    }
    if (leadId) {
      const leadObj = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!leadObj || !checkRecordScope(userPayload, leadObj, "Lead")) {
        return { success: false, message: "Lead not found or access denied." };
      }
    }

    const newVisit = await prisma.marketingVisit.create({
      data: {
        executiveId: userPayload.id,
        customerId: customerId || null,
        leadId: leadId || null,
        purpose,
        remarks: remarks || null,
        status: "REQUESTED",
        companyId: userPayload.companyId,
      }
    });

    // Notify admins and leads (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });

    if (adminsAndLeads.length > 0) {
      const dbUser = await prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } });
      await dispatchNotificationsToMany({
        userIds: adminsAndLeads.map(u => u.id),
        title: "Visit Request Submitted",
        message: `${dbUser?.name || "Executive"} requested a field visit for purpose: ${purpose}`,
        type: "visit",
        link: "/marketing-log"
      });
    }

    await logAudit(userPayload.id, "VISITS", "REQUEST_VISIT", `Requested field visit for purpose: ${purpose}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");

    return { success: true, message: "Visit request submitted for approval", data: newVisit };
  } catch (error) {
    console.error("Request Outbound Visit Error:", error);
    return { success: false, message: "Failed to submit visit request" };
  }
}

export async function approveOutboundVisitAction(id: string, approve: boolean, rejectionReason?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesManager", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins and Leads only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const visit = await prisma.marketingVisit.findUnique({ where: { id } });
    if (!visit || !checkRecordScope(userPayload, visit, "MarketingVisit")) {
      return { success: false, message: "Visit request not found or access denied." };
    }
    if (visit.status !== "REQUESTED") {
      return { success: false, message: `Cannot update visit request that is already ${visit.status}.` };
    }

    const updatedStatus = approve ? "APPROVED" : "REJECTED";
    const updatedVisit = await prisma.marketingVisit.update({
      where: { id },
      data: {
        status: updatedStatus,
        approvedByUserId: userPayload.id,
        approvedAt: new Date(),
        rejectionReason: approve ? null : rejectionReason || null,
      }
    });

    // Notify requesting executive
    await dispatchNotification({
      userId: visit.executiveId,
      title: approve ? "Visit Request Approved" : "Visit Request Rejected",
      message: approve 
        ? `Your field visit request for "${visit.purpose}" has been approved.` 
        : `Your field visit request for "${visit.purpose}" was rejected. Reason: ${rejectionReason || "None"}.`,
      type: "visit",
      link: "/marketing-log"
    });

    await logAudit(
      userPayload.id, 
      "VISITS", 
      approve ? "APPROVE_VISIT" : "REJECT_VISIT", 
      `Visit request ${id} ${approve ? "approved" : "rejected"}`
    );
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");

    return { success: true, message: `Visit request ${approve ? "approved" : "rejected"} successfully`, data: updatedVisit };
  } catch (error) {
    console.error("Approve Outbound Visit Error:", error);
    return { success: false, message: "Failed to update visit request status" };
  }
}

export async function rejectOutboundVisitAction(id: string, rejectionReason?: string) {
  return approveOutboundVisitAction(id, false, rejectionReason);
}
