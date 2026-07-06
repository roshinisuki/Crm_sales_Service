import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, status: true, accountType: true } },
      deal: { select: { id: true, dealName: true, status: true, opportunityCode: true } },
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Sent", "UnderReview"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Sent or UnderReview quotations can be accepted" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
      // 1. Update quotation status
      await tx.quotation.update({
        where: { id },
        data: { status: "Accepted", acceptedAt: new Date() },
      });

      // 2. Insert quotation_status_history
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: "Accepted",
          changedById: user.id,
          notes: "Quotation accepted by customer",
        },
      });

      // 3. If opportunity_id: update opportunity status to Won
      if (existing.dealId) {
        const deal = await tx.deal.findUnique({
          where: { id: existing.dealId },
          select: { id: true, status: true, dealName: true },
        });

        if (deal && deal.status !== "Won") {
          await tx.deal.update({
            where: { id: deal.id },
            data: { status: "Won" },
          });

          await tx.dealStageHistory.create({
            data: {
              dealId: deal.id,
              fromStatus: deal.status,
              toStatus: "Won",
              changedById: user.id,
              outcomeNotes: `Won via quotation ${existing.quotationCode} acceptance`,
            },
          });
        }
      }

      // 4. If account is Prospect: activate it
      if (existing.customer && existing.customer.status === "Prospect") {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { status: "Active", accountType: "Customer" },
        });

        await tx.accountStatusHistory.create({
          data: {
            customerId: existing.customerId,
            fromStatus: "Prospect",
            toStatus: "Active",
            changedById: user.id,
            notes: `Auto-activated on quotation accept (${existing.quotationCode})`,
          },
        });
      }

      // 5. If rfq_id: close the RFQ
      if (existing.rfqId) {
        const rfq = await tx.rFQ.findUnique({
          where: { id: existing.rfqId },
          select: { id: true, status: true },
        });

        if (rfq && rfq.status !== "Closed") {
          await tx.rFQ.update({
            where: { id: rfq.id },
            data: { status: "Closed" },
          });

          await tx.rFQStatusHistory.create({
            data: {
              rfqId: rfq.id,
              fromStatus: rfq.status,
              toStatus: "Closed",
              changedById: user.id,
              notes: `RFQ closed on quotation ${existing.quotationCode} acceptance`,
            },
          });
        }
      }

      // 6. Cancel pending follow-ups for this customer
      if (existing.dealId) {
        await tx.followUp.updateMany({
          where: {
            customerId: existing.customerId,
            status: { in: ["Pending", "Overdue"] },
          },
          data: { status: "Cancelled" },
        });
      }

      // 7. Notification to Sales Manager
      const managers = await tx.user.findMany({
        where: { role: "SalesManager", companyId: user.companyId, isActive: true },
        select: { id: true },
      });

      for (const mgr of managers) {
        await tx.notification.create({
          data: {
            userId: mgr.id,
            title: "Deal Won!",
            message: `Deal Won: ${existing.customer?.name || "Unknown"} — ${existing.quotationCode} — ₹${existing.finalAmount.toFixed(2)}`,
            type: "Deal",
            link: `/quotations/${id}`,
          },
        });
      }

      // 8. Notification to creator (congratulations)
      await tx.notification.create({
        data: {
          userId: existing.createdById,
          title: "Quotation Accepted! 🎉",
          message: `Quotation ${existing.quotationCode} has been accepted by ${existing.customer?.name || "customer"}`,
          type: "Quotation",
          link: `/quotations/${id}`,
        },
      });

      // 9. Notification to Admin/CostingEngineer — New Order
      const financeUsers = await tx.user.findMany({
        where: { role: { in: ["Admin", "CostingEngineer"] }, companyId: user.companyId, isActive: true },
        select: { id: true },
      });
      for (const fin of financeUsers) {
        await tx.notification.create({
          data: {
            userId: fin.id,
            title: "New Order",
            message: `New order from ${existing.customer?.name || "Unknown"} — Quotation ${existing.quotationCode} accepted — ₹${existing.finalAmount.toFixed(2)}`,
            type: "Order",
            link: `/quotations/${id}`,
          },
        });
      }

      return { quotationId: id };
      },
      { timeout: 30000, maxWait: 35000 }
    );

    await logAudit(user.id, "Quotation", "Accept", `Accepted quotation ${existing.quotationCode} — cascading updates completed`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: "Accepted", dealStage: "Won", accountStatus: "Active", rfqStatus: "Closed" },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: { id: result.quotationId, status: "Accepted" } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to accept quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
