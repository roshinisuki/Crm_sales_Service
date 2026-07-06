import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    // Fetch system configurations from database
    const configs = await prisma.systemConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    // 1. Optional API key validation
    const apiKeyHeader = request.headers.get("x-api-key");
    const configuredApiKey = configMap.get("leads_api_key") || process.env.LEADS_API_KEY || "suki_secret_key_123";
    if (configuredApiKey && apiKeyHeader !== configuredApiKey) {
      return NextResponse.json({ success: false, message: "Unauthorized: Invalid API Key" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { name, email, phone, city, message, leadSource } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, message: "Validation error: 'name' is required" }, { status: 400 });
    }

    const normalizedEmail = email?.trim() || null;
    const normalizedPhone = phone?.trim() || null;
    const normalizedCity = city?.trim() || null;
    const source = leadSource?.trim() || "Website";

    // 3. Duplicate detection
    if (normalizedEmail) {
      const existingEmail = await prisma.lead.findUnique({ where: { email: normalizedEmail } });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, message: "Validation error: Email address is already registered" },
          { status: 400 }
        );
      }
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.lead.findFirst({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        return NextResponse.json(
          { success: false, message: "Validation error: Phone number is already registered" },
          { status: 400 }
        );
      }
    }

    // 4. Workload-Based Auto-Assignment
    // Counts only ACTIVE leads (New or Contacted) — not closed/lost/converted ones
    const assignmentMode = configMap.get("leads_assignment_mode") || "ROUND_ROBIN";
    const defaultAssigneeId = configMap.get("leads_default_assignee_id") || "";

    let assignedUser: { id: string; name: string } | null = null;

    if (assignmentMode === "DEFAULT_POOL" && defaultAssigneeId) {
      assignedUser = await prisma.user.findFirst({
        where: { id: defaultAssigneeId, isActive: true },
        select: { id: true, name: true },
      });
    }

    if (!assignedUser) {
      // Fetch executives with their active workload count
      let executives = await prisma.user.findMany({
        where: { role: "SalesExecutive", isActive: true },
        select: {
          id: true,
          name: true,
          leads: {
            where: { status: { in: ["New", "Contacted"] } },
            select: { id: true },
          },
        },
      });

      // Fallback to Marketing Leads if no executives
      if (executives.length === 0) {
        executives = await prisma.user.findMany({
          where: { role: "SalesManager", isActive: true },
          select: {
            id: true,
            name: true,
            leads: {
              where: { status: { in: ["New", "Contacted"] } },
              select: { id: true },
            },
          },
        });
      }

      if (executives.length > 0) {
        // Sort ascending by active lead count (least busy first)
        executives.sort((a, b) => a.leads.length - b.leads.length);
        assignedUser = { id: executives[0].id, name: executives[0].name };
      } else {
        assignedUser = await prisma.user.findFirst({
          where: { role: "Admin", isActive: true },
          select: { id: true, name: true },
        });
      }
    }

    // 5. Unique lead code generation
    let leadCode = "";
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      leadCode = `LEAD-W${randomDigits}`;
      const existing = await prisma.lead.findUnique({ where: { leadCode } });
      if (!existing) isUnique = true;
      attempts++;
    }
    if (!isUnique) leadCode = `LEAD-W${Date.now().toString().slice(-5)}`;

    // 6. Calculate SLA deadline — 15 minutes from now
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + 15 * 60 * 1000);

    // 7. Create the Lead record with SLA fields
    const lead = await prisma.lead.create({
      data: {
        leadCode,
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        city: normalizedCity,
        status: "New",
        assignedUserId: assignedUser?.id || null,
        leadSource: source as any,
        notes: message || null,
        slaStatus: "Pending",
        slaResponseDeadline: slaDeadline,
        lastInteractionAt: now,
        escalationLevel: 0,
      },
    });

    // Extract request context for audit trail
    const auditCtx = extractAuditContext(request);

    await logAudit(
      null,
      "lead",
      "create",
      `Lead ingested: ${lead.name} (${lead.leadCode}) — SLA deadline: ${slaDeadline.toISOString()}`,
      {
        resourceId:    lead.id,
        previousState: null,
        newState:      { leadCode: lead.leadCode, name: lead.name, source, assignedTo: assignedUser?.name, slaDeadline },
        context:       auditCtx,
        severity:      "INFO",
      }
    );

    // 8. Log initial assignment to LeadOwnerHistory
    if (assignedUser) {
      await prisma.leadOwnerHistory.create({
        data: {
          leadId: lead.id,
          fromUserId: null, // No previous owner — fresh assignment
          toUserId: assignedUser.id,
          changedById: null, // SYSTEM assigned
          reason: `Inbound auto-assignment via ${source} (Workload-Based)`,
        },
      });
    }

    // 9. Auto follow-up task for tomorrow at 9 AM
    // DISABLED: Only SLA countdown should show, not auto-scheduled follow-up
    // if (assignedUser) {
    //   const tomorrow = new Date();
    //   tomorrow.setDate(tomorrow.getDate() + 1);
    //   tomorrow.setHours(9, 0, 0, 0);

    //   await prisma.followUp.create({
    //     data: {
    //       leadId: lead.id,
    //       assignedUserId: assignedUser.id,
    //       nextMeetingDate: tomorrow,
    //       dueDate: tomorrow,
    //       remarks: `Auto-generated follow-up: New website enquiry from ${name}. Message: ${message || "No message provided."}`,
    //       status: "Pending",
    //       sourceType: "LEAD_INGESTION",
    //       autoCreated: true,
    //     },
    //   });

    //   await logAudit(null, "follow_up", "create", `Auto-generated follow-up for lead: ${lead.leadCode}`);
    // }

    // Initial enquiry call log
    if (message && assignedUser) {
      await prisma.callLog.create({
        data: {
          leadId: lead.id,
          notes: `Inbound website enquiry message: "${message.trim()}"`,
          duration: 0,
          userId: assignedUser.id,
        },
      });
    }

    // 10. Dispatch SSE notifications
    if (assignedUser) {
      await dispatchNotification({
        userId: assignedUser.id,
        title: "🔴 New Lead Assigned — Respond within 15 min",
        message: `${name} has been assigned to you from ${source}. SLA deadline: ${slaDeadline.toLocaleTimeString("en-IN")}.`,
        type: "lead",
        link: `/leads/${lead.id}`,
      }).catch((e) => console.error("Notification failed", e));
    }

    const managers = await prisma.user.findMany({
      where: { 
        role: { in: ["Admin", "SalesManager"] }, 
        isActive: true,
        companyId: lead.companyId
      },
      select: { id: true },
    });

    if (managers.length > 0) {
      await dispatchNotificationsToMany({
        userIds: managers.map((m) => m.id),
        title: "New Website Enquiry",
        message: `${name} submitted a new enquiry from ${source}. Assigned to ${assignedUser?.name || "System"}.`,
        type: "lead",
        link: `/leads/${lead.id}`,
      }).catch((e) => console.error("Notification failed", e));
    }

    return NextResponse.json(
      {
        success: true,
        message: "Lead created and assigned successfully",
        data: {
          id: lead.id,
          leadCode: lead.leadCode,
          name: lead.name,
          slaDeadline: slaDeadline.toISOString(),
          assignedTo: assignedUser ? { id: assignedUser.id, name: assignedUser.name } : null,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/leads:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
