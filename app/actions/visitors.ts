"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

export async function getVisitorsAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const whereClause: any = {
      host: {
        companyId: userPayload.companyId
      }
    };

    if (userPayload.role === "SalesExecutive") {
      whereClause.hostUserId = userPayload.id;
    }

    const visitors = await prisma.visitor.findMany({
      where: whereClause,
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
      orderBy: { inTime: "desc" },
    });

    const normalized = visitors.map((v) => ({
      ...v,
      name:         v.visitorName,
      email:        v.visitorEmail,
      phone:        v.visitorPhone,
      hostName:     v.host?.name ?? null,
      checkInTime:  v.inTime.toISOString(),
      checkOutTime: v.outTime?.toISOString() ?? null,
      inTime:       v.inTime.toISOString(),
      outTime:      v.outTime?.toISOString() ?? null,
      createdAt:    v.createdAt.toISOString(),
      updatedAt:    v.updatedAt.toISOString(),
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET Visitors Error:", error);
    return { success: false, message: "Failed to fetch visitors" };
  }
}

export async function createVisitorAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { name, email, phone, company, purpose } = data;

    if (!name || !phone || !purpose) {
      return { success: false, message: "Name, Phone, and Purpose are required" };
    }

    const visitor = await prisma.visitor.create({
      data: {
        visitorName:  name,
        visitorEmail: email || null,
        visitorPhone: phone,
        company:      company || "",
        purpose,
        hostUserId:   userPayload.id,
        inTime:       new Date(),
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "visitor",
      "create",
      `Walk-in registered: ${name} visited ${visitor.host?.name ?? "office"}`
    );

    // Notify Admin and Leads about the walk-in (scoped to tenant)
    const adminsAndLeads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["Admin", "SalesManager"] }, companyId: userPayload.companyId }
    });
    
    if (adminsAndLeads.length > 0) {
      await dispatchNotificationsToMany({
        userIds: adminsAndLeads.map(u => u.id),
        title: "New Visitor Walk-in",
        message: `${name} from ${company || "unknown"} checked in to meet ${visitor.host?.name ?? "someone"}`,
        type: "visit",
        link: "/visitor-management"
      });
    }

    return {
      success: true,
      message: "Visitor registered successfully",
      data: {
        ...visitor,
        name:         visitor.visitorName,
        email:        visitor.visitorEmail,
        phone:        visitor.visitorPhone,
        hostName:     visitor.host?.name ?? null,
        checkInTime:  visitor.inTime.toISOString(),
        checkOutTime: null,
      }
    };
  } catch (error) {
    console.error("POST Visitor Error:", error);
    return { success: false, message: "Failed to create visitor" };
  }
}

export async function checkoutVisitorAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id } = data;
    if (!id) return { success: false, message: "Visitor ID is required" };

    const existing = await prisma.visitor.findUnique({
      where: { id },
      include: { host: true }
    });
    if (!existing || existing.host.companyId !== userPayload.companyId) {
      return { success: false, message: "Visitor record not found or access denied." };
    }
    if (userPayload.role === "SalesExecutive" && existing.hostUserId !== userPayload.id) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const visitor = await prisma.visitor.update({
      where: { id },
      data:  { outTime: new Date() },
    });

    await logAudit(userPayload.id, "visitor", "checkout", `Visitor ${visitor.visitorName} checked out`);

    return {
      success: true,
      message: "Visitor checked out",
      data: { ...visitor, checkOutTime: visitor.outTime?.toISOString() ?? null }
    };
  } catch (error) {
    console.error("Checkout Visitor Error:", error);
    return { success: false, message: "Failed to checkout visitor" };
  }
}

export async function deleteVisitorAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Only Admins can delete visitors" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    if (!id) return { success: false, message: "Visitor ID is required" };

    const visitor = await prisma.visitor.findUnique({
      where: { id },
      include: { host: true }
    });
    if (!visitor || visitor.host.companyId !== userPayload.companyId) {
      return { success: false, message: "Visitor not found or access denied." };
    }

    await prisma.visitor.delete({ where: { id } });

    await logAudit(
      userPayload.id,
      "visitor",
      "delete",
      `Visitor record deleted: ${visitor.visitorName}`
    );

    return { success: true, message: "Visitor deleted successfully" };
  } catch (error) {
    console.error("Delete Visitor Error:", error);
    return { success: false, message: "Failed to delete visitor" };
  }
}

export async function getUnifiedOfficeVisitsAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const userId = userPayload.id;
    const isExecutive = userPayload.role === "SalesExecutive";

    // 1. Fetch general walk-in guests
    const guests = await prisma.visitor.findMany({
      where: {
        host: { companyId: userPayload.companyId },
        ...(isExecutive ? { hostUserId: userId } : {})
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
      orderBy: { inTime: "desc" },
    });

    // 2. Fetch CRM customer inbound visits
    const customerVisits = await prisma.customerVisit.findMany({
      where: {
        companyId: userPayload.companyId,
        ...(isExecutive ? { hostedBy: userId } : {})
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true } },
        host: { select: { id: true, name: true } },
      },
      orderBy: { checkInTime: "desc" },
    });

    // 2b. Fetch FollowUps for these visits
    const followUps = await prisma.followUp.findMany({
      where: {
        companyId: userPayload.companyId,
        visitId: { in: customerVisits.map(cv => cv.id) },
        visitType: "INBOUND"
      }
    });
    const followUpMap = new Map(followUps.map(f => [f.visitId, f.status]));

    // 3. Normalize guests
    const normalizedGuests = guests.map((g) => ({
      id: g.id,
      type: "Guest" as const,
      name: g.visitorName,
      contact: g.visitorPhone,
      email: g.visitorEmail || null,
      company: g.company || "",
      purpose: g.purpose,
      hostName: g.host?.name || "Unknown",
      hostId: g.hostUserId,
      checkInTime: g.inTime.toISOString(),
      checkOutTime: g.outTime ? g.outTime.toISOString() : null,
      status: g.outTime ? "CHECKED_OUT" : "CHECKED_IN",
      outcome: "Walk-in Guest",
      customerDecision: null,
      rejectionReason: null,
    }));

    // 4. Normalize customer visits
    const normalizedCustomers = customerVisits.map((cv) => ({
      id: cv.id,
      type: "Customer" as const,
      name: cv.customer?.name || "Unknown Customer",
      contact: cv.customer?.phone || "—",
      email: null,
      company: "",
      purpose: cv.purpose,
      hostName: cv.host?.name || "Unknown Host",
      hostId: cv.hostedBy,
      checkInTime: cv.checkInTime.toISOString(),
      checkOutTime: cv.checkOutTime ? cv.checkOutTime.toISOString() : null,
      status: cv.status, // "CHECKED_IN" | "CHECKED_OUT"
      outcome: cv.outcome || "Pending Checkout",
      customerDecision: cv.customerDecision || "Pending Decision",
      rejectionReason: cv.rejectionReason || null,
      customerCode: cv.customer?.customerCode || "—",
      customerId: cv.customerId,
      followUpStatus: followUpMap.get(cv.id) || null,
    }));

    // 5. Combine and sort
    const combined = [...normalizedGuests, ...normalizedCustomers].sort(
      (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    );

    return { success: true, data: combined };
  } catch (error) {
    console.error("GET Unified Office Visits Error:", error);
    return { success: false, message: "Failed to fetch office visits logs" };
  }
}

export async function promoteVisitorToCustomerAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Only Admin and Leads can promote walk-ins" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const visitor = await prisma.visitor.findUnique({
      where: { id },
      include: { host: { select: { name: true, companyId: true } } }
    });
    if (!visitor || visitor.host.companyId !== userPayload.companyId) {
      return { success: false, message: "Visitor not found or access denied." };
    }

    // Verify email/phone unique constraint within the company
    if (visitor.visitorEmail) {
      const existing = await prisma.customer.findFirst({
        where: { email: visitor.visitorEmail, companyId: userPayload.companyId }
      });
      if (existing) return { success: false, message: "A customer with this email already exists" };
    }
    if (visitor.visitorPhone) {
      const existing = await prisma.customer.findFirst({
        where: { phone: visitor.visitorPhone, companyId: userPayload.companyId }
      });
      if (existing) return { success: false, message: "A customer with this phone number already exists" };
    }

    // Fetch system configurations from database
    const configs = await prisma.systemConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const assignmentMode = configMap.get("leads_assignment_mode") || "ROUND_ROBIN";
    const defaultAssigneeId = configMap.get("leads_default_assignee_id") || "";

    let assignedUser = null;

    if (assignmentMode === "DEFAULT_POOL" && defaultAssigneeId) {
      assignedUser = await prisma.user.findFirst({
        where: { id: defaultAssigneeId, isActive: true, companyId: userPayload.companyId },
        select: { id: true, name: true },
      });
    }

    if (!assignedUser) {
      // Fetch active executives scoped to tenant
      let executives = await prisma.user.findMany({
        where: { role: "SalesExecutive", isActive: true, companyId: userPayload.companyId },
        select: { id: true, name: true, _count: { select: { assignedCustomers: true } } }
      });
      if (executives.length === 0) {
        executives = await prisma.user.findMany({
          where: { role: "SalesManager", isActive: true, companyId: userPayload.companyId },
          select: { id: true, name: true, _count: { select: { assignedCustomers: true } } }
        });
      }
      if (executives.length > 0) {
        executives.sort((a, b) => a._count.assignedCustomers - b._count.assignedCustomers);
        assignedUser = executives[0];
      } else {
        assignedUser = await prisma.user.findFirst({
          where: { role: "Admin", isActive: true, companyId: userPayload.companyId }
        });
      }
    }

    // Generate customerCode
    let customerCode = "";
    let isUnique = false;
    while (!isUnique) {
      customerCode = `CUST-W${Math.floor(10000 + Math.random() * 90000)}`;
      const existing = await prisma.customer.findFirst({
        where: { customerCode, companyId: userPayload.companyId }
      });
      if (!existing) isUnique = true;
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        customerCode,
        name: visitor.visitorName,
        email: visitor.visitorEmail,
        phone: visitor.visitorPhone,
        status: "Prospect",
        assignedUserId: assignedUser?.id || null,
        leadSource: "WalkIn",
        companyId: userPayload.companyId,
      }
    });

    await logAudit(
      userPayload.id,
      "customer",
      "create",
      `Customer record created from promoted visitor: ${customer.name} (${customer.customerCode})`
    );

    // Create CustomerVisit
    await prisma.customerVisit.create({
      data: {
        customerId: customer.id,
        hostedBy: visitor.hostUserId,
        purpose: visitor.purpose,
        checkInTime: visitor.inTime,
        checkOutTime: visitor.outTime,
        meetingSummary: `Promoted from Walk-in Guest entry. Original Host: ${visitor.host?.name || "System"}`,
        outcome: "Walk-in Guest",
        customerDecision: "APPROVED",
        status: visitor.outTime ? "CHECKED_OUT" : "CHECKED_IN",
        companyId: userPayload.companyId,
      }
    });

    await logAudit(
      userPayload.id,
      "customer_visit",
      "create",
      `Customer visit recorded from promoted visitor: ${customer.customerCode}`
    );

    // Create automatic next-day follow-up task
    if (assignedUser) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
      
      await prisma.followUp.create({
        data: {
          customerId: customer.id,
          assignedUserId: assignedUser.id,
          nextMeetingDate: tomorrow,
          dueDate: tomorrow,
          remarks: `Auto-generated follow-up: Promoted visitor ${customer.name}. Original purpose: ${visitor.purpose}`,
          status: "Pending",
          sourceType: "VISIT_CHECKOUT",
          autoCreated: true,
          companyId: userPayload.companyId,
        },
      });

      await logAudit(
        userPayload.id,
        "follow_up",
        "create",
        `Auto-generated follow-up task created for promoted visitor: ${customer.customerCode}`
      );
    }

    // Create CallLog entry
    if (assignedUser) {
      await prisma.callLog.create({
        data: {
          customerId: customer.id,
          notes: `Walk-in Guest promoted to CRM Lead. Original purpose: "${visitor.purpose}". Original Host: ${visitor.host?.name || "System"}`,
          duration: 0,
          userId: userPayload.id,
        },
      });

      await logAudit(
        userPayload.id,
        "call_log",
        "create",
        `Initial call log created for promoted visitor: ${customer.customerCode}`
      );
    }

    // Delete visitor record
    await prisma.visitor.delete({ where: { id } });

    await logAudit(
      userPayload.id,
      "visitor",
      "delete",
      `Deleted guest visitor log during promotion: ${visitor.visitorName}`
    );

    await logAudit(userPayload.id, "visitor", "promote", `Walk-in Guest promoted to Customer: ${visitor.visitorName}`);

    // Dispatch SSE notifications
    // Notify the assigned executive
    if (assignedUser) {
      await dispatchNotification({
        userId: assignedUser.id,
        title: "New Lead Assigned (Promoted)",
        message: `${customer.name} (previously a walk-in guest) has been promoted and assigned to you.`,
        type: "lead",
        link: `/customer-master/${customer.id}`,
      }).catch((e) => console.error("Notification failed", e));
    }

    // Notify all system managers/leads (Admin, SalesManager) scoped to tenant
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ["Admin", "SalesManager"] },
        isActive: true,
        companyId: userPayload.companyId,
      },
      select: { id: true },
    });

    if (managers.length > 0) {
      const managerIds = managers.map((m) => m.id);
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "Guest Promoted to Lead",
        message: `${customer.name} was promoted from guest by ${userPayload.email}. Assigned to ${assignedUser?.name || "System"}.`,
        type: "lead",
        link: `/customer-master/${customer.id}`,
      }).catch((e) => console.error("Notification failed", e));
    }

    return { success: true, message: "Visitor promoted to Customer successfully" };
  } catch (error: any) {
    console.error("Promote visitor error:", error);
    return { success: false, message: "Failed to promote visitor: " + error.message };
  }
}
