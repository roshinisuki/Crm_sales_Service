import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { transitionDealStatus } from "@/lib/dealService";
import { logEvent } from "@/lib/activity-event";

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
      customer: { select: { id: true, name: true, customerCode: true, status: true, accountType: true, billingAddress: true, shippingAddress: true, city: true, gstNumber: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, status: true, opportunityCode: true } },
      items: true,
      rfq: { select: { id: true, expectedDeliveryDate: true, lineItems: { select: { requestedDeliveryDate: true } } } },
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

      // 2b. Close active negotiations
      // Bug #8 fix: set negotiation.finalAmount to the quotation's finalAmount (which was
      // already updated by applyNegotiationRevision) so the negotiation record reflects the
      // actual negotiated amount, not null.
      const activeNegotiations = await tx.negotiation.findMany({
        where: {
          quotationId: id,
          status: { in: ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (activeNegotiations.length > 0) {
        await tx.negotiation.updateMany({
          where: { id: { in: activeNegotiations.map(n => n.id) } },
          data: {
            status: "Closed-Success",
            outcome: "Won",
            closedAt: new Date(),
            finalAmount: existing.finalAmount,
          },
        });
      }

      // 3. Auto-create a linked Deal at DemoAccepted if none exists.
      //    The deal is later transitioned to Won when its linked PO is approved.
      let dealId = existing.dealId;
      if (!dealId) {
        const dealName = `${existing.customer?.name || "Customer"} — ${existing.quotationCode}`;
        const deal = await tx.deal.create({
          data: {
            dealName,
            customerId: existing.customerId,
            dealValue: existing.finalAmount,
            expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "DemoAccepted",
            probabilityPercent: 100,
            companyId: user.companyId,
            assignedUserId: existing.assignedUserId || user.id,
            notes: `Auto-created from Quotation ${existing.quotationCode} on acceptance`,
          },
        });

        await tx.dealStageHistory.create({
          data: {
            dealId: deal.id,
            fromStatus: null,
            toStatus: "DemoAccepted",
            changedById: user.id,
            outcomeNotes: `Auto-created from Quotation ${existing.quotationCode}`,
          },
        });

        await tx.quotation.update({
          where: { id: existing.id },
          data: { dealId: deal.id },
        });
        dealId = deal.id;
      }

      // 3a. Auto-create Purchase Order from the accepted quotation.
      // PO is created in "New" status — it gets approved via the Approval Center,
      // which then transitions the deal to Won.
      const existingPo = await tx.purchaseOrder.findFirst({
        where: { quotationId: id, deletedAt: null },
        select: { id: true, poCode: true },
      });
      let poCode = "";
      if (!existingPo) {
        // Generate sequential poCode
        let codeExists = true;
        let seqOffset = 0;
        while (codeExists) {
          const lastPO = await tx.purchaseOrder.findFirst({
            where: { companyId: user.companyId },
            orderBy: { poCode: "desc" },
            select: { poCode: true },
          });
          let poSeq = 1;
          if (lastPO?.poCode) {
            const match = lastPO.poCode.match(/PO-(\d+)/);
            if (match) poSeq = parseInt(match[1], 10) + 1;
          }
          poSeq += seqOffset;
          poCode = `PO-${String(poSeq).padStart(4, "0")}`;
          const dup = await tx.purchaseOrder.findFirst({
            where: { companyId: user.companyId, poCode },
            select: { id: true },
          });
          if (!dup) codeExists = false;
          else seqOffset++;
        }

        // Compute expected delivery date
        let computedExpectedDelivery: Date | null = null;
        if (existing.leadTimeDays && existing.leadTimeDays > 0) {
          const d = new Date();
          d.setDate(d.getDate() + existing.leadTimeDays);
          computedExpectedDelivery = d;
        } else if (existing.rfq?.lineItems?.length) {
          const deliveryDates = existing.rfq.lineItems
            .map((li) => li.requestedDeliveryDate)
            .filter(Boolean) as Date[];
          if (deliveryDates.length > 0) {
            computedExpectedDelivery = new Date(Math.min(...deliveryDates.map((d) => d.getTime())));
          }
        } else if (existing.rfq?.expectedDeliveryDate) {
          computedExpectedDelivery = existing.rfq.expectedDeliveryDate;
        }

        const shippingAddress = existing.customer?.shippingAddress || existing.customer?.billingAddress || null;

        // Map quotation items → PO items (prices already net of discount)
        const poItems = existing.items.map((it) => ({
          productId: it.productId || null,
          description: it.description || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice || it.quantity * it.unitPrice,
          notes: it.notes || null,
          discountPercent: it.discountPercent || 0,
          taxPercent: it.taxPercent || 18,
          lineTotal: it.lineTotal || it.totalPrice,
        }));

        const totalAmount = poItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
        const taxAmount = existing.items.reduce((sum, it) => {
          const lineNet = it.totalPrice || 0;
          return sum + lineNet * ((it.taxPercent || 18) / 100);
        }, 0);
        const finalAmount = totalAmount + taxAmount;

        // Find linked negotiation
        const negotiation = await tx.negotiation.findFirst({
          where: { quotationId: id, deletedAt: null },
          select: { id: true },
        });

        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            poCode,
            customerId: existing.customerId,
            contactId: existing.contactId || null,
            negotiationId: negotiation?.id || null,
            quotationId: existing.id,
            dealId: dealId || null,
            status: "New",
            poDate: new Date(),
            expectedDelivery: computedExpectedDelivery,
            totalAmount,
            discountPercent: existing.discountPercent || 0,
            taxAmount,
            finalAmount,
            quotationFinalAmount: existing.finalAmount,
            amountReconciled: Math.abs(finalAmount - (existing.finalAmount || 0)) < 0.01,
            paymentTerms: existing.paymentTerms || null,
            deliveryTerms: existing.deliveryTerms || null,
            shippingAddress,
            billingAddress: existing.customer?.billingAddress || null,
            notes: `Auto-created from Quotation ${existing.quotationCode} on acceptance`,
            assignedUserId: existing.assignedUserId || user.id,
            companyId: user.companyId,
            items: { create: poItems },
          },
        });

        await logEvent(tx, {
          entityType: "PurchaseOrder",
          entityId: purchaseOrder.id,
          rootEntityId: dealId || existing.id,
          type: "po_created",
          fromStatus: null,
          toStatus: "New",
          actorId: user.id,
          metadata: { poCode, quotationId: existing.id, quotationCode: existing.quotationCode, finalAmount, autoCreated: true },
        });
      }

      // 4. Customer status sync is handled by transitionDealStatus on Won
      // (sets to ActiveCustomer with AccountStatusHistory)
      // Only handle Prospect→Active if there's no linked deal (edge case)
      if (existing.customer && existing.customer.status === "Prospect" && !existing.dealId) {
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
            title: "Quotation Accepted",
            message: `Quotation ${existing.quotationCode} accepted by ${existing.customer?.name || "Unknown"} — ₹${existing.finalAmount.toFixed(2)}${poCode ? ` — PO ${poCode} auto-created` : ""}`,
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
            message: `New order from ${existing.customer?.name || "Unknown"} — Quotation ${existing.quotationCode} accepted — ₹${existing.finalAmount.toFixed(2)}${poCode ? ` — PO ${poCode} pending approval` : ""}`,
            type: "Order",
            link: poCode ? `/purchase-orders` : `/quotations/${id}`,
          },
        });
      }

      await logEvent(tx, {
        entityType: "Quotation",
        entityId: id,
        type: "quotation_accepted",
        fromStatus: existing.status,
        toStatus: "Accepted",
        actorId: user.id,
        metadata: { quotationCode: existing.quotationCode, finalAmount: existing.finalAmount },
      });

      return { quotationId: id, poCode };
      },
      { timeout: 30000, maxWait: 35000 }
    );

    await logAudit(user.id, "Quotation", "Accept", `Accepted quotation ${existing.quotationCode} — PO ${result.poCode} auto-created`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: "Accepted", dealStage: "DemoAccepted", poCode: result.poCode, rfqStatus: "Closed" },
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
