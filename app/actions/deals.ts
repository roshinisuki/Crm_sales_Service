"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, computeDiff } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { buildScope, checkRecordScope } from "@/lib/scopes";
import { transitionDealStatus } from "@/lib/dealService";

export async function getDealsAction(params?: { search?: string; status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    if (userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { search = "", status = "" } = params || {};

    const scope = buildScope(userPayload, "Deal");

    const deals = await prisma.deal.findMany({
      where: {
        ...scope,
        AND: [
          status ? { status: status as any } : {},
          search
            ? {
                OR: [
                  { dealName: { contains: search } },
                  { customer: { name: { contains: search } } },
                  { customer: { customerCode: { contains: search } } }
                ]
              }
            : {}
        ]
      },
      include: {
        customer: true,
        assignedUser: { select: { id: true, name: true, email: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const serialized = deals.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      expectedCloseDate: d.expectedCloseDate.toISOString(),
      customer: d.customer ? {
        ...d.customer,
        createdAt: d.customer.createdAt.toISOString(),
        updatedAt: d.customer.updatedAt.toISOString()
      } : null
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET Deals Error:", error);
    return { success: false, message: "Failed to fetch deals" };
  }
}

export async function getDealByIdAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    if (userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        stageHistories: {
          include: { changedBy: { select: { name: true } } },
          orderBy: { changedAt: "desc" }
        },
        proposals: {
          orderBy: { createdAt: "desc" }
        },
        opportunityDetail: true
      }
    });

    if (!deal) {
      return { success: false, message: "Deal not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Soft delete check
    if (deal.deletedAt && !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Deal not found (deleted)." };
    }

    const serialized = {
      ...deal,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
      expectedCloseDate: deal.expectedCloseDate.toISOString(),
      customer: deal.customer ? {
        ...deal.customer,
        createdAt: deal.customer.createdAt.toISOString(),
        updatedAt: deal.customer.updatedAt.toISOString()
      } : null,
      stageHistories: (deal as any).stageHistories?.map((h: any) => ({
        ...h,
        changedAt: h.changedAt.toISOString()
      })) || [],
      proposals: (deal as any).proposals?.map((p: any) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        validUntil: p.validUntil.toISOString()
      })) || [],
      opportunityDetail: deal.opportunityDetail ? {
        ...deal.opportunityDetail,
        expectedGoLive: deal.opportunityDetail.expectedGoLive?.toISOString() || null,
        meetingDate: deal.opportunityDetail.meetingDate?.toISOString() || null,
        demoDate: deal.opportunityDetail.demoDate?.toISOString() || null,
        createdAt: deal.opportunityDetail.createdAt?.toISOString() || null,
        updatedAt: deal.opportunityDetail.updatedAt?.toISOString() || null
      } : null
    };

    return { success: true, data: serialized };
  } catch (error) {
    console.error("GET Deal Error:", error);
    return { success: false, message: "Failed to fetch deal details" };
  }
}

export async function createDealAction(data: {
  dealName: string;
  customerId: string;
  dealValue: number;
  expectedCloseDate: string;
  assignedUserId?: string;
  notes?: string;
  status?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { dealName, customerId, dealValue, expectedCloseDate, assignedUserId, notes, status = "Open" } = data;

    if (!dealName || !customerId || !expectedCloseDate || dealValue === undefined) {
      return { success: false, message: "Required fields are missing" };
    }

    // Check Customer access
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const finalAssignedUserId = userPayload.role === "SalesExecutive"
      ? userPayload.id
      : assignedUserId || null;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Deal
      const deal = await tx.deal.create({
        data: {
          dealName,
          customerId,
          dealValue: parseFloat(dealValue as any),
          expectedCloseDate: new Date(expectedCloseDate),
          assignedUserId: finalAssignedUserId,
          notes: notes || null,
          status: status as any,
          companyId: userPayload.companyId,
        }
      });

      // Log to Stage History
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: null,
          toStatus: status,
          changedById: userPayload.id
        }
      });

      // 2. Automations: Deal Won -> Customer becomes ActiveCustomer
      if (status === "Won") {
        await tx.customer.update({
          where: { id: customerId },
          data: { status: "ActiveCustomer" }
        });
      }

      return deal;
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Create",
      `Created deal "${dealName}" for customer ID ${customerId} (Value: ${dealValue}, Status: ${status})`
    );

    // Notify assigned executive if creator is different
    if (finalAssignedUserId && finalAssignedUserId !== userPayload.id) {
      await dispatchNotification({
        userId: finalAssignedUserId,
        title: "New Deal Assigned",
        message: `You have been assigned a new deal: "${dealName}".`,
        type: "deal",
        link: `/customer-master/${customerId}`
      });
    }

    // Notify Managers/Leads (scoped to tenant company)
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
      select: { id: true }
    });
    const managerIds = managers.map(m => m.id).filter(id => id !== userPayload.id);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "New Deal Created",
        message: `${userPayload.email} created a new deal "${dealName}" for customer ID ${customerId}.`,
        type: "deal",
        link: `/customer-master/${customerId}`
      });
    }

    return {
      success: true,
      data: {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        expectedCloseDate: result.expectedCloseDate.toISOString()
      },
      message: "Deal created successfully"
    };
  } catch (error) {
    console.error("POST Deal Error:", error);
    return { success: false, message: "Failed to create deal" };
  }
}

export async function updateDealAction(data: {
  id: string;
  dealName: string;
  customerId: string;
  dealValue: number;
  expectedCloseDate: string;
  assignedUserId?: string;
  notes?: string;
  status: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, dealName, customerId, dealValue, expectedCloseDate, assignedUserId, notes, status } = data;

    if (!id || !dealName || !customerId || !expectedCloseDate || dealValue === undefined || !status) {
      return { success: false, message: "Required fields are missing" };
    }

    const currentDeal = await prisma.deal.findUnique({ where: { id } });
    if (!currentDeal) {
      return { success: false, message: "Deal not found" };
    }

    // Access scope check for Deal
    if (!checkRecordScope(userPayload, currentDeal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (currentDeal.isLocked && !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "This deal is locked. Changes are not allowed during pending approval or after closed." };
    }

    // Verify target Customer access
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const finalAssignedUserId = userPayload.role === "SalesExecutive"
      ? userPayload.id
      : assignedUserId || null;

    const result = await prisma.$transaction(async (tx) => {
      // Get existing deal to check if status changed
      const existingDeal = await tx.deal.findUnique({
        where: { id },
        select: { status: true }
      });

      // 1. Update the Deal
      const deal = await tx.deal.update({
        where: { id },
        data: {
          dealName,
          customerId,
          dealValue: parseFloat(dealValue as any),
          expectedCloseDate: new Date(expectedCloseDate),
          assignedUserId: finalAssignedUserId,
          notes: notes || null,
          status: status as any
        }
      });

      // Log transition if changed
      if (existingDeal && existingDeal.status !== status) {
        await tx.dealStageHistory.create({
          data: {
            dealId: deal.id,
            fromStatus: existingDeal.status,
            toStatus: status,
            changedById: userPayload.id
          }
        });
      }

      // 2. Automations: Deal Won -> Customer becomes ActiveCustomer
      if (status === "Won") {
        await tx.customer.update({
          where: { id: customerId },
          data: { status: "ActiveCustomer" }
        });
      }

      return deal;
    });

    // Determine severity: Won/Lost = HIGH, other status changes = WARN, no status change = INFO
    const isTerminalState = status === "Won" || status === "Lost";
    const dealSeverity = isTerminalState ? "HIGH" : "WARN";

    await logAudit(
      userPayload.id,
      "Deal",
      "Update",
      `Updated deal "${dealName}" (Value: ₹${dealValue}, Status: ${status})`,
      {
        resourceId:    id,
        previousState: { status: result.status !== status ? status : undefined, dealName, dealValue },
        newState:      { status, dealName, dealValue },
        severity:      dealSeverity,
      }
    );

    // Notify assigned user if different
    if (finalAssignedUserId && finalAssignedUserId !== userPayload.id) {
      await dispatchNotification({
        userId: finalAssignedUserId,
        title: "Deal Assigned/Updated",
        message: `Your assigned deal "${dealName}" has been updated.`,
        type: "deal",
        link: `/customer-master/${customerId}`
      });
    }

    // Notify Managers/Leads (scoped to tenant company)
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
      select: { id: true }
    });
    const managerIds = managers.map(m => m.id).filter(id => id !== userPayload.id);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "Deal Updated",
        message: `${userPayload.email} updated the deal: "${dealName}".`,
        type: "deal",
        link: `/customer-master/${customerId}`
      });
    }

    return {
      success: true,
      data: {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        expectedCloseDate: result.expectedCloseDate.toISOString()
      },
      message: "Deal updated successfully"
    };
  } catch (error) {
    console.error("PUT Deal Error:", error);
    return { success: false, message: "Failed to update deal" };
  }
}

export async function updateDealStatusAction(id: string, status: string, lostReason?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const currentDeal = await prisma.deal.findUnique({ where: { id } });
    if (!currentDeal) {
      return { success: false, message: "Deal not found" };
    }

    // Access scope check for Deal
    if (!checkRecordScope(userPayload, currentDeal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get existing status and opportunity detail
      const existingDeal = await tx.deal.findUnique({
        where: { id },
        select: { status: true, opportunityDetail: true }
      });

      if (!existingDeal) throw new Error("Deal not found in transaction");

      // Stage-gate Validation
      const details = existingDeal.opportunityDetail;
      if (status === "PreSalesReview") {
        if (!details || !details.budgetRange || !details.timeline || !details.decisionMaker || !details.modulesRequired) {
          throw new Error("Validation Failed: Must complete required fields (Budget, Timeline, Decision Maker, Modules) in Requirement Gathering first.");
        }
      } else if (status === "MeetingScheduled") {
        if (!details || !details.meetingDate || !details.meetingMode || !details.meetingParticipants || !details.meetingAgenda) {
          throw new Error("Validation Failed: Must complete Meeting Details (Date, Mode, Participants, Agenda).");
        }
      } else if (status === "DemoConducted") {
        if (!details || details.meetingStatus !== "Completed" || !details.meetingOutcome) {
          throw new Error("Validation Failed: Must complete Meeting Status and Outcome Notes first.");
        }
      } else if (status === "ProposalSent") {
        // Can only move to Proposal Sent if demo is accepted/interested
        if (existingDeal.status === "DemoConducted" && (!details || !details.demoCustomerRating || !details.demoInterestLevel)) {
          throw new Error("Validation Failed: Must submit Demo Feedback first.");
        }
      } else if (status === "RejectedDemo") {
        if (!details || !details.demoRejectionReason) {
          throw new Error("Validation Failed: Must provide a rejection reason.");
        }
      }

      // 1. Update status
      const dataUpdate: any = { status: status as any };
      if (status === "Lost" && lostReason) {
        dataUpdate.lostReason = lostReason;
      }

      let targetStatus = status;
      if (status === "Won") {
        targetStatus = "SalesOpportunity";
        dataUpdate.status = "SalesOpportunity";
      }

      const deal = await tx.deal.update({
        where: { id },
        data: dataUpdate
      });

      // Log transition
      if (existingDeal && existingDeal.status !== targetStatus) {
        await tx.dealStageHistory.create({
          data: {
            dealId: deal.id,
            fromStatus: existingDeal.status,
            toStatus: targetStatus as any,
            changedById: userPayload.id
          }
        });
      }

      // 2. Sync Customer status if Won
      if (status === "Won" || targetStatus === "SalesOpportunity") {
        await tx.customer.update({
          where: { id: deal.customerId },
          data: { status: "ActiveCustomer" }
        });
      }

      return deal;
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Update",
      `Changed deal status of "${result.dealName}" to ${status}${status === "Lost" && lostReason ? ` (Reason: ${lostReason})` : ""}`
    );

    // Notify owner (if updated by someone else)
    if (result.assignedUserId && result.assignedUserId !== userPayload.id) {
      await dispatchNotification({
        userId: result.assignedUserId,
        title: "Deal Status Changed",
        message: `The status of your deal "${result.dealName}" has been changed to "${status}".`,
        type: "deal",
        link: `/customer-master/${result.customerId}`
      });
    }

    // Notify managers (scoped to tenant company)
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
      select: { id: true }
    });
    const managerIds = managers.map(m => m.id).filter(id => id !== userPayload.id);
    if (managerIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managerIds,
        title: "Deal Stage Promoted",
        message: `Deal "${result.dealName}" has been changed to stage "${status}".`,
        type: "deal",
        link: `/customer-master/${result.customerId}`
      });
    }

    return { success: true, message: "Deal status updated successfully" };
  } catch (error: any) {
    console.error("PATCH Deal Status Error:", error);
    return { success: false, message: error.message || "Failed to update deal status" };
  }
}

export async function deleteDealAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) {
      return { success: false, message: "Deal not found" };
    }

    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SuperAdmin") {
      // Permanent Hard Delete for SuperAdmin
      await prisma.deal.delete({
        where: { id }
      });
      await logAudit(userPayload.id, "Deal", "Delete_Permanent", `Permanently deleted deal "${deal.dealName}"`);
    } else {
      // Soft Delete for Admin / SalesManager
      await prisma.deal.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: userPayload.id
        }
      });
      await logAudit(userPayload.id, "Deal", "Delete", `Soft-deleted deal "${deal.dealName}"`);
    }

    return { success: true, message: "Deal deleted successfully" };
  } catch (error) {
    console.error("DELETE Deal Error:", error);
    return { success: false, message: "Failed to delete deal" };
  }
}

export async function restoreDealAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) {
      return { success: false, message: "Deal not found" };
    }

    if (userPayload.role !== "SuperAdmin" && deal.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    await prisma.deal.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null
      }
    });

    await logAudit(userPayload.id, "Deal", "Restore", `Restored deal "${deal.dealName}"`);
    return { success: true, message: "Deal restored successfully" };
  } catch (error) {
    console.error("Restore Deal Error:", error);
    return { success: false, message: "Failed to restore deal" };
  }
}

export async function requestDiscountAction(data: {
  dealId: string;
  discountPercent: number;
  notes?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { dealId, discountPercent, notes } = data;
    if (!dealId || discountPercent === undefined || discountPercent < 0 || discountPercent > 100) {
      return { success: false, message: "Invalid discount request" };
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) return { success: false, message: "Deal not found" };

    // Access scope check for Deal
    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (deal.isLocked) {
      return { success: false, message: "Cannot request discount on a locked deal" };
    }

    // Rule: Discounts > 15% require approval.
    const requiresApproval = discountPercent > 15;

    if (requiresApproval) {
      // Capture the current deal status BEFORE locking (for exact rollback on rejection)
      const dealStatusBeforeLock = deal.status as string;

      // Lock deal and set discount status to Pending
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          discountPercent,
          discountStatus: "Pending",
          isLocked: true,
          discountNotes: notes || null,
        },
      });

      // Transition deal status → ApprovalQueue (records stage history automatically)
      await transitionDealStatus(dealId, "ApprovalQueue", {
        actorId: userPayload.id,
        reason: `Discount of ${discountPercent}% requested — pending manager approval`,
      });

      // Create entry in ApprovalHistory, store previous status for rollback
      await prisma.approvalHistory.create({
        data: {
          dealId,
          requestedById: userPayload.id,
          discountPercent,
          status: "Pending",
          remarks: notes || null,
          previousStatus: dealStatusBeforeLock,
        },
      });

      await logAudit(
        userPayload.id,
        "Deal",
        "Update",
        `Requested high discount (${discountPercent}%) on deal "${deal.dealName}". Deal is locked pending Admin approval.`,
        { resourceId: dealId, severity: "WARN" }
      );

      // Notify Managers
      const requester = await prisma.user.findUnique({
        where: { id: userPayload.id },
        select: { name: true }
      });
      const requesterName = requester?.name || userPayload.email;

      const managers = await prisma.user.findMany({
        where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
        select: { id: true }
      });
      const managerIds = managers.map(m => m.id).filter(id => id !== userPayload.id);
      if (managerIds.length > 0) {
        await dispatchNotificationsToMany({
          userIds: managerIds,
          title: "Discount Approval Required",
          message: `${requesterName} requested a ${discountPercent}% discount on deal "${deal.dealName}".`,
          type: "deal",
          link: `/deals/${dealId}`
        });
      }

      revalidatePath(`/deals/${dealId}`);
      revalidatePath("/deals");

      return { success: true, message: "Discount request submitted. Awaiting manager approval." };
    } else {
      // Auto-approved: update deal value directly
      const originalValue = deal.dealValue;
      const discountedValue = originalValue * (1 - discountPercent / 100);

      await prisma.deal.update({
        where: { id: dealId },
        data: {
          discountPercent,
          discountStatus: "Approved",
          dealValue: discountedValue,
          discountNotes: notes || null
        }
      });

      // Create entry in ApprovalHistory
      await prisma.approvalHistory.create({
        data: {
          dealId,
          requestedById: userPayload.id,
          resolvedById: userPayload.id,
          discountPercent,
          status: "Approved",
          remarks: notes || "Auto-approved",
          resolvedAt: new Date()
        }
      });

      await logAudit(
        userPayload.id,
        "Deal",
        "Update",
        `Applied auto-approved discount of ${discountPercent}% on deal "${deal.dealName}" (Value reduced from ₹${originalValue} to ₹${discountedValue})`
      );

      revalidatePath(`/deals/${dealId}`);
      revalidatePath("/deals");

      return { success: true, message: `Discount of ${discountPercent}% approved and applied.` };
    }
  } catch (error) {
    console.error("Discount request error:", error);
    return { success: false, message: "Failed to request discount" };
  }
}

export async function resolveDiscountAction(data: {
  dealId: string;
  approved: boolean;
  notes?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Only Admins and Leads can resolve discounts" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { dealId, approved, notes } = data;
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) return { success: false, message: "Deal not found" };

    // Access scope check for Deal
    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (deal.discountStatus !== "Pending") {
      return { success: false, message: "No pending discount request on this deal" };
    }

    if (approved) {
      // Apply discount
      const originalValue = deal.dealValue;
      const discountedValue = originalValue * (1 - deal.discountPercent / 100);

      await prisma.deal.update({
        where: { id: dealId },
        data: {
          discountStatus: "Approved",
          dealValue: discountedValue,
          isLocked: false,
          discountApprovedById: userPayload.id,
          discountNotes: notes || deal.discountNotes,
        },
      });

      // Advance deal to ActiveNegotiation after approval (discount applied, negotiation continues)
      await transitionDealStatus(dealId, "ActiveNegotiation", {
        actorId: userPayload.id,
        reason: `Discount of ${deal.discountPercent}% approved — advancing to active negotiation`,
      });

      // Find pending ApprovalHistory and update
      const pendingApproval = await prisma.approvalHistory.findFirst({
        where: { dealId, status: "Pending" },
        orderBy: { createdAt: "desc" },
      });
      if (pendingApproval) {
        await prisma.approvalHistory.update({
          where: { id: pendingApproval.id },
          data: {
            status: "Approved",
            resolvedById: userPayload.id,
            remarks: notes || deal.discountNotes || "Approved",
            resolvedAt: new Date(),
          },
        });
      } else {
        await prisma.approvalHistory.create({
          data: {
            dealId,
            requestedById: deal.assignedUserId || userPayload.id,
            resolvedById: userPayload.id,
            discountPercent: deal.discountPercent,
            status: "Approved",
            remarks: notes || "Approved",
            resolvedAt: new Date(),
          },
        });
      }

      await logAudit(
        userPayload.id,
        "Deal",
        "Update",
        `Approved discount of ${deal.discountPercent}% on deal "${deal.dealName}" (Value reduced from ₹${originalValue} to ₹${discountedValue})`,
        { resourceId: dealId, severity: "HIGH" }
      );

      // Notify Owner
      if (deal.assignedUserId) {
        await dispatchNotification({
          userId: deal.assignedUserId,
          title: "Discount Approved",
          message: `Your requested discount of ${deal.discountPercent}% on deal "${deal.dealName}" has been APPROVED.`,
          type: "deal",
          link: `/deals/${dealId}`
        });
      }
    } else {
      // Reject discount — unlock deal and restore EXACT previous status
      const pendingApprovalForReject = await prisma.approvalHistory.findFirst({
        where: { dealId, status: "Pending" },
        orderBy: { createdAt: "desc" },
        select: { id: true, previousStatus: true },
      });

      const restoredStatus = (pendingApprovalForReject?.previousStatus as any) ?? "ActiveNegotiation";

      await prisma.deal.update({
        where: { id: dealId },
        data: {
          discountStatus: "Rejected",
          isLocked: false,
          discountNotes: notes || deal.discountNotes,
        },
      });

      // Restore to the exact pre-lock status
      await transitionDealStatus(dealId, restoredStatus, {
        actorId: userPayload.id,
        reason: `Discount request rejected — deal restored to previous stage (${restoredStatus})`,
      });

      if (pendingApprovalForReject) {
        await prisma.approvalHistory.update({
          where: { id: pendingApprovalForReject.id },
          data: {
            status: "Rejected",
            resolvedById: userPayload.id,
            remarks: notes || deal.discountNotes || "Rejected",
            resolvedAt: new Date(),
          },
        });
      } else {
        await prisma.approvalHistory.create({
          data: {
            dealId,
            requestedById: deal.assignedUserId || userPayload.id,
            resolvedById: userPayload.id,
            discountPercent: deal.discountPercent,
            status: "Rejected",
            remarks: notes || "Rejected",
            resolvedAt: new Date(),
          },
        });
      }

      await logAudit(
        userPayload.id,
        "Deal",
        "Update",
        `Rejected discount request on deal "${deal.dealName}"`,
        { resourceId: dealId, severity: "WARN" }
      );

      // Notify Owner
      if (deal.assignedUserId) {
        await dispatchNotification({
          userId: deal.assignedUserId,
          title: "Discount Rejected",
          message: `Your requested discount of ${deal.discountPercent}% on deal "${deal.dealName}" has been REJECTED.`,
          type: "deal",
          link: `/deals/${dealId}`
        });
      }
    }

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/deals");

    return { success: true, message: `Discount request ${approved ? "approved" : "rejected"} successfully.` };
  } catch (error) {
    console.error("Resolve discount error:", error);
    return { success: false, message: "Failed to resolve discount request" };
  }
}



export async function saveOpportunityDetailAction(dealId: string, payload: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") return { success: false, message: "Unauthorized" };

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) return { success: false, message: "Deal not found" };

    if (!checkRecordScope(userPayload, deal, "Deal")) {
      return { success: false, message: "Unauthorized access to deal." };
    }

    const updated = await prisma.opportunityDetail.upsert({
      where: { dealId },
      update: payload,
      create: { dealId, ...payload }
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Update",
      `Updated Opportunity Details for deal "${deal.dealName}"`
    );

    revalidatePath("/sales-pipeline");
    revalidatePath(`/sales-pipeline/${dealId}`);

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Save Opportunity Detail Error:", error);
    return { success: false, message: error.message || "Failed to save details" };
  }
}
