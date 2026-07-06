import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";

// GET /api/cron/rfq-autoclose
// Auto-close RFQs that have been in QuotationCreated status for 30+ days
// with no customer response (all linked quotations in Sent/Expired status, none Accepted)
export async function GET() {
  try {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);

    // Find RFQs in QuotationCreated status, updated >30 days ago
    const staleRfqs = await prisma.rFQ.findMany({
      where: {
        status: "QuotationCreated",
        updatedAt: { lt: threshold },
        deletedAt: null,
      },
      include: {
        quotations: {
          where: { deletedAt: null },
          select: { id: true, status: true, quotationCode: true },
        },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    let closedCount = 0;
    const notifications: Promise<void>[] = [];

    for (const rfq of staleRfqs) {
      // Only auto-close if no quotation is Accepted or Draft
      const hasActiveQuotation = rfq.quotations.some(
        (q) => q.status === "Accepted" || q.status === "Draft"
      );
      if (hasActiveQuotation) continue;

      await prisma.$transaction(async (tx) => {
        await tx.rFQ.update({
          where: { id: rfq.id },
          data: { status: "Closed" },
        });

        await tx.rFQStatusHistory.create({
          data: {
            rfqId: rfq.id,
            fromStatus: "QuotationCreated",
            toStatus: "Closed",
            notes: "Auto-closed: no customer response for 30 days post Quotation Created",
          },
        });
      });

      closedCount++;

      if (rfq.assignedUserId) {
        notifications.push(
          dispatchNotification({
            userId: rfq.assignedUserId,
            title: "RFQ Auto-Closed",
            message: `RFQ ${rfq.rfqCode} was auto-closed — no customer response for 30 days.`,
            type: "rfq",
            link: `/rfq/${rfq.id}`,
          }).then(() => undefined)
        );
      }
    }

    await Promise.all(notifications);

    return NextResponse.json({
      success: true,
      data: { closedCount, checkedCount: staleRfqs.length },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Auto-close failed: ${error.message}` },
      { status: 500 }
    );
  }
}
