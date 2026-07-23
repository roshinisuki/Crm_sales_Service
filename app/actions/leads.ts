"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, computeDiff, inferSeverity } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
type LeadStatus = "New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost" | "Overdue" | "Duplicate";
type LeadSource = "Website" | "Referral" | "SocialMedia" | "Email" | "Event" | "ColdCall" | "Partner" | "Other" | "Trade Show" | "Tender Portal";
import { buildScope, checkRecordScope } from "@/lib/scopes";
import { nanoid } from "nanoid";

// ── V2: Lead Score Algorithm (0–100, server-computed) ──────────────────────────
function calculateLeadScore(params: {
  industryType?: string | null;
  leadSource?: string | null;
  designation?: string | null;
  estimatedValue?: number | null;
  email?: string | null;
  phone?: string | null;
}): number {
  let score = 0;

  // industry_fit: Automotive/Pharma/Textile = 25, Others = 10
  const industry = (params.industryType || "").toLowerCase();
  if (["automotive", "pharma", "textile"].includes(industry)) score += 25;
  else score += 10;

  // source_quality: Referral=20, Trade Show=18, Website=15, Cold Call=10, Other=5
  const source = (params.leadSource || "").toLowerCase().replace(/\s/g, "");
  if (source === "referral") score += 20;
  else if (source === "tradeshow") score += 18;
  else if (source === "website") score += 15;
  else if (source === "coldcall") score += 10;
  else score += 5;

  // designation: Head/Director/VP/GM/CEO/MD/President = 20, Manager = 15, Engineer/Exec = 10
  const desig = (params.designation || "").toLowerCase();
  if (/(head|director|vp|gm|ceo|md|president)/.test(desig)) score += 20;
  else if (/manager/.test(desig)) score += 15;
  else score += 10;

  // value_bucket: >10L=20, 1L–10L=15, <1L=10, null=0
  const val = params.estimatedValue;
  if (val != null && val > 0) {
    if (val > 1000000) score += 20;
    else if (val >= 100000) score += 15;
    else score += 10;
  }

  // contact_data: email AND phone = 15, either = 7, neither = 0
  if (params.email && params.phone) score += 15;
  else if (params.email || params.phone) score += 7;

  return Math.min(score, 100);
}

// ── V2: Generate LD-YYYY-NNNNN code ────────────────────────────────────────────
async function generateLeadCode(companyId?: string | null): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LD-${year}-`;

  // leadCode is globally unique (see Lead.leadCode @unique in schema.prisma),
  // so the sequence lookup must NOT be scoped to companyId — otherwise two
  // companies can independently compute the same next sequence number and
  // collide on the global unique constraint.
  const lastLead = await prisma.lead.findFirst({
    where: {
      leadCode: { startsWith: prefix },
    },
    orderBy: { leadCode: "desc" },
    select: { leadCode: true },
  });

  let nextSeq = 1;
  if (lastLead?.leadCode) {
    const lastSeqStr = lastLead.leadCode.slice(prefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  const seq = String(nextSeq).padStart(5, "0");
  return `${prefix}${seq}`;
}

// ── V2: Insert LeadStatusHistory ───────────────────────────────────────────────
async function insertStatusHistory(
  leadId: string,
  fromStatus: string | null,
  toStatus: string,
  changedById: string,
  notes?: string
) {
  await prisma.leadStatusHistory.create({
    data: { leadId, fromStatus, toStatus, changedById, notes },
  });
}

// ── V2: Non-blocking duplicate detection ──────────────────────────────────────
async function detectDuplicates(
  leadId: string,
  phone?: string | null,
  companyName?: string | null,
  companyId?: string | null
) {
  if (!phone && !companyName) return;

  const where: any = {
    id: { not: leadId },
    deletedAt: null,
    ...(companyId ? { companyId } : {}),
  };

  if (phone) {
    where.OR = [{ phone: phone.trim() }];
  }

  const duplicate = await prisma.lead.findFirst({ where });

  if (duplicate) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { isDuplicateOf: duplicate.id, status: "Duplicate" },
    });
    await insertStatusHistory(leadId, null, "Duplicate", "SYSTEM", "Auto-detected duplicate");
    // Notify assigned user (non-blocking)
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedUserId: true } });
    if (lead?.assignedUserId) {
      await dispatchNotification({
        userId: lead.assignedUserId,
        title: "Potential Duplicate Detected",
        message: `Lead may be a duplicate of an existing record.`,
        type: "lead",
        link: `/leads/${leadId}`,
      }).catch(() => {});
    }
  }
}

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

    // BRD V1: coerce any legacy forbidden statuses to Qualified on read
    const FORBIDDEN_LEAD_STATUSES = ["ProposalSent", "Negotiation", "ActiveNegotiation"];
    const sanitized = leads.map(l =>
      FORBIDDEN_LEAD_STATUSES.includes(l.status)
        ? { ...l, status: "Qualified" }
        : l
    );

    return { success: true, data: sanitized };
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

    // BRD V1: coerce legacy forbidden statuses on read
    const FORBIDDEN_LEAD_STATUSES = ["ProposalSent", "Negotiation", "ActiveNegotiation"];
    const sanitized = FORBIDDEN_LEAD_STATUSES.includes(lead.status)
      ? { ...lead, status: "Qualified" }
      : lead;

    return { success: true, data: sanitized };
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
  // V2 fields
  companyName: string;
  designation?: string;
  industryType?: string;
  estimatedValue?: number;
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

    if (!name?.trim()) {
      return { success: false, message: "Name is required." };
    }
    if (!phone?.trim()) {
      return { success: false, message: "Phone number is required." };
    }
    if (!email?.trim()) {
      return { success: false, message: "Email address is required." };
    }
    if (!city?.trim()) {
      return { success: false, message: "Place / City is required." };
    }
    if (!data.companyName?.trim()) {
      return { success: false, message: "Company name is required." };
    }

    // V2 validation: estimated_value must be positive if provided
    if (data.estimatedValue != null && data.estimatedValue < 0) {
      return { success: false, message: "Estimated value must be positive." };
    }

    // Duplicate check on email (block creation — existing V1 behavior)
    if (email?.trim()) {
      const existingEmail = await prisma.lead.findFirst({
        where: { email: email.trim(), companyId: userPayload.companyId, deletedAt: null }
      });
      if (existingEmail) {
        return { success: false, message: `Lead with email '${email}' already exists.` };
      }
    }

    // V2: Generate LD-YYYY-NNNNN code
    const leadCode = await generateLeadCode(userPayload.companyId);

    // V2: Calculate lead score
    const leadScore = calculateLeadScore({
      industryType: data.industryType,
      leadSource: leadSource,
      designation: data.designation,
      estimatedValue: data.estimatedValue,
      email: email,
      phone: phone,
    });

    // Auto-assign owner based on territory matching the lead's city
    let resolvedOwnerId = assignedUserId || userPayload.id;
    if (city?.trim()) {
      const matchingTerritory = await prisma.territory.findFirst({
        where: {
          companyId: userPayload.companyId,
          isActive: true,
          OR: [
            { name: { contains: city.trim() } },
            { states: { contains: city.trim() } }
          ]
        }
      });
      if (matchingTerritory && matchingTerritory.assignedUserId) {
        resolvedOwnerId = matchingTerritory.assignedUserId;
      }
    }

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
        assignedUserId: resolvedOwnerId,
        status: "New",
        slaStatus: "Pending",
        slaResponseDeadline: slaDeadline,
        lastInteractionAt: now,
        escalationLevel: 0,
        companyId: userPayload.companyId,
        // V2 fields
        companyName: data.companyName?.trim() || null,
        designation: data.designation?.trim() || null,
        industryType: data.industryType || null,
        estimatedValue: data.estimatedValue || null,
        leadScore,
      }
    });

    // V2: Insert initial LeadStatusHistory (from=NULL → 'New')
    await insertStatusHistory(newLead.id, null, "New", userPayload.id, "Lead created");

    // Log initial ownership assignment
    await prisma.leadOwnerHistory.create({
      data: {
        leadId: newLead.id,
        fromUserId: null,
        toUserId: resolvedOwnerId,
        changedById: userPayload.id,
        reason: "Manual lead creation — initial assignment (with territory-based routing)",
      }
    });

    // V2: Auto-create first follow-up (Call, next business day 9am)
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    nextDay.setHours(9, 0, 0, 0);

    await prisma.followUp.create({
      data: {
        leadId: newLead.id,
        type: "Call",
        nextMeetingDate: nextDay,
        remarks: "Initial follow-up call for new lead",
        status: "Pending",
        priority: "Medium",
        assignedUserId: assignedUserId || userPayload.id,
        sourceType: "AUTO",
        companyId: userPayload.companyId,
        stageAtCreation: "Lead",
      },
    }).catch(() => {}); // Non-blocking

    // V2: Notify assigned user (with ?action=contact so the lead detail page
    // auto-opens the Call Log modal for their first interaction)
    if (newLead.assignedUserId) {
      const isSelfAssigned = newLead.assignedUserId === userPayload.id;
      await dispatchNotification({
        userId: newLead.assignedUserId,
        title: isSelfAssigned ? "New Lead Created" : "New Lead Assigned",
        message: `${isSelfAssigned ? "Lead created" : "New lead assigned"}: ${data.companyName || name} (${leadCode})`,
        type: "lead",
        link: `/leads/${newLead.id}?action=contact`,
      }).catch(() => {});
    }

    // V2: Run duplicate detection (non-blocking)
    await detectDuplicates(newLead.id, phone, data.companyName, userPayload.companyId).catch(() => {});

    await logAudit(userPayload.id, "LEADS", "CREATE_LEAD", `Created lead: ${name} (${leadCode}) — Score: ${leadScore}/100 — SLA: ${slaDeadline.toISOString()}`);
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
    budgetAsked?: string;
    timelineAsked?: string;
    isGenuine?: boolean;
    lostReason?: string;
    // V2 fields
    companyName?: string;
    designation?: string;
    industryType?: string;
    estimatedValue?: number;
    lostReasonRefId?: string;
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

    // BRD V1: reject forbidden lead status values
    const FORBIDDEN_LEAD_STATUSES = ["ProposalSent", "Negotiation", "ActiveNegotiation"];
    if (data.status && FORBIDDEN_LEAD_STATUSES.includes(data.status)) {
      return { success: false, message: `Lead status "${data.status}" is not valid in Variant 1.` };
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

    // V2: Insert LeadStatusHistory on status change
    if (data.status && data.status !== lead.status) {
      await insertStatusHistory(id, lead.status, data.status, userPayload.id,
        `Status changed from ${lead.status} to ${data.status}`);
    }

    // V2: Recalculate leadScore if scoring fields changed
    const scoreFieldsChanged =
      data.industryType !== undefined || data.leadSource !== undefined ||
      data.designation !== undefined || data.estimatedValue !== undefined ||
      data.email !== undefined || data.phone !== undefined;
    if (scoreFieldsChanged) {
      const newScore = calculateLeadScore({
        industryType: data.industryType !== undefined ? data.industryType : updated.industryType,
        leadSource: data.leadSource !== undefined ? data.leadSource : updated.leadSource,
        designation: data.designation !== undefined ? data.designation : updated.designation,
        estimatedValue: data.estimatedValue !== undefined ? data.estimatedValue : updated.estimatedValue,
        email: data.email !== undefined ? data.email : updated.email,
        phone: data.phone !== undefined ? data.phone : updated.phone,
      });
      if (newScore !== updated.leadScore) {
        await prisma.lead.update({ where: { id }, data: { leadScore: newScore } });
      }
    }

    // V2: Run duplicate detection on update (non-blocking)
    if (data.phone !== undefined || data.companyName !== undefined) {
      await detectDuplicates(id, data.phone ?? updated.phone, data.companyName ?? updated.companyName, userPayload.companyId).catch(() => {});
    }

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

    // BUG-030/031: Create activity log entry for status transitions (SQL, Qualified, Lost)
    const statusTransition = data.status && data.status !== lead.status;
    if (statusTransition && ["SQL", "Qualified", "Lost"].includes(data.status!)) {
      const transitionMessages: Record<string, string> = {
        SQL: `Lead qualified as SQL — Budget: ${updated.budgetAsked || "N/A"}, Timeline: ${updated.timelineAsked || "N/A"}`,
        Qualified: "Lead marked as Qualified — Customer record created automatically",
        Lost: `Lead marked as Lost${data.lostReason ? ` — Reason: ${data.lostReason}` : ""}`,
      };
      await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Note",
          leadId: id,
          customerId: null,
          dealId: null,
          direction: "N/A",
          duration: null,
          content: transitionMessages[data.status!],
          status: "Completed",
          sentByUserId: userPayload.id,
          sentAt: now,
          companyId: userPayload.companyId ?? null,
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
 * Unified "Contact Lead" action.
 *
 * Both "Log First Call" (shown after lead creation) and "Mark Contacted"
 * (shown inside lead details) call this single function. They are only
 * different UI entry points for the same business action.
 *
 * MANDATORY CALL LOG: The lead status is NOT updated unless a Call Activity
 * is logged with user-provided details. The flow is:
 *   1. User clicks "Mark Contacted" / "Log First Call"
 *   2. Call Log form opens (pre-filled with leadId, type=Call, direction=Outbound)
 *   3. User fills required call details & saves
 *   4. This action creates the Call activity (CommunicationLog)
 *   5. Only THEN is lead status updated: "New" -> "Contacted"
 *
 * Every contacted lead is guaranteed to have at least 1 call activity.
 */
export async function contactLeadAction(
  leadId: string,
  callData: {
    content: string;            // call notes/outcome — REQUIRED
    direction?: string;         // "Outbound" | "Inbound" (default: Outbound)
    duration?: number | null;   // minutes
    status?: string;            // "Completed" | "NoAnswer" | "Scheduled"
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

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Only allow transition from "New" to "Contacted"
    if (lead.status !== "New") {
      return { success: false, message: `Lead is already "${lead.status}". Only New leads can be marked as Contacted.` };
    }

    // MANDATORY: call notes/outcome must be provided — no silent status updates
    if (!callData?.content?.trim()) {
      return { success: false, message: "Call notes/outcome are required to mark a lead as Contacted." };
    }

    // Fetch assigned user name and acting user name for "on behalf of" tagging
    let assignedUserName: string | undefined;
    let actingUserName: string | undefined;
    if (lead.assignedUserId) {
      const [assignedUser, actingUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: lead.assignedUserId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userPayload.id }, select: { name: true } }),
      ]);
      assignedUserName = assignedUser?.name;
      actingUserName = actingUser?.name;
    }

    const now = new Date();
    const isFirstResponse = !lead.firstRespondedAt;

    // Detect if Admin/SalesManager is acting on behalf of the assigned executive
    const isActingOnBehalf = lead.assignedUserId && lead.assignedUserId !== userPayload.id &&
      (userPayload.role === "Admin" || userPayload.role === "SalesManager");
    const onBehalfTag = isActingOnBehalf ? ` [Logged by ${actingUserName || userPayload.role} on behalf of ${assignedUserName || "assigned executive"}]` : "";

    // 1. Create the Call Activity FIRST (with user-provided details)
    //    Status is NOT updated until the call log is persisted.
    const activityLog = await prisma.communicationLog.create({
      data: {
        id: nanoid(),
        channel: "Call",
        leadId,
        customerId: null,
        dealId: null,
        direction: callData.direction?.trim() || "Outbound",
        duration: callData.duration ?? null,
        content: callData.content.trim() + onBehalfTag,
        status: callData.status?.trim() || "Completed",
        sentByUserId: userPayload.id,
        sentAt: now,
        companyId: userPayload.companyId ?? null,
      },
    });

    // 2. Only AFTER the call activity is saved, update lead status: New -> Contacted
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "Contacted",
        lastInteractionAt: now,
        ...(isFirstResponse ? { slaStatus: "Met", firstRespondedAt: now } : {}),
      },
    });

    // 2a. Mark the pending auto-created follow-up (1st Call) as Completed
    //     so the Follow-up section stays in sync with the Activity timeline.
    await prisma.followUp.updateMany({
      where: {
        leadId,
        status: "Pending",
        type: "Call",
        sourceType: "AUTO",
      },
      data: {
        status: "Completed",
        completedAt: now,
        completionNotes: callData.content.trim(),
      },
    }).catch(() => {}); // Non-blocking — should not fail the contact action

    // 3. Audit trail (same shape as updateLeadAction)
    const { before, after } = computeDiff(
      { status: lead.status },
      { status: updated.status }
    );
    await logAudit(
      userPayload.id,
      "LEADS",
      "CONTACT_LEAD",
      `Lead contacted: ${updated.name} (${updated.leadCode}) — status changed from New to Contacted${isFirstResponse ? " — SLA Met (first response recorded)" : ""}${onBehalfTag}`,
      {
        resourceId:    leadId,
        previousState: Object.keys(before).length ? before : null,
        newState:      Object.keys(after).length  ? after  : null,
        severity:      inferSeverity("update"),
        onBehalfOf:    isActingOnBehalf ? (lead.assignedUserId ?? undefined) : undefined,
        adminAction:   isActingOnBehalf || undefined,
      }
    );

    // 4. Trigger the same notifications as other status changes
    if (updated.assignedUserId) {
      await dispatchNotification({
        userId: updated.assignedUserId,
        title: "Lead Contacted",
        message: `Lead "${updated.name}" (${updated.leadCode}) has been marked as Contacted.`,
        type: "lead",
        link: `/leads/${leadId}`,
      }).catch((e) => console.error("Notification failed", e));
    }
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
        title: "Lead Contacted",
        message: `Lead "${updated.name}" (${updated.leadCode}) progressed to Contacted stage.`,
        type: "lead",
        link: `/leads/${leadId}`,
      }).catch((e) => console.error("Notification failed", e));
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return {
      success: true,
      message: "Lead marked as Contacted successfully.",
      data: { lead: updated, activityLog },
    };
  } catch (error) {
    console.error("Contact Lead Error:", error);
    return { success: false, message: "Failed to mark lead as Contacted." };
  }
}

/**
 * Delete a Lead (Soft-delete for Admins, Hard-delete for SuperAdmins).
 */
export async function deleteLeadAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized. Only Admins can delete leads." };
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

    // Gate: Lead should be SQL or Qualified before conversion
    // Admin/SalesManager can bypass this gate
    if (!["SQL", "Qualified", "Converted"].includes(lead.status) && !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Lead must be qualified (SQL status) before conversion. Only managers can bypass this gate." };
    }

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

      // 3. Generate opportunity code: OPP-YYYY-NNNNN
      const year = new Date().getFullYear();
      const oppPrefix = `OPP-${year}-`;
      const oppCount = await tx.deal.count({
        where: { companyId: userPayload.companyId, opportunityCode: { startsWith: oppPrefix } },
      });
      const opportunityCode = `${oppPrefix}${String(oppCount + 1).padStart(5, "0")}`;

      // 4. Create the Deal (starts at Qualified stage)
      const deal = await tx.deal.create({
        data: {
          dealName,
          customerId: customer.id,
          dealValue: parseFloat(dealValue as any),
          expectedCloseDate: new Date(expectedCloseDate),
          assignedUserId: lead.assignedUserId || userPayload.id,
          status: "Qualified",
          stageEnteredAt: new Date(),
          companyId: userPayload.companyId,
          opportunityCode,
          probabilityPercent: 20,
        }
      });

      // 4. Create Deal Stage History
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: null,
          toStatus: "Qualified",
          changedById: userPayload.id
        }
      });

      // 5. Create a Contact record from lead data
      const contact = await tx.contact.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: customer.name,
          status: "Active",
          contactType: "Technical",
          isPrimary: true,
          customerId: customer.id,
          ownerId: lead.assignedUserId || userPayload.id,
          companyId: userPayload.companyId,
        }
      });

      // 6. Seed OpportunityDetail with lead data
      await tx.opportunityDetail.create({
        data: {
          dealId: deal.id,
          companyName: lead.companyName || lead.name,
          email: lead.email,
          phone: lead.phone,
          contactPerson: lead.name,
          industry: lead.industryType,
          budgetRange: lead.budgetAsked,
          timeline: lead.timelineAsked,
          decisionMaker: lead.name,
          businessNeed: lead.notes,
        }
      });

      return { customer, deal, contact };
    });

    await logAudit(
      userPayload.id,
      "Deal",
      "Create",
      `Created converted deal "${dealName}" for customer ${result.customer.name} (Value: ₹${dealValue})`
    );

    revalidatePath("/leads");
    revalidatePath("/deals");
    revalidatePath("/sales-pipeline");
    revalidatePath("/customer-master");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");

    return { success: true, message: "Lead successfully converted to Customer and Deal created.", dealId: result.deal.id };
  } catch (error) {
    console.error("Convert lead to deal error:", error);
    return { success: false, message: "Failed to convert lead to deal" };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// V2 ACTIONS — BANT Qualification, Mark Lost, Atomic Convert, Status History
// ════════════════════════════════════════════════════════════════════════════

/**
 * V2: Qualify a lead as SQL via BANT checklist.
 * Requires has_budget AND has_authority AND has_need to be true.
 */
export async function qualifyLeadAction(
  leadId: string,
  data: { hasBudget: boolean; hasAuthority: boolean; hasNeed: boolean; timelineMonths: number }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    if (!data.hasBudget || !data.hasAuthority || !data.hasNeed) {
      return { success: false, message: "Budget, Authority, and Need must all be confirmed to qualify as SQL." };
    }
    if (!data.timelineMonths || data.timelineMonths <= 0) {
      return { success: false, message: "Timeline (months) is required and must be positive." };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, message: "Lead not found." };
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Update BANT fields + status to SQL
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "SQL",
        budgetAsked: `Confirmed — Budget available`,
        timelineAsked: `${data.timelineMonths} months`,
        isGenuine: data.hasNeed,
      },
    });

    // Insert status history
    await insertStatusHistory(leadId, lead.status, "SQL", userPayload.id,
      `BANT: Budget=${data.hasBudget}, Authority=${data.hasAuthority}, Need=${data.hasNeed}, Timeline=${data.timelineMonths}m`);

    // Notify Sales Managers
    const managers = await prisma.user.findMany({
      where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: userPayload.companyId },
      select: { id: true },
    });
    if (managers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managers.map(m => m.id),
        title: "Lead Qualified as SQL",
        message: `Lead ${lead.leadCode} — ${lead.companyName || lead.name} qualified as SQL (BANT complete).`,
        type: "lead",
        link: `/leads/${leadId}`,
      }).catch(() => {});
    }

    await logAudit(userPayload.id, "LEADS", "QUALIFY_SQL", `Lead ${lead.leadCode} qualified as SQL via BANT checklist`);
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return { success: true, message: "Lead qualified as SQL successfully.", data: updated };
  } catch (error) {
    console.error("Qualify Lead Error:", error);
    return { success: false, message: "Failed to qualify lead." };
  }
}

/**
 * V2: Mark a lead as Lost with a loss reason ID.
 * Bulk-cancels open follow-ups for this lead.
 */
export async function markLeadLostAction(leadId: string, lossReasonId: string, notes?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    if (!lossReasonId) {
      return { success: false, message: "Loss reason is required." };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, message: "Lead not found." };
    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // Fetch loss reason text for audit
    const lossReason = await prisma.lossReason.findUnique({ where: { id: lossReasonId } });

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "Lost",
        lostReason: lossReason?.name || "Unknown",
        lostReasonRefId: lossReasonId,
      },
    });

    // Insert status history
    await insertStatusHistory(leadId, lead.status, "Lost", userPayload.id,
      `Lost reason: ${lossReason?.name || "Unknown"}${notes ? ` — ${notes}` : ""}`);

    // Bulk-cancel open follow-ups
    await prisma.followUp.updateMany({
      where: { leadId, status: "Pending" },
      data: { status: "Cancelled" },
    });

    // Notify assigned user
    if (updated.assignedUserId) {
      await dispatchNotification({
        userId: updated.assignedUserId,
        title: "Lead Marked Lost",
        message: `Lead ${lead.leadCode} — ${lead.companyName || lead.name} marked as Lost (${lossReason?.name}).`,
        type: "lead",
        link: `/leads/${leadId}`,
      }).catch(() => {});
    }

    await logAudit(userPayload.id, "LEADS", "MARK_LOST", `Lead ${lead.leadCode} marked lost: ${lossReason?.name}`);
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return { success: true, message: "Lead marked as Lost. Open follow-ups cancelled.", data: updated };
  } catch (error) {
    console.error("Mark Lead Lost Error:", error);
    return { success: false, message: "Failed to mark lead as lost." };
  }
}

/**
 * V2: Convert a lead atomically — creates Account + Contact + Opportunity in one transaction.
 * GSTIN validation, code generation, status history, and stage history included.
 */
export async function convertLeadV2Action(
  leadId: string,
  data: {
    account: {
      companyName: string;
      gstNumber?: string;
      accountType?: string;
      industryType?: string;
      billingAddress?: string;
    };
    contact: {
      fullName: string;
      designation?: string;
      email?: string;
      phone?: string;
      contactCategory?: string;
    };
    opportunity: {
      opportunityName: string;
      estimatedValue?: number;
      expectedCloseDate: string;
    };
  }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || ["Customer"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, message: "Lead not found." };
    if (lead.status === "Converted") return { success: false, message: "Lead is already converted." };

    // Gate: Lead should be SQL or Qualified before conversion
    // Admin/SalesManager can bypass this gate
    if (!["SQL", "Qualified", "Converted"].includes(lead.status) && !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Lead must be qualified (SQL status) before conversion. Only managers can bypass this gate." };
    }

    if (!checkRecordScope(userPayload, lead, "Lead")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    // V2: GSTIN validation if provided
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (data.account.gstNumber && !GSTIN_REGEX.test(data.account.gstNumber)) {
      return { success: false, message: "Invalid GSTIN format. Expected: 2 digits + 5 letters + 4 digits + 1 alphanumeric + Z + 1 alphanumeric." };
    }

    // Execute atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate account code: ACC-NNNNN
      const accountCount = await tx.customer.count({
        where: { companyId: userPayload.companyId },
      });
      const accountCode = `ACC-${String(accountCount + 1).padStart(5, "0")}`;

      // Auto-assign owner based on territory matching the lead's city
      let resolvedOwnerId = lead.assignedUserId || userPayload.id;
      let matchingTerritoryId: string | null = null;
      if (lead.city?.trim()) {
        const matchingTerritory = await tx.territory.findFirst({
          where: {
            companyId: userPayload.companyId,
            isActive: true,
            OR: [
              { name: { contains: lead.city.trim() } },
              { states: { contains: lead.city.trim() } }
            ]
          }
        });
        if (matchingTerritory) {
          matchingTerritoryId = matchingTerritory.id;
          if (matchingTerritory.assignedUserId) {
            resolvedOwnerId = matchingTerritory.assignedUserId;
          }
        }
      }

      // 2. Create Account (Customer)
      const account = await tx.customer.create({
        data: {
          customerCode: accountCode,
          name: data.account.companyName,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          status: "Active",
          assignedUserId: resolvedOwnerId,
          convertedFromLead: lead.id,
          leadSource: lead.leadSource,
          companyId: userPayload.companyId,
          // V2 fields
          gstNumber: data.account.gstNumber || null,
          accountType: data.account.accountType || "Customer",
          industryType: data.account.industryType || lead.industryType || null,
          billingAddress: data.account.billingAddress || null,
        },
      });

      // Link Account to Territory if mapped
      if (matchingTerritoryId) {
        await tx.territoryAccount.create({
          data: {
            territoryId: matchingTerritoryId,
            customerId: account.id
          }
        });
      }

      // 3. Create Contact linked to new account
      const contact = await tx.contact.create({
        data: {
          name: data.contact.fullName,
          email: data.contact.email || lead.email,
          phone: data.contact.phone || lead.phone,
          company: account.name,
          designation: data.contact.designation || lead.designation || null,
          status: "Active",
          contactType: data.contact.contactCategory || "Technical",
          isPrimary: true,
          customerId: account.id,
          ownerId: resolvedOwnerId,
          companyId: userPayload.companyId,
        },
      });

      // 4. Generate opportunity code: OPP-YYYY-NNNNN
      const year = new Date().getFullYear();
      const oppPrefix = `OPP-${year}-`;
      const oppCount = await tx.deal.count({
        where: { companyId: userPayload.companyId, dealName: { startsWith: oppPrefix } },
      });
      const opportunityCode = `${oppPrefix}${String(oppCount + 1).padStart(5, "0")}`;

      // 5. Create Opportunity (Deal)
      const deal = await tx.deal.create({
        data: {
          dealName: data.opportunity.opportunityName,
          customerId: account.id,
          dealValue: data.opportunity.estimatedValue || lead.estimatedValue || 0,
          expectedCloseDate: new Date(data.opportunity.expectedCloseDate),
          assignedUserId: resolvedOwnerId,
          status: "Qualified",
          stageEnteredAt: new Date(),
          companyId: userPayload.companyId,
          // V2 fields
          opportunityCode,
          probabilityPercent: 20,
        },
      });

      // 5b. Seed OpportunityDetail with lead qualification data
      await tx.opportunityDetail.create({
        data: {
          dealId: deal.id,
          companyName: lead.companyName || lead.name,
          email: lead.email,
          phone: lead.phone,
          contactPerson: lead.name,
          budgetRange: lead.budgetAsked,
          timeline: lead.timelineAsked,
          decisionMaker: lead.name,
          industry: lead.industryType || null,
          businessNeed: lead.notes || null,
          // V5: leadVerified maps from lead.isGenuine (avoids businessNeed key collision)
          leadVerified: lead.isGenuine ?? false,
        },
      });

      // 6. Create Deal Stage History (initial)
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: null,
          toStatus: "Qualified",
          changedById: userPayload.id,
        },
      });

      // 7. Update Lead: set converted fields + status
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "Converted",
          convertedAccountId: account.id,
          convertedOpportunityId: deal.id,
        },
      });

      // 8. Insert lead status history
      await tx.leadStatusHistory.create({
        data: {
          leadId,
          fromStatus: lead.status,
          toStatus: "Converted",
          changedById: userPayload.id,
          notes: `Converted to Account ${accountCode} + Opportunity ${opportunityCode}`,
        },
      });

      // 9. Re-link existing records to new account
      await tx.marketingVisit.updateMany({
        where: { leadId },
        data: { customerId: account.id },
      });
      await tx.followUp.updateMany({
        where: { leadId, status: "Pending" },
        data: { customerId: account.id },
      });
      await tx.callLog.updateMany({
        where: { leadId },
        data: { customerId: account.id },
      });
      await tx.communicationLog.updateMany({
        where: { leadId },
        data: { customerId: account.id },
      });

      return { account, contact, deal };
    });

    await logAudit(
      userPayload.id,
      "LEADS",
      "CONVERT_LEAD_V2",
      `Converted lead ${lead.leadCode} → Account ${result.account.customerCode} + Contact + Opportunity ${result.deal.opportunityCode}`
    );

    revalidatePath("/leads");
    revalidatePath("/customer-master");
    revalidatePath("/contacts");
    revalidatePath("/sales-pipeline");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Lead converted successfully. Account, Contact, and Opportunity created.",
      accountId: result.account.id,
      contactId: result.contact.id,
      opportunityId: result.deal.id,
    };
  } catch (error) {
    console.error("Convert Lead V2 Error:", error);
    return { success: false, message: "Failed to convert lead. All changes rolled back." };
  }
}

/**
 * V2: Fetch lead status history for timeline display.
 */
export async function getLeadStatusHistoryAction(leadId: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const history = await prisma.leadStatusHistory.findMany({
      where: { leadId },
      orderBy: { changedAt: "desc" },
    });

    return { success: true, data: history };
  } catch (error) {
    console.error("Get Lead Status History Error:", error);
    return { success: false, message: "Failed to fetch status history." };
  }
}
