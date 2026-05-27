"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { activateCustomerPortal } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

/** Helper: checks if user has permission for a specific customer */
async function validateCustomerAccess(customerId: string, userId: string, role: string) {
  if (role === "MarketingExecutive") {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    return customer?.assignedUserId === userId;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// 1. DASHBOARD DATA LOADER
// ═══════════════════════════════════════════════════════════════
export async function getDashboardDataAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const userId = userPayload.id;
    const isExecutive = userPayload.role === "MarketingExecutive";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOf7Days = new Date();
    startOf7Days.setHours(0, 0, 0, 0);
    const endOf7Days = new Date();
    endOf7Days.setDate(endOf7Days.getDate() + 7);
    endOf7Days.setHours(23, 59, 59, 999);

    // 1. Today's Inbound Visits
    const inboundVisits = await prisma.customerVisit.findMany({
      where: {
        AND: [
          isExecutive ? { hostedBy: userId } : {},
          {
            OR: [
              { status: "CHECKED_IN" },
              { checkInTime: { gte: startOfToday, lte: endOfToday } }
            ]
          }
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
        AND: [
          isExecutive ? { executiveId: userId } : {},
          {
            OR: [
              { status: "CHECKED_IN" },
              { checkIn: { gte: startOfToday, lte: endOfToday } }
            ]
          }
        ]
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true } }
      },
      orderBy: { checkIn: "desc" }
    });

    // 3. Upcoming Follow-ups (Next 7 Days)
    const upcomingFollowUps = await prisma.followUp.findMany({
      where: {
        assignedUserId: isExecutive ? userId : undefined,
        nextMeetingDate: { gte: startOf7Days, lte: endOf7Days },
        status: "Pending"
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } }
      },
      orderBy: { nextMeetingDate: "asc" }
    });

    // 4. Overdue Follow-ups
    const overdueFollowUps = await prisma.followUp.findMany({
      where: {
        assignedUserId: isExecutive ? userId : undefined,
        nextMeetingDate: { lt: startOfToday },
        status: "Pending"
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } }
      },
      orderBy: { nextMeetingDate: "asc" }
    });

    // 5. Pending Customer Approvals (Waiting for decision)
    const pendingApprovals = await prisma.customer.findMany({
      where: {
        status: "PENDING",
        assignedUserId: isExecutive ? userId : undefined,
      },
      include: {
        assignedUser: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Compute Engagement Metrics (for the top mock banner)
    // Counts for this billing month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const totalCustomers = await prisma.customer.count({
      where: isExecutive ? { assignedUserId: userId } : {}
    });

    const activeSubs = await prisma.subscription.count({
      where: {
        status: "Active",
        customer: isExecutive ? { assignedUserId: userId } : {}
      }
    });

    const monthlyVisits = await prisma.marketingVisit.count({
      where: {
        checkIn: { gte: startOfMonth },
        executiveId: isExecutive ? userId : undefined
      }
    }) + await prisma.customerVisit.count({
      where: {
        checkInTime: { gte: startOfMonth },
        hostedBy: isExecutive ? userId : undefined
      }
    });

    const teamCount = await prisma.user.count({
      where: { isActive: true, role: { in: ["MarketingExecutive", "MarketingLead"] } }
    });

    const visitsToday = await prisma.marketingVisit.count({
      where: {
        checkIn: { gte: startOfToday, lte: endOfToday },
        executiveId: isExecutive ? userId : undefined
      }
    }) + await prisma.customerVisit.count({
      where: {
        checkInTime: { gte: startOfToday, lte: endOfToday },
        hostedBy: isExecutive ? userId : undefined
      }
    });

    // Calculate Engagement Rate
    const conversionRate = totalCustomers > 0 
      ? Math.round((await prisma.customer.count({
          where: {
            status: "APPROVED",
            assignedUserId: isExecutive ? userId : undefined
          }
        }) / totalCustomers) * 1000) / 10
      : 0;

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

    const serializeCustomer = (c: any) => ({
      ...c,
      createdAt: c.createdAt ? c.createdAt.toISOString() : null,
      updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
    });

    return {
      success: true,
      data: {
        inboundVisits: inboundVisits.map(serializeVisit),
        outboundVisits: outboundVisits.map(serializeVisit),
        upcomingFollowUps: upcomingFollowUps.map(serializeFollowUp),
        overdueFollowUps: overdueFollowUps.map(serializeFollowUp),
        pendingApprovals: pendingApprovals.map(serializeCustomer),
        stats: {
          activeEngagement: conversionRate || 0,
          monthlyVisits: monthlyVisits || 0,
          activeSubs: activeSubs || 0,
          teamCount: teamCount || 0,
          totalCustomers: totalCustomers || 0,
          visitsToday: visitsToday || 0
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
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["MarketingExecutive", "MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { customerId, purpose, notes } = data;
    if (!customerId || !purpose) {
      return { success: false, message: "Customer ID and Purpose are required" };
    }

    // 1. Validate executive customer assignment
    const hasAccess = await validateCustomerAccess(customerId, userPayload.id, userPayload.role);
    if (!hasAccess) {
      return { success: false, message: "Unauthorized: This customer is not assigned to you." };
    }

    // 2. Prevent duplicate check-in today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const activeVisit = await prisma.customerVisit.findFirst({
      where: {
        customerId,
        status: "CHECKED_IN"
      }
    });

    if (activeVisit) {
      return { success: false, message: "Customer is already checked in. Please check out previous visit first." };
    }

    // 3. Create Inbound Visit
    const visit = await prisma.customerVisit.create({
      data: {
        customerId,
        hostedBy: userPayload.id,
        purpose,
        meetingSummary: notes || null,
        status: "CHECKED_IN",
        checkInTime: new Date()
      }
    });

    await logAudit(userPayload.id, "VISIT", "INBOUND_CHECK_IN", `Walk-in registered: Checked in customer ${customerId}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Check-in successful", data: { ...visit, checkInTime: visit.checkInTime.toISOString(), checkOutTime: visit.checkOutTime?.toISOString() ?? null, createdAt: visit.createdAt.toISOString(), updatedAt: visit.updatedAt.toISOString() } };
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
    if (!userPayload || !["MarketingExecutive", "MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { id, meetingSummary, outcome, customerDecision, rejectionReason, nextMeetingDate, nextMeetingNotes } = data;

    if (!id || !meetingSummary || !outcome || !customerDecision) {
      return { success: false, message: "Missing required checkout fields." };
    }

    // Validate next meeting requirement
    const isNextMeetingRequired = !["Converted", "Not Interested"].includes(outcome);
    if (isNextMeetingRequired && !nextMeetingDate) {
      return { success: false, message: "Next meeting date is required for the chosen outcome." };
    }

    const visit = await prisma.customerVisit.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!visit) return { success: false, message: "Visit not found." };
    if (visit.status === "CHECKED_OUT") return { success: false, message: "Visit has already been checked out." };

    // Update Customer Status & Triggers based on decision
    let portalMsg = "";
    if (customerDecision === "APPROVED") {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "APPROVED" as any }
      });
      // Send Portal Activation Email
      const emailRes = await activateCustomerPortal(visit.customerId);
      if (emailRes.success) {
        portalMsg = " Portal activation link emailed.";
      }
    } else if (customerDecision === "REJECTED") {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "REJECTED" as any }
      });
      await logAudit(userPayload.id, "CUSTOMER", "REJECT", `Customer ${visit.customer.name} rejected. Reason: ${rejectionReason || "None"}`);
    } else {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "PENDING" as any }
      });
    }

    // Create follow-up reminder if next date is provided
    if (nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId,
          assignedUserId: userPayload.id,
          nextMeetingDate: new Date(nextMeetingDate),
          remarks: nextMeetingNotes || null,
          status: "Pending",
          visitId: visit.id,
          visitType: "INBOUND"
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

    await logAudit(userPayload.id, "VISIT", "INBOUND_CHECK_OUT", `Checked out customer from inbound visit ${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: `Checked out successfully.${portalMsg}`, data: { ...updatedVisit, checkInTime: updatedVisit.checkInTime.toISOString(), checkOutTime: updatedVisit.checkOutTime?.toISOString() ?? null, createdAt: updatedVisit.createdAt.toISOString(), updatedAt: updatedVisit.updatedAt.toISOString(), nextMeetingDate: updatedVisit.nextMeetingDate?.toISOString() ?? null } };
  } catch (error) {
    console.error("Inbound Checkout Error:", error);
    return { success: false, message: "Failed to process checkout." };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. OUTBOUND WORKFLOWS (Executive Field Outbound Visits)
// ═══════════════════════════════════════════════════════════════
export async function checkInOutboundAction(data: {
  customerId: string;
  purpose: string;
  notes?: string;
  checkInLat?: number;
  checkInLng?: number;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["MarketingExecutive", "MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { customerId, purpose, notes, checkInLat, checkInLng } = data;
    if (!customerId || !purpose) {
      return { success: false, message: "Customer ID and Purpose are required" };
    }

    // 1. Validate customer access
    const hasAccess = await validateCustomerAccess(customerId, userPayload.id, userPayload.role);
    if (!hasAccess) {
      return { success: false, message: "Unauthorized: Customer is not assigned to you." };
    }

    // 2. Prevent duplicate check-in today
    const activeVisit = await prisma.marketingVisit.findFirst({
      where: {
        customerId,
        status: "CHECKED_IN"
      }
    });

    if (activeVisit) {
      return { success: false, message: "Customer is already checked in. Please check out previous field visit first." };
    }

    // 3. Log Outbound Visit
    const visit = await prisma.marketingVisit.create({
      data: {
        customerId,
        executiveId: userPayload.id,
        purpose,
        remarks: notes || null,
        checkInLat: checkInLat || null,
        checkInLng: checkInLng || null,
        status: "CHECKED_IN",
        checkIn: new Date()
      }
    });

    await logAudit(userPayload.id, "VISIT", "OUTBOUND_CHECK_IN", `Field visit logged: Executive checked in to customer ${customerId}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Field Check-in successful", data: { ...visit, checkIn: visit.checkIn.toISOString(), checkOut: visit.checkOut?.toISOString() ?? null, createdAt: visit.createdAt.toISOString(), updatedAt: visit.updatedAt.toISOString() } };
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
    if (!userPayload || !["MarketingExecutive", "MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { id, meetingDescription, outcome, customerDecision, rejectionReason, nextMeetingDate, nextMeetingNotes, checkOutLat, checkOutLng } = data;

    if (!id || !meetingDescription || !outcome || !customerDecision) {
      return { success: false, message: "Missing required checkout fields." };
    }

    // Validate next meeting requirement
    const isNextMeetingRequired = !["Converted", "Not Interested"].includes(outcome);
    if (isNextMeetingRequired && !nextMeetingDate) {
      return { success: false, message: "Next meeting date is required for the chosen outcome." };
    }

    const visit = await prisma.marketingVisit.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!visit) return { success: false, message: "Field visit not found." };
    if (visit.status === "CHECKED_OUT") return { success: false, message: "Visit has already been checked out." };

    // Update Customer Status & Portal Email
    let portalMsg = "";
    if (customerDecision === "APPROVED") {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "APPROVED" as any }
      });
      const emailRes = await activateCustomerPortal(visit.customerId);
      if (emailRes.success) {
        portalMsg = " Portal activation link emailed.";
      }
    } else if (customerDecision === "REJECTED") {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "REJECTED" as any }
      });
      await logAudit(userPayload.id, "CUSTOMER", "REJECT", `Customer ${visit.customer.name} rejected during field check-out.`);
    } else {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: { status: "PENDING" as any }
      });
    }

    // Create follow-up reminder if next date is provided
    if (nextMeetingDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId,
          assignedUserId: userPayload.id,
          nextMeetingDate: new Date(nextMeetingDate),
          remarks: nextMeetingNotes || null,
          status: "Pending",
          visitId: visit.id,
          visitType: "OUTBOUND"
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

    await logAudit(userPayload.id, "VISIT", "OUTBOUND_CHECK_OUT", `Executive checked out from field visit ${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/marketing-log");
    return { success: true, message: `Checked out successfully.${portalMsg}`, data: { ...updatedVisit, checkIn: updatedVisit.checkIn.toISOString(), checkOut: updatedVisit.checkOut?.toISOString() ?? null, createdAt: updatedVisit.createdAt.toISOString(), updatedAt: updatedVisit.updatedAt.toISOString(), nextMeetingDate: updatedVisit.nextMeetingDate?.toISOString() ?? null } };
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

    const userId = userPayload.id;
    const isExecutive = userPayload.role === "MarketingExecutive";

    // Setup date filters
    let dateFilter = {};
    if (filters?.startDate || filters?.endDate) {
      dateFilter = {
        gte: filters?.startDate ? new Date(filters.startDate) : undefined,
        lte: filters?.endDate ? new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)) : undefined
      };
    }

    // 1. Fetch Inbound visits (if type matches or is empty)
    let inbound = [];
    if (!filters?.visitType || filters.visitType === "Inbound") {
      inbound = await prisma.customerVisit.findMany({
        where: {
          hostedBy: isExecutive ? userId : filters?.executiveId || undefined,
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
    let outbound = [];
    if (!filters?.visitType || filters.visitType === "Outbound") {
      outbound = await prisma.marketingVisit.findMany({
        where: {
          executiveId: isExecutive ? userId : filters?.executiveId || undefined,
          checkIn: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
          outcome: filters?.outcome || undefined,
          customerDecision: filters?.decision || undefined
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
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
      outcome: v.outcome || "Pending Checkout",
      customerDecision: v.customerDecision || "Pending Decision",
      rejectionReason: v.rejectionReason,
      nextMeetingDate: v.nextMeetingDate ? v.nextMeetingDate.toISOString() : null,
      notes: v.meetingSummary,
      executiveName: v.host.name,
      executiveId: v.hostedBy,
      createdAt: v.createdAt.toISOString()
    }));

    const normalizedOutbound = outbound.map(v => ({
      id: v.id,
      customerId: v.customerId,
      customerName: v.customer.name,
      customerCode: v.customer.customerCode,
      visitType: "Outbound",
      purpose: v.purpose || "Field Visit",
      checkInTime: v.checkIn.toISOString(),
      checkOutTime: v.checkOut ? v.checkOut.toISOString() : null,
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

    if (type === "Inbound") {
      const visit = await prisma.customerVisit.findUnique({ where: { id } });
      if (!visit) return { success: false, message: "Visit not found." };
      
      const hoursDiff = (new Date().getTime() - visit.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) return { success: false, message: "Remarks can only be edited within 24 hours." };

      await prisma.customerVisit.update({
        where: { id },
        data: { meetingSummary: remarks }
      });
    } else {
      const visit = await prisma.marketingVisit.findUnique({ where: { id } });
      if (!visit) return { success: false, message: "Visit not found." };

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
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    if (type === "Inbound") {
      await prisma.customerVisit.delete({ where: { id } });
    } else {
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

    const userId = userPayload.id;
    const isExecutive = userPayload.role === "MarketingExecutive";

    const followUps = await prisma.followUp.findMany({
      where: isExecutive ? { assignedUserId: userId } : {},
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        assignedUser: { select: { id: true, name: true } }
      },
      orderBy: { nextMeetingDate: "asc" }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    const normalized = followUps.map(f => {
      let badgeStatus: "UPCOMING" | "OVERDUE" | "TODAY" = "UPCOMING";
      if (f.status === "Completed") {
        badgeStatus = "UPCOMING"; // Completed, can be shown as non-urgent
      } else {
        const nextDate = new Date(f.nextMeetingDate);
        if (nextDate < startOfToday) {
          badgeStatus = "OVERDUE";
        } else if (nextDate >= startOfToday && nextDate <= endOfToday) {
          badgeStatus = "TODAY";
        }
      }

      return {
        id: f.id,
        customerId: f.customerId,
        customerName: f.customer.name,
        customerCode: f.customer.customerCode,
        nextMeetingDate: f.nextMeetingDate.toISOString(),
        notes: f.remarks || f.notes,
        assignedToName: f.assignedUser.name,
        visitId: f.visitId,
        visitType: f.visitType,
        status: f.status,
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
    if (!userPayload || !["MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Marketing Lead or Admin only." };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Dynamic stats aggregates
    const totalVisitedThisMonth = await prisma.customerVisit.count({
      where: { checkInTime: { gte: startOfMonth } }
    }) + await prisma.marketingVisit.count({
      where: { checkIn: { gte: startOfMonth } }
    });

    const approvedCount = await prisma.customer.count({
      where: { status: "APPROVED" as any }
    });

    const rejectedCount = await prisma.customer.count({
      where: { status: "REJECTED" as any }
    });

    const pendingCount = await prisma.customer.count({
      where: { status: "PENDING" as any }
    });

    const totalCustomers = await prisma.customer.count();
    const conversionRate = totalCustomers > 0 
      ? Math.round((approvedCount / totalCustomers) * 100)
      : 0;

    const pendingCustomersList = await prisma.customer.findMany({
      where: { status: "PENDING" as any },
      include: {
        assignedUser: { select: { id: true, name: true } },
        subscriptions: { select: { id: true, planName: true, status: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    return {
      success: true,
      data: {
        totalVisitedThisMonth,
        approvedCount,
        rejectedCount,
        pendingCount,
        conversionRate,
        pendingCustomersList
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
    if (!userPayload || !["MarketingLead", "Admin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Lead or Admin only." };
    }

    const { id, status, reason } = params;
    if (!id || !status) return { success: false, message: "Customer ID and status are required." };

    const customer = await prisma.customer.update({
      where: { id },
      data: { status: status as any }
    });

    await logAudit(
      userPayload.id,
      "Customer",
      status === "APPROVED" ? "APPROVED" : "REJECTED",
      `Customer ${customer.name} status updated to ${status}. Reason: ${reason || "None"}`
    );

    revalidatePath("/decision-summary");
    return { success: true, message: `Customer status updated successfully.` };
  } catch (error) {
    console.error("Update Customer Status Error:", error);
    return { success: false, message: "Failed to update customer status." };
  }
}
