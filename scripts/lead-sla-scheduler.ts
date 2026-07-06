/**
 * Lead SLA & Escalation Scheduler — scripts/lead-sla-scheduler.ts
 *
 * Runs on a cron schedule and enforces the 3-tier SLA policy:
 *   Tier 1: 15-min first-response SLA breach detection
 *   Tier 2: 48-hour Level 1 escalation (manager alert)
 *   Tier 3: 72-hour Level 2 auto-reassignment
 *
 * Run via: npx ts-node -O '{"module":"commonjs"}' scripts/lead-sla-scheduler.ts
 * Or as a cron: add to package.json scripts and invoke from a task scheduler.
 */

import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { logAudit } from "@/lib/audit";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function dispatchInAppNotification(userId: string, title: string, message: string, link: string) {
  await prisma.notification.create({
    data: { userId, title, message, type: "lead", link, isRead: false },
  });
}

async function getManagerIds(companyId: string): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: { 
      role: { in: ["Admin", "SalesManager"] }, 
      isActive: true,
      companyId
    },
    select: { id: true },
  });
  return managers.map((m) => m.id);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER) {
    console.warn(`⚠️  SMTP credentials missing — skipping email to ${to}`);
    return;
  }
  await transporter.sendMail({
    from: `"Suki CRM" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

// ─── Workload-based reassignment ──────────────────────────────────────────────

async function pickLeastBusyExecutive(excludeUserId?: string | null) {
  const executives = await prisma.user.findMany({
    where: {
      role: "SalesExecutive",
      isActive: true,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      leads: {
        where: { status: { in: ["New", "Contacted"] } },
        select: { id: true },
      },
    },
  });

  if (executives.length === 0) return null;
  executives.sort((a, b) => a.leads.length - b.leads.length);
  return executives[0];
}

// ─── Tier 1: 15-Minute SLA Breach Detection ───────────────────────────────────

async function run24HourNotContactedCheck() {
  console.log("🔍 [SLA Pre-Tier] Checking 24-hour not-contacted leads...");
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const notContactedLeads = await prisma.lead.findMany({
    where: {
      status: "New",
      firstRespondedAt: null,
      createdAt: { lt: twentyFourHoursAgo },
    },
    include: {
      assignedUser: { select: { id: true, name: true } },
    },
  });

  if (notContactedLeads.length === 0) {
    console.log("   ✅ No 24h not-contacted leads.");
    return;
  }

  for (const lead of notContactedLeads) {
    const managerIds = await getManagerIds(lead.companyId || "");
    // Notify assigned executive
    if (lead.assignedUser) {
      await dispatchInAppNotification(
        lead.assignedUser.id,
        "Lead Not Contacted (24h)",
        `Lead ${lead.leadCode} (${lead.name}) has been in New status for 24+ hours without contact. Please reach out immediately.`,
        `/leads/${lead.id}`
      );
    }

    // Notify managers
    for (const managerId of managerIds) {
      if (managerId !== lead.assignedUser?.id) {
        await dispatchInAppNotification(
          managerId,
          "Lead Not Contacted (24h)",
          `Lead ${lead.leadCode} (${lead.name}) assigned to ${lead.assignedUser?.name || "Unassigned"} has not been contacted in 24 hours.`,
          `/leads/${lead.id}`
        );
      }
    }

    console.log(`   ⚠️  ${lead.leadCode} not contacted in 24h. Notifications sent.`);
  }
}

async function runSlaBreachDetection() {
  console.log("🔍 [SLA Tier 1] Checking 15-minute first-response SLA breaches...");
  const now = new Date();

  const breachedLeads = await prisma.lead.findMany({
    where: {
      slaStatus: "Pending",
      slaResponseDeadline: { lt: now },
      firstRespondedAt: null,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (breachedLeads.length === 0) {
    console.log("   ✅ No SLA breaches detected.");
    return;
  }

  console.log(`   ⚠️  ${breachedLeads.length} lead(s) have breached the 15-min SLA.`);

  for (const lead of breachedLeads) {
    const managerIds = await getManagerIds(lead.companyId || "");
    // Update slaStatus to Breached
    await prisma.lead.update({
      where: { id: lead.id },
      data: { slaStatus: "Breached" },
    });

    // Notify assigned executive
    if (lead.assignedUser) {
      await dispatchInAppNotification(
        lead.assignedUser.id,
        "⚠️ SLA Breached — Immediate Action Required",
        `Lead ${lead.leadCode} (${lead.name}) has not received a first response and has breached the 15-minute SLA. Please contact the lead now.`,
        `/leads/${lead.id}`
      );

      // Email the executive
      await sendEmail(
        lead.assignedUser.email,
        `⚠️ SLA Breach Alert: Lead ${lead.leadCode}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:#991b1b;padding:20px;text-align:center">
            <h2 style="color:#fff;margin:0">⚠️ SLA Breach Alert</h2>
          </div>
          <div style="padding:24px">
            <p>Hi <strong>${lead.assignedUser.name}</strong>,</p>
            <p>Lead <strong>${lead.leadCode} — ${lead.name}</strong> has not received a first response and has <strong style="color:#dc2626">breached the 15-minute SLA</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:15px">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Lead</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${lead.name}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Code</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${lead.leadCode}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Source</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${lead.leadSource}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">SLA Deadline</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#dc2626">${lead.slaResponseDeadline?.toLocaleString("en-IN")}</td></tr>
            </table>
            <p style="margin-top:20px">Please <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leads/${lead.id}" style="color:#0ea5e9">open the lead in the CRM</a> and take immediate action.</p>
          </div>
        </div>
        `
      ).catch(console.error);
    }

    // Notify all managers
    for (const managerId of managerIds) {
      if (managerId !== lead.assignedUser?.id) {
        await dispatchInAppNotification(
          managerId,
          "🚨 Lead SLA Breached",
          `Lead ${lead.leadCode} (${lead.name}) assigned to ${lead.assignedUser?.name || "Unassigned"} has not received a first contact and breached the 15-min SLA.`,
          `/leads/${lead.id}`
        );
      }
    }

    console.log(`   🔴 Marked ${lead.leadCode} as SLA Breached. Notifications sent.`);
    await logAudit(null, "lead", "SLA_BREACH_15MIN",
      `SLA Breach: Lead ${lead.leadCode} (${lead.name}) — assigned to ${lead.assignedUser?.name || "Unassigned"} — no first response within 15 minutes.`,
      { resourceId: lead.id, severity: "CRITICAL" }
    ).catch(console.error);
  }
}

// ─── Tier 2: 48-Hour Level 1 Manager Escalation ───────────────────────────────

async function run48HourEscalation() {
  console.log("🔍 [SLA Tier 2] Checking 48-hour Level 1 escalations...");
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleleads = await prisma.lead.findMany({
    where: {
      status: { in: ["New", "Contacted"] },
      escalationLevel: 0,
      createdAt: { lt: fortyEightHoursAgo },
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (staleleads.length === 0) {
    console.log("   ✅ No 48-hour escalations needed.");
    return;
  }

  console.log(`   ⚠️  ${staleleads.length} lead(s) escalating to Level 1 (Manager Alert).`);

  for (const lead of staleleads) {
    const managerIds = await getManagerIds(lead.companyId || "");
    await prisma.lead.update({
      where: { id: lead.id },
      data: { escalationLevel: 1 },
    });

    // Alert all managers
    for (const managerId of managerIds) {
      await dispatchInAppNotification(
        managerId,
        "🟠 Lead Escalation — Level 1 (48h No Progress)",
        `Lead ${lead.leadCode} (${lead.name}) assigned to ${lead.assignedUser?.name || "Unassigned"} has had no progress in 48+ hours. Review required.`,
        `/leads/${lead.id}`
      );
    }

    console.log(`   🟠 ${lead.leadCode} escalated to Level 1.`);
  }
}

// ─── Tier 3: 72-Hour Level 2 Auto-Reassignment ───────────────────────────────

async function run72HourAutoReassignment() {
  console.log("🔍 [SLA Tier 3] Checking 72-hour Level 2 auto-reassignments...");
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const criticalLeads = await prisma.lead.findMany({
    where: {
      status: { in: ["New", "Contacted"] },
      escalationLevel: 1,
      createdAt: { lt: seventyTwoHoursAgo },
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (criticalLeads.length === 0) {
    console.log("   ✅ No 72-hour auto-reassignments needed.");
    return;
  }

  console.log(`   🔴 ${criticalLeads.length} lead(s) triggering Level 2 auto-reassignment.`);

  for (const lead of criticalLeads) {
    const managerIds = await getManagerIds(lead.companyId || "");
    const newExecutive = await pickLeastBusyExecutive(lead.assignedUserId);

    if (!newExecutive) {
      console.warn(`   ⚠️  No available executive to reassign ${lead.leadCode}. Skipping.`);
      continue;
    }

    const now = new Date();
    const newSlaDeadline = new Date(now.getTime() + 15 * 60 * 1000);

    // Reassign the lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        assignedUserId: newExecutive.id,
        escalationLevel: 2,
        slaStatus: "Pending",
        slaResponseDeadline: newSlaDeadline,
        lastInteractionAt: now,
      },
    });

    // Log the ownership transfer
    await prisma.leadOwnerHistory.create({
      data: {
        leadId: lead.id,
        fromUserId: lead.assignedUserId,
        toUserId: newExecutive.id,
        changedById: null, // SYSTEM
        reason: "SLA Level 2 Breach — Auto-Reassignment by System after 72h inactivity",
      },
    });

    // Notify old executive
    if (lead.assignedUser) {
      await dispatchInAppNotification(
        lead.assignedUser.id,
        "🔴 Lead Reassigned (SLA Breach)",
        `Lead ${lead.leadCode} (${lead.name}) has been automatically reassigned to ${newExecutive.name} due to 72-hour SLA inactivity.`,
        `/leads/${lead.id}`
      );
    }

    // Notify new executive
    await dispatchInAppNotification(
      newExecutive.id,
      "📋 New Lead Auto-Assigned — Urgent SLA",
      `Lead ${lead.leadCode} (${lead.name}) was escalated to you due to a prior SLA breach. Please respond immediately.`,
      `/leads/${lead.id}`
    );

    // Notify all managers
    for (const managerId of managerIds) {
      await dispatchInAppNotification(
        managerId,
        "🔴 Lead Escalation — Level 2 Auto-Reassigned",
        `Lead ${lead.leadCode} (${lead.name}) was auto-reassigned from ${lead.assignedUser?.name || "Unassigned"} to ${newExecutive.name} due to 72h SLA breach.`,
        `/leads/${lead.id}`
      );
    }

    console.log(`   🔴 ${lead.leadCode} auto-reassigned from ${lead.assignedUser?.name} → ${newExecutive.name}`);
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runLeadSlaScheduler() {
  console.log("\n🚀 Suki CRM Lead SLA Scheduler — Starting sweep at", new Date().toLocaleString("en-IN"));
  try {
    await run24HourNotContactedCheck(); // 24h no contact
    await runSlaBreachDetection();    // Every 5 minutes
    await run48HourEscalation();      // Level 1
    await run72HourAutoReassignment(); // Level 2
  } catch (err) {
    console.error("❌ SLA Scheduler error:", err);
  } finally {
    console.log("✅ SLA sweep complete.\n");
  }
}

// ─── Entry point (run directly or schedule) ───────────────────────────────────

if (require.main === module) {
  console.log("Suki CRM Lead SLA Scheduler started.");
  console.log("Configured sweep: every 5 minutes.");

  // Run every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    runLeadSlaScheduler().finally(() => prisma.$disconnect());
  });

  // Run immediately on startup
  runLeadSlaScheduler().catch(console.error);
}
