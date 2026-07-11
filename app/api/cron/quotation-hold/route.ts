import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { transitionDealStatus } from "@/lib/dealService";
import { PIPELINE_CLOSED_STAGES } from "@/lib/module-status-config";

// GET /api/cron/quotation-hold
// Auto-move Sent quotations to OnHold if no response for 3 days, and escalate follow-ups
export async function GET() {
  try {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3); // 3 days threshold

    // Find quotations in Sent status that have not been updated for 3+ days
    const staleQuotations = await prisma.quotation.findMany({
      where: {
        status: "Sent",
        updatedAt: { lt: threshold },
        deletedAt: null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, status: true, dealName: true } },
      },
    });

    let updatedCount = 0;
    let dealsOnHold = 0;
    const notifications: Promise<void>[] = [];

    // Get system user for audit / history logging
    let systemUser = await prisma.user.findFirst({ where: { email: "system@suki.com" } });
    if (!systemUser) {
      systemUser = await prisma.user.findFirst({ where: { role: "Admin" } });
    }
    const changedById = systemUser?.id || undefined;

    for (const q of staleQuotations) {
      await prisma.$transaction(async (tx) => {
        // 1. Move quotation status to OnHold
        await tx.quotation.update({
          where: { id: q.id },
          data: { status: "OnHold" },
        });

        // 2. Log status history
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: q.id,
            fromStatus: "Sent",
            toStatus: "OnHold",
            changedById,
            notes: "Auto-moved to On Hold: no customer response for 3 days",
          },
        });

        // 3. Escalate pending follow-ups linked to this quotation or customer
        await tx.followUp.updateMany({
          where: {
            status: "Pending",
            companyId: q.companyId,
            OR: [
              { entityType: "quotation", entityId: q.id },
              { customerId: q.customerId },
            ],
          },
          data: {
            status: "Overdue",
            escalationLevel: 1,
          },
        });

        // 4. Move the associated deal to OnHold (if it has one and it's not already closed)
        if (q.dealId && q.deal && !PIPELINE_CLOSED_STAGES.includes(q.deal.status) && q.deal.status !== "OnHold") {
          await transitionDealStatus(
            q.dealId,
            "OnHold",
            {
              actorId: changedById || "system",
              reason: `Auto-held: quotation ${q.quotationCode} no customer response for 3 days`,
              companyId: q.companyId || "",
            },
            tx
          );
          dealsOnHold++;
        }
      });

      updatedCount++;

      // Log Audit Trail
      if (changedById) {
        await logAudit(
          changedById,
          "Quotation",
          "StatusChange",
          `Quotation ${q.quotationCode} auto-moved to OnHold (3 days inactivity)`,
          { resourceId: q.id, previousState: { status: "Sent" }, newState: { status: "OnHold" } }
        );
      }

      // Notify the assigned executive about hold & escalation
      const notifyUserId = q.assignedUserId || changedById;
      if (notifyUserId) {
        notifications.push(
          dispatchNotification({
            userId: notifyUserId,
            title: "Quotation Moved to On Hold",
            message: `Quotation ${q.quotationCode} was moved to On Hold and its follow-ups were escalated due to 3 days of customer inactivity.`,
            type: "Quotation",
            link: `/quotations/${q.id}`,
          }).then(() => undefined)
        );
      }
    }

    await Promise.all(notifications);

    return NextResponse.json({
      success: true,
      data: { updatedCount, dealsOnHold, checkedCount: staleQuotations.length },
    });
  } catch (error: any) {
    console.error("Quotation Hold Cron Error:", error);
    return NextResponse.json(
      { success: false, message: `Auto-hold failed: ${error.message}` },
      { status: 500 }
    );
  }
}
