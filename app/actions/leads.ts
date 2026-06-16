"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, computeDiff, inferSeverity } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
type LeadSource = "Website" | "Referral" | "SocialMedia" | "Email" | "Event" | "ColdCall" | "Partner" | "Other";
import { buildScope, checkRecordScope } from "@/lib/scopes";

/**
 * Fetch all leads based on filters.
 */
export async function getLeadsAction(filters?: {
  search?: string;
  status?: LeadStatus;
  leadSource?: LeadSource;
  assignedUserId?: string;
  slaStatus?: string;
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

    const scope = buildScope(userPayload, "Lead");

    const whereClause: any = {
      ...scope,
      ...(filters?.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.leadSource ? { leadSource: filters.leadSource } : {}),
      ...(filters?.slaStatus ? { slaStatus: filters.slaStatus as any } : {}),
    };

    if (filters?.search?.trim()) {
      const searchTerms = filters.search.trim();
      whereClause.OR = [
        { name: { contains: searchTerms } },
        { email: { contains: searchTerms } },
        { phone: { contains: searchTerms } },
        { leadCode: { contains: searchTerms } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where: whereClause,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        followUps: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: leads };
  } catch (error) {
    console.error("Get Leads Error:", error);
    return { success: false, message: "Failed to fetch leads." };
  }
}

/**
 * Fetch a single lead by ID with its history.
 */
export async function getLeadByIdAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        marketingVisits: {
          include: { executive: { select: { name: true } } },
          orderBy: { createdAt: "desc" }
        },
        followUps: {
          include: { assignedUser: { select: { name: true } } },
          orderBy: { nextMeetingDate: "desc" }
        },
        callLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { timestamp: "desc" }
        },
        communicationLogs: {
          include: { sentByUser: { select: { name: true } } },
          orderBy: { sentAt: "desc" }
        },
        ownerHistory: {
          include: {
            fromUser:      { select: { id: true, name: true } },
            toUser:        { select: { id: true, name: true } },
            changedByUser: { select: { id: true, name: true } },
          },
          orderBy: { timestamp: "asc" }
        }
      }
    });

    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Soft delete check
    if (lead.deletedAt && !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Lead not found (deleted)." };
    }

    return { success: true, data: lead };
  } catch (error) {
    console.error("Get Lead By ID Error:", error);
    return { success: false, message: "Failed to fetch lead details." };
  }
}

/**
 * Create a new Lead with automatic duplicate detection.
 */
export async function createLeadAction(data: {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  leadSource?: LeadSource;
  notes?: string;
  assignedUserId?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { name, email, phone, city, leadSource, notes, assignedUserId } = data;

    if (!name) {
      return { success: false, message: "Name is required." };
    }

    // Duplicate check on email
    if (email?.trim()) {
      const existingEmail = await prisma.lead.findFirst({
        where: { email: email.trim(), companyId: userPayload.companyId, deletedAt: null }
      });
      if (existingEmail) {
        return { success: false, message: `Lead with email '${email}' already exists.` };
      }
    }

    // Duplicate check on phone
    if (phone?.trim()) {
      const existingPhone = await prisma.lead.findFirst({
        where: { phone: phone.trim(), companyId: userPayload.companyId, deletedAt: null }
      });
      if (existingPhone) {
        return { success: false, message: `Lead with phone number '${phone}' already exists.` };
      }
    }

    const leadCode = `LEAD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // SLA deadline = 15 minutes from now
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + 15 * 60 * 1000);

    const newLead = await prisma.lead.create({
      data: {
        leadCode,
        name,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        city: city || null,
        leadSource: leadSource || "Website",
        notes: notes || null,
        assignedUserId: assignedUserId || userPayload.id,
        status: "New",
        slaStatus: "Pending",
        slaResponseDeadline: slaDeadline,
        lastInteractionAt: now,
        escalationLevel: 0,
        companyId: userPayload.companyId,
      }
    });

    // Log initial ownership assignment
    await prisma.leadOwnerHistory.create({
      data: {
        leadId: newLead.id,
        fromUserId: null,
        toUserId: assignedUserId || userPayload.id,
        changedById: userPayload.id,
        reason: "Manual lead creation — initial assignment",
      }
    });

    await logAudit(userPayload.id, "LEADS", "CREATE_LEAD", `Created lead: ${name} (${leadCode}) — SLA: ${slaDeadline.toISOString()}`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead created successfully", data: newLead };
  } catch (error) {
    console.error("Create Lead Error:", error);
    return { success: false, message: "Failed to create lead." };
  }
}

/**
 * Update lead details.
 */
export async function updateLeadAction(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    status?: LeadStatus;
    leadSource?: LeadSource;
    notes?: string;
    assignedUserId?: string;
  }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Duplicate checks if email/phone changed
    if (data.email && data.email.trim() !== lead.email) {
      const duplicateEmail = await prisma.lead.findFirst({
        where: { email: data.email.trim(), companyId: userPayload.companyId, deletedAt: null }
      });
      if (duplicateEmail) {
        return { success: false, message: `Lead with email '${data.email}' already exists.` };
      }
    }

    if (data.phone && data.phone.trim() !== lead.phone) {
      const duplicatePhone = await prisma.lead.findFirst({
        where: { phone: data.phone.trim(), companyId: userPayload.companyId, deletedAt: null }
      });
      if (duplicatePhone) {
        return { success: false, message: `Lead with phone number '${data.phone}' already exists.` };
      }
    }

    // Detect ownership change
    const ownerChanged = data.assignedUserId && data.assignedUserId !== lead.assignedUserId;

    // Detect first response: status moves away from New
    const isFirstResponse = lead.status === "New" && data.status && data.status !== "New" && !lead.firstRespondedAt;

    const now = new Date();

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        email: data.email !== undefined ? data.email?.trim() || null : undefined,
        phone: data.phone !== undefined ? data.phone?.trim() || null : undefined,
        lastInteractionAt: now,
        // Mark SLA as Met on first response
        ...(isFirstResponse ? { slaStatus: "Met", firstRespondedAt: now } : {}),
        // Reset SLA deadline if owner changes (new owner gets 15 min)
        ...(ownerChanged ? { slaStatus: "Pending", slaResponseDeadline: new Date(now.getTime() + 15 * 60 * 1000) } : {}),
      }
    });

    // Automate contact creation if status changes to Qualified
    if (data.status === "Qualified" && lead.status !== "Qualified") {
      const existingCustomer = await prisma.customer.findFirst({
        where: { convertedFromLead: id, companyId: userPayload.companyId }
      });
      if (!existingCustomer) {
        let customerCode = "";
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
          const randomDigits = Math.floor(10000 + Math.random() * 90000);
          customerCode = `CUST-M${randomDigits}`;
          const existing = await prisma.customer.findFirst({
            where: { customerCode, companyId: userPayload.companyId },
          });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }
        if (!isUnique) {
          customerCode = `CUST-M${Date.now().toString().slice(-5)}`;
        }

        await prisma.customer.create({
          data: {
            customerCode,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            city: updated.city,
            status: "Prospect",
            assignedUserId: updated.assignedUserId,
            leadSource: updated.leadSource,
            convertedFromLead: id,
            companyId: userPayload.companyId,
          }
        });
      }
    }

    // Log ownership transfer
    if (ownerChanged) {
      await prisma.leadOwnerHistory.create({
        data: {
          leadId: id,
          fromUserId: lead.assignedUserId,
          toUserId: data.assignedUserId!,
          changedById: userPayload.id,
          reason: "Manual reassignment by CRM user",
        }
      });
    }

    // Compute field-level diff for state-diff audit
    const { before, after } = computeDiff(
      { name: lead.name, email: lead.email, phone: lead.phone, status: lead.status, assignedUserId: lead.assignedUserId, city: lead.city },
      { name: updated.name, email: updated.email, phone: updated.phone, status: updated.status, assignedUserId: updated.assignedUserId, city: updated.city }
    );

    const actionLabel = `Updated lead: ${updated.name} (${updated.leadCode})${
      isFirstResponse ? " — SLA Met (first response recorded)" : ""
    }${ownerChanged ? ` — Reassigned from ${lead.assignedUserId} to ${data.assignedUserId}` : ""}`;

    await logAudit(
      userPayload.id,
      "LEADS",
      "UPDATE_LEAD",
      actionLabel,
      {
        resourceId:    id,
        previousState: Object.keys(before).length ? before : null,
        newState:      Object.keys(after).length  ? after  : null,
        severity:      ownerChanged ? "WARN" : inferSeverity("update"),
      }
    );
    // ── Lifecycle Notifications ──────────────────────────────────────────────
    const statusChanged = data.status && data.status !== lead.status;

    if (statusChanged && data.status === "Qualified") {
      // Notify the assigned executive that their lead has been qualified
      if (updated.assignedUserId) {
        await dispatchNotification({
          userId: updated.assignedUserId,
          title: "Lead Qualified 🎉",
          message: `Lead "${updated.name}" (${updated.leadCode}) has been marked Qualified. A Contact profile has been created automatically.`,
          type: "lead",
          link: `/leads/${id}`,
        });
      }
      // Notify all Managers/Admins in the same tenant
      const managers = await prisma.user.findMany({
        where: {
          role: { in: ["Admin", "SalesManager"] },
          isActive: true,
          companyId: userPayload.companyId,
          id: { not: updated.assignedUserId ?? undefined },
        },
        select: { id: true },
      });
      if (managers.length > 0) {
        await dispatchNotificationsToMany({
          userIds: managers.map((m) => m.id),
          title: "Lead Qualified",
          message: `Lead "${updated.name}" (${updated.leadCode}) progressed to Qualified stage.`,
          type: "lead",
          link: `/leads/${id}`,
        });
      }
    }

    if (statusChanged && data.status === "Lost") {
      // Notify the assigned executive about the lost lead
      if (updated.assignedUserId) {
        await dispatchNotification({
          userId: updated.assignedUserId,
          title: "Lead Marked Lost",
          message: `Lead "${updated.name}" (${updated.leadCode}) has been marked as Lost.`,
          type: "lead",
          link: `/leads/${id}`,
        });
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);

    return { success: true, message: "Lead updated successfully", data: updated };
  } catch (error) {
    console.error("Update Lead Error:", error);
    return { success: false, message: "Failed to update lead." };
  }
}

/**
 * Delete a Lead (Soft-delete for Admins/Managers, Hard-delete for SuperAdmins).
 */
export async function deleteLeadAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    // Access check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SuperAdmin") {
      // Permanent Hard Delete
      await prisma.lead.delete({
        where: { id }
      });
      await logAudit(userPayload.id, "LEADS", "PERMANENT_DELETE_LEAD", `Permanently deleted lead: ${lead.name} (${lead.leadCode})`);
    } else {
      // Soft Delete
      await prisma.lead.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: userPayload.id
        }
      });
      await logAudit(userPayload.id, "LEADS", "DELETE_LEAD", `Soft-deleted lead: ${lead.name} (${lead.leadCode})`);
    }

    revalidatePath("/leads");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead deleted successfully" };
  } catch (error) {
    console.error("Delete Lead Error:", error);
    return { success: false, message: "Failed to delete lead." };
  }
}

/**
 * Restore a soft-deleted Lead.
 */
export async function restoreLeadAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    // Tenant check
    if (lead.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    await prisma.lead.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null
      }
    });

    await logAudit(userPayload.id, "LEADS", "RESTORE_LEAD", `Restored lead: ${lead.name} (${lead.leadCode})`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead restored successfully" };
  } catch (error) {
    console.error("Restore Lead Error:", error);
    return { success: false, message: "Failed to restore lead." };
  }
}

/**
 * Convert a Qualified Lead into a Customer.
 */
export async function convertLeadToCustomerAction(leadId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    if (lead.status === "Converted") {
      return { success: false, message: "Lead is already converted." };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Duplicate customer check scoped to tenant
    if (lead.email) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { email: lead.email, companyId: userPayload.companyId, deletedAt: null }
      });
      if (existingCustomer) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "Converted" }
        });
        return { success: true, message: "Lead matched to existing customer and marked Converted.", data: existingCustomer };
      }
    }

    const customer = await prisma.$transaction(async (tx) => {
      // 1. Update Lead status
      await tx.lead.update({
        where: { id: leadId },
        data: { status: "Converted" }
      });

      // 2. Create Customer
      const customerCode = `CUST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const newCustomer = await tx.customer.create({
        data: {
          customerCode,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          status: "Prospect",
          assignedUserId: lead.assignedUserId,
          convertedFromLead: lead.id,
          leadSource: lead.leadSource,
          companyId: userPayload.companyId,
        }
      });

      // 3. Re-link existing records to the new Customer
      await tx.marketingVisit.updateMany({
        where: { leadId },
        data: { customerId: newCustomer.id }
      });

      await tx.followUp.updateMany({
        where: { leadId },
        data: { customerId: newCustomer.id }
      });

      await tx.callLog.updateMany({
        where: { leadId },
        data: { customerId: newCustomer.id }
      });

      await tx.communicationLog.updateMany({
        where: { leadId },
        data: { customerId: newCustomer.id }
      });

      return newCustomer;
    });

    await logAudit(userPayload.id, "LEADS", "CONVERT_LEAD", `Converted lead ${lead.name} to customer ${customer.customerCode}`);
    revalidatePath("/leads");
    revalidatePath("/customers");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead converted to Customer successfully.", data: customer };
  } catch (error) {
    console.error("Convert Lead Error:", error);
    return { success: false, message: "Failed to convert lead." };
  }
}

/**
 * Convert a Qualified Lead into a Customer and create a Deal in one atomic transaction.
 */
export async function convertLeadToDealAction(
  leadId: string,
  dealName: string,
  dealValue: number,
  expectedCloseDate: string
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, message: "Lead not found" };
    if (lead.status === "Converted") return { success: false, message: "Lead is already converted" };

    // Access scope check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Execute promotion and creation atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Promote to Customer (if not already existing)
      let customer = await tx.customer.findFirst({
        where: { convertedFromLead: leadId, companyId: userPayload.companyId }
      });

      if (!customer) {
        const customerCode = `CUST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        customer = await tx.customer.create({
          data: {
            customerCode,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            city: lead.city,
            status: "Prospect",
            assignedUserId: lead.assignedUserId,
            convertedFromLead: lead.id,
            leadSource: lead.leadSource,
            companyId: userPayload.companyId,
          }
        });

        // Re-link records
        await tx.marketingVisit.updateMany({
          where: { leadId },
          data: { customerId: customer.id }
        });
        await tx.followUp.updateMany({
          where: { leadId },
          data: { customerId: customer.id }
        });
        await tx.callLog.updateMany({
          where: { leadId },
          data: { customerId: customer.id }
        });
        await tx.communicationLog.updateMany({
          where: { leadId },
          data: { customerId: customer.id }
        });
      }

      // 2. Mark Lead as Converted
      await tx.lead.update({
        where: { id: leadId },
        data: { status: "Converted" }
      });

      // 3. Create the Deal
      const deal = await tx.deal.create({
        data: {
          dealName,
          customerId: customer.id,
          dealValue: parseFloat(dealValue as any),
          expectedCloseDate: new Date(expectedCloseDate),
          assignedUserId: lead.assignedUserId || userPayload.id,
          status: "Active",
          companyId: userPayload.companyId,
        }
      });

      // 4. Create Deal Stage History
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: null,
          toStatus: "Active",
          changedById: userPayload.id
        }
      });

      return { customer, deal };
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Create",
      `Created converted deal "${dealName}" for customer ${result.customer.name} (Value: ₹${dealValue})`
    );

    revalidatePath("/leads");
    revalidatePath("/deals");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead successfully converted to Customer and Deal created.", dealId: result.deal.id };
  } catch (error) {
    console.error("Convert lead to deal error:", error);
    return { success: false, message: "Failed to convert lead to deal" };
  }
}
