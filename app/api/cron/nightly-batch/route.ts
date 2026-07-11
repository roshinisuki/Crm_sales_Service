import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";
import { transitionDealStatus } from "@/lib/dealService";
import { PIPELINE_CLOSED_STAGES } from "@/lib/module-status-config";

// POST /api/cron/nightly-batch
// Called by external cron scheduler (e.g., Vercel Cron, external scheduler).
// Protected by a shared secret header.
// Runs three jobs:
//   1. Auto-inactive accounts with no activity in 180 days
//   2. Auto-activate Prospect accounts that have had a converted deal
//   3. Birthday reminders for contacts with upcoming birthdays (7-day window)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("x-cron-secret");
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const results = {
      accountsInactivated: 0,
      accountsActivated: 0,
      birthdayRemindersSent: 0,
      posAutoOnHold: 0,
    };

    // ─── Job 1: Auto-Inactive Accounts ──────────────────────────────────
    // Mark accounts as "Inactive" if no activity in 365 days and currently Active.
    // "Activity" = lastActivityDate, or latest deal/followUp/callLog updatedAt.
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);

    const staleAccounts = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        status: { in: ["Active", "ActiveCustomer"] },
        OR: [
          { lastActivityDate: { lt: cutoffDate } },
          { lastActivityDate: null, updatedAt: { lt: cutoffDate } },
        ],
      },
      select: { id: true, customerCode: true, name: true, assignedUserId: true, companyId: true },
    });

    for (const account of staleAccounts) {
      // Verify no open deals before deactivating
      const openDeals = await prisma.deal.count({
        where: {
          customerId: account.id,
          status: { notIn: ["Won", "Lost"] },
        },
      });

      if (openDeals > 0) continue;

      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: account.id },
          data: { status: "Inactive" },
        });

        await tx.accountStatusHistory.create({
          data: {
            customerId: account.id,
            fromStatus: "Active",
            toStatus: "Inactive",
            changedById: null,
            notes: "Auto-inactivated: No activity in 180 days (nightly batch)",
          },
        });
      });
      results.accountsInactivated++;
    }

    // ─── Job 2: Auto-Activate Prospect Accounts ─────────────────────────
    // Promote "Prospect" accounts to "Active" if they have at least one Won deal.
    const prospectAccounts = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        status: "Prospect",
      },
      select: { id: true, customerCode: true, name: true, companyId: true },
    });

    for (const account of prospectAccounts) {
      const wonDeals = await prisma.deal.count({
        where: {
          customerId: account.id,
          status: "Won",
        },
      });

      if (wonDeals > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.customer.update({
            where: { id: account.id },
            data: { status: "Active", accountType: "Customer" },
          });

          await tx.accountStatusHistory.create({
            data: {
              customerId: account.id,
              fromStatus: "Prospect",
              toStatus: "Active",
              changedById: null,
              notes: "Auto-activated: Won deal detected (nightly batch)",
            },
          });
        });
        results.accountsActivated++;
      }
    }

    // ─── Job 3: Birthday Reminders ──────────────────────────────────────
    // Find contacts whose birthday is within the next 7 days and notify
    // the assigned sales user of the linked account.
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const todayMonthDay = (today.getMonth() + 1) * 100 + today.getDate();
    const futureMonthDay = (sevenDaysLater.getMonth() + 1) * 100 + sevenDaysLater.getDate();

    const contacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        dateOfBirth: { not: null },
      },
      include: {
        customer: { select: { id: true, name: true, assignedUserId: true } },
      },
    });

    for (const contact of contacts) {
      if (!contact.dateOfBirth) continue;

      const birthMonthDay = (contact.dateOfBirth.getMonth() + 1) * 100 + contact.dateOfBirth.getDate();

      // Check if birthday falls within today..today+7
      let inWindow = false;
      if (todayMonthDay <= futureMonthDay) {
        inWindow = birthMonthDay >= todayMonthDay && birthMonthDay <= futureMonthDay;
      } else {
        // Wraps around year-end (e.g., Dec 28 → Jan 3)
        inWindow = birthMonthDay >= todayMonthDay || birthMonthDay <= futureMonthDay;
      }

      if (!inWindow) continue;

      // Notify the assigned sales user of the linked account
      const notifyUserId = contact.customer?.assignedUserId;
      if (!notifyUserId) continue;

      // Check if we already sent a reminder this year
      const existingReminder = await prisma.notification.findFirst({
        where: {
          userId: notifyUserId,
          type: "birthday_reminder",
          link: `/contacts/${contact.id}`,
          createdAt: {
            gte: new Date(today.getFullYear(), 0, 1),
          },
        },
      });
      if (existingReminder) continue;

      const daysUntilBirthday = (() => {
        const thisYearBirthday = new Date(today.getFullYear(), contact.dateOfBirth.getMonth(), contact.dateOfBirth.getDate());
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        return Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      })();

      const contactName = contact.name;
      const accountName = contact.customer?.name || "Unlinked";

      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: "🎂 Upcoming Birthday Reminder",
          message: `${contactName} (${accountName}) has a birthday in ${daysUntilBirthday} day(s).`,
          type: "birthday_reminder",
          link: `/contacts/${contact.id}`,
        },
      });
      results.birthdayRemindersSent++;
    }

    // ─── Job 4: PO Auto-Aging → OnHold ─────────────────────────────────
    // Move "New" or "UnderValidation" POs older than 1 day to "OnHold".
    // Sets onHoldAt, onHoldReason, and notifies the assigned user.
    const poCutoff = new Date();
    poCutoff.setDate(poCutoff.getDate() - 1);

    const stalePOs = await prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: { in: ["New", "UnderValidation"] },
        createdAt: { lt: poCutoff },
      },
      select: { id: true, poCode: true, assignedUserId: true, status: true, createdAt: true, dealId: true, companyId: true },
    });

    for (const po of stalePOs) {
      const ageDays = Math.floor((Date.now() - new Date(po.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const reason = `Auto-held: PO stale for ${ageDays} day(s) without progression (nightly batch)`;

      await prisma.$transaction(async (tx) => {
        // 1. Move PO to OnHold
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: "OnHold",
            onHoldAt: new Date(),
            onHoldReason: reason,
          },
        });

        // 2. Move the associated deal to OnHold (if it has one and it's not already closed)
        if (po.dealId) {
          const deal = await tx.deal.findUnique({
            where: { id: po.dealId },
            select: { status: true },
          });
          if (deal && !PIPELINE_CLOSED_STAGES.includes(deal.status) && deal.status !== "OnHold") {
            let systemUser = await tx.user.findFirst({ where: { email: "system@suki.com" } });
            if (!systemUser) {
              systemUser = await tx.user.findFirst({ where: { role: "Admin" } });
            }
            await transitionDealStatus(
              po.dealId,
              "OnHold",
              {
                actorId: systemUser?.id || "system",
                reason: `Auto-held: PO ${po.poCode} stale for ${ageDays} day(s)`,
                companyId: po.companyId || "",
              },
              tx
            );
          }
        }
      });

      if (po.assignedUserId) {
        await dispatchNotification({
          userId: po.assignedUserId,
          title: "PO Auto-OnHold",
          message: `PO ${po.poCode} has been automatically placed on hold. ${reason}`,
          type: "purchase_order",
          link: `/purchase-orders/${po.id}`,
        });
      }
      results.posAutoOnHold++;
    }

    return NextResponse.json({
      success: true,
      message: "Nightly batch completed",
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
