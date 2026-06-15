import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

/**
 * GET /api/cron/subscriptions
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily sweep that runs THREE passes:
 *
 *  Pass 1 — Expiry:
 *    Active subscriptions past endDate → mark Expired
 *
 *  Pass 2 — 30-day renewal alert:
 *    Active subscriptions expiring within 30 days where renewalAlertSent30 = false
 *    → notify assigned executive + Admin group, set renewalAlertSent30 = true
 *
 *  Pass 3 — 7-day renewal alert:
 *    Active subscriptions expiring within 7 days where renewalAlertSent7 = false
 *    → notify assigned executive + Admin group, set renewalAlertSent7 = true
 *
 * Secured by CRON_SECRET Bearer token.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(request: Request) {
  try {
    // ── Auth gate ────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // ── PASS 1: Expire overdue subscriptions ─────────────────────────────────
    const expiredActive = await prisma.subscription.findMany({
      where: {
        status: "Active",
        endDate: { lt: now },
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true, assignedUserId: true } },
      },
    });

    let expiredCount = 0;
    if (expiredActive.length > 0) {
      const expiredIds = expiredActive.map((s) => s.id);
      await prisma.subscription.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: "Expired" },
      });
      expiredCount = expiredActive.length;

      for (const sub of expiredActive) {
        await logAudit(
          "system",
          "subscription",
          "Expired",
          `Subscription ${sub.id} (Plan: ${sub.planName}) for customer "${sub.customer?.name}" transitioned to Expired automatically. EndDate: ${sub.endDate.toISOString()}`
        );
      }
    }

    // ── PASS 2: 30-day renewal alerts ────────────────────────────────────────
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const alert30List = await prisma.subscription.findMany({
      where: {
        status: "Active",
        endDate: { gte: now, lte: in30Days },
        renewalAlertSent30: false,
        deletedAt: null,
      },
      include: {
        customer: {
          select: {
            name: true,
            assignedUserId: true,
            companyId: true,
          },
        },
      },
    });

    let alert30Count = 0;
    for (const sub of alert30List) {
      const daysLeft = Math.ceil(
        (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Notify assigned executive
      if (sub.customer?.assignedUserId) {
        await dispatchNotification({
          userId: sub.customer.assignedUserId,
          title: "Subscription Renewal Due in 30 Days",
          message: `Subscription "${sub.planName}" for customer "${sub.customer.name}" expires in ${daysLeft} days (${sub.endDate.toDateString()}). Schedule a renewal call.`,
          type: "subscription",
          link: `/subscriptions`,
        });
      }

      // Notify all Admins in the same tenant
      if (sub.customer?.companyId) {
        const admins = await prisma.user.findMany({
          where: {
            role: { in: ["Admin", "SalesManager"] },
            isActive: true,
            companyId: sub.customer.companyId,
            id: { not: sub.customer.assignedUserId ?? undefined },
          },
          select: { id: true },
        });
        if (admins.length > 0) {
          await dispatchNotificationsToMany({
            userIds: admins.map((a) => a.id),
            title: "Subscription Renewal — 30-Day Alert",
            message: `"${sub.planName}" for "${sub.customer.name}" expires in ${daysLeft} days.`,
            type: "subscription",
            link: `/subscriptions`,
          });
        }
      }

      // Mark sentinel to prevent re-dispatch
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalAlertSent30: true },
      });

      await logAudit(
        "system",
        "subscription",
        "RenewalAlert30",
        `30-day renewal alert dispatched for subscription "${sub.planName}" (customer: ${sub.customer?.name}, expires: ${sub.endDate.toDateString()})`
      );

      alert30Count++;
    }

    // ── PASS 3: 7-day renewal alerts ─────────────────────────────────────────
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const alert7List = await prisma.subscription.findMany({
      where: {
        status: "Active",
        endDate: { gte: now, lte: in7Days },
        renewalAlertSent7: false,
        deletedAt: null,
      },
      include: {
        customer: {
          select: {
            name: true,
            assignedUserId: true,
            companyId: true,
          },
        },
      },
    });

    let alert7Count = 0;
    for (const sub of alert7List) {
      const daysLeft = Math.ceil(
        (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Notify assigned executive (urgent)
      if (sub.customer?.assignedUserId) {
        await dispatchNotification({
          userId: sub.customer.assignedUserId,
          title: "⚠️ Subscription Expires in 7 Days!",
          message: `URGENT: Subscription "${sub.planName}" for "${sub.customer.name}" expires in ${daysLeft} day(s) on ${sub.endDate.toDateString()}. Renew immediately.`,
          type: "subscription",
          link: `/subscriptions`,
        });
      }

      // Notify Admins/Managers (urgent broadcast)
      if (sub.customer?.companyId) {
        const admins = await prisma.user.findMany({
          where: {
            role: { in: ["Admin", "SalesManager"] },
            isActive: true,
            companyId: sub.customer.companyId,
            id: { not: sub.customer.assignedUserId ?? undefined },
          },
          select: { id: true },
        });
        if (admins.length > 0) {
          await dispatchNotificationsToMany({
            userIds: admins.map((a) => a.id),
            title: "⚠️ Subscription Renewal — 7-Day Urgent Alert",
            message: `"${sub.planName}" for "${sub.customer.name}" expires in ${daysLeft} day(s). Immediate action required.`,
            type: "subscription",
            link: `/subscriptions`,
          });
        }
      }

      // Mark sentinel
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalAlertSent7: true },
      });

      await logAudit(
        "system",
        "subscription",
        "RenewalAlert7",
        `7-day URGENT renewal alert dispatched for subscription "${sub.planName}" (customer: ${sub.customer?.name}, expires: ${sub.endDate.toDateString()})`
      );

      alert7Count++;
    }

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      alert30Dispatched: alert30Count,
      alert7Dispatched: alert7Count,
    });
  } catch (error) {
    console.error("Cron Subscriptions Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
