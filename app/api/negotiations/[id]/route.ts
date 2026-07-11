import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { transitionDealStatus } from "@/lib/dealService";

const VALID_STATUSES = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Closed-Success", "Closed-Failure"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true, status: true, rfqId: true, rfq: { select: { id: true, rfqCode: true } } } },
      deal: { select: { id: true, dealName: true, status: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      revisions: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { revisionNumber: "asc" },
      },
    },
  });

  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // B.4: Fetch discount threshold + escalation config from SystemConfig so the UI matches the backend
  const [discountConfig, escalationThresholdConfig, escalationRoleConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_discount_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_role" } }),
  ]);
  const discountThreshold = discountConfig ? parseFloat(discountConfig.value) : 5;
  const escalationThreshold = escalationThresholdConfig ? parseFloat(escalationThresholdConfig.value) : 15;
  const escalationRole = escalationRoleConfig?.value || "SalesDirector";

  return NextResponse.json({
    success: true,
    data: negotiation,
    config: { discountThreshold, escalationThreshold, escalationRole },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // B16: SalesRep can only modify negotiations assigned to them
  if (user.role === "SalesRep" && existing.assignedUserId && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "You can only modify negotiations assigned to you" }, { status: 403 });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
  }

  // B2: Block terminal status transitions when approval is pending
  if (body.status && body.status !== existing.status) {
    if (existing.status === "PendingApproval" && ["Active", "PriceRevision", "CommercialDiscussion"].includes(body.status)) {
      return NextResponse.json({ success: false, message: "Cannot change status while approval is pending. Resolve the approval in the Approval Center first." }, { status: 400 });
    }
    // Enforce sequential status transitions server-side (mirrors UI STATUS_FLOW)
    const SERVER_STATUS_FLOW: Record<string, string[]> = {
      Active: ["PriceRevision", "Closed-Success", "Closed-Failure"],
      PriceRevision: ["CommercialDiscussion", "Closed-Success", "Closed-Failure"],
      CommercialDiscussion: ["PendingApproval", "PriceRevision", "Closed-Success", "Closed-Failure"],
      PendingApproval: ["Closed-Success", "Closed-Failure"],
      "Closed-Success": [],
      "Closed-Failure": [],
    };
    const allowed = SERVER_STATUS_FLOW[existing.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ success: false, message: `Cannot transition from ${existing.status} to ${body.status}. Allowed: ${allowed.join(", ") || "none"}` }, { status: 400 });
    }
  }

  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.quotationId !== undefined) updateData.quotationId = body.quotationId || null;
  if (body.dealId !== undefined) updateData.dealId = body.dealId || null;
  if (body.initialAmount !== undefined) updateData.initialAmount = parseFloat(body.initialAmount);
  if (body.revisedAmount !== undefined) updateData.revisedAmount = body.revisedAmount ? parseFloat(body.revisedAmount) : null;
  if (body.customerDemands !== undefined) updateData.customerDemands = body.customerDemands || null;
  if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes || null;
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.discountRequested !== undefined) updateData.discountRequested = parseFloat(body.discountRequested) || 0;
  if (body.discountApproved !== undefined) updateData.discountApproved = body.discountApproved ? parseFloat(body.discountApproved) : null;

  // Status-specific field updates
  const now = new Date();
  if (body.status !== undefined && body.status !== existing.status) {
    updateData.status = body.status;
    if (body.status === "Closed-Success") {
      updateData.outcome = "Won";
      updateData.closedAt = now;
      const finalAmt = body.finalAmount !== undefined ? parseFloat(body.finalAmount) : (existing.revisedAmount !== null ? existing.revisedAmount : existing.initialAmount);
      updateData.finalAmount = finalAmt;
    }
    if (body.status === "Closed-Failure") {
      updateData.outcome = "Lost";
      updateData.closedAt = now;
    }
  }

  const negotiation = await prisma.$transaction(async (tx) => {
    // 1. Cascading logic for Closed-Success
    if (body.status === "Closed-Success" && body.status !== existing.status) {
      const finalAmt = updateData.finalAmount;
      if (existing.quotationId) {
        // Update quotation to Accepted
        await tx.quotation.update({
          where: { id: existing.quotationId },
          data: {
            finalAmount: finalAmt,
            status: "Accepted",
            acceptedAt: now
          }
        });

        // Insert quotation_status_history
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: existing.quotationId,
            fromStatus: existing.status === "PendingApproval" ? "UnderReview" : existing.status,
            toStatus: "Accepted",
            changedById: user.id,
            notes: "Quotation accepted via negotiation success",
          }
        });

        // Close RFQ if linked
        const quote = await tx.quotation.findUnique({
          where: { id: existing.quotationId },
          select: { rfqId: true, quotationCode: true }
        });
        if (quote?.rfqId) {
          const rfq = await tx.rFQ.findUnique({
            where: { id: quote.rfqId },
            select: { id: true, status: true }
          });
          if (rfq && rfq.status !== "Closed") {
            await tx.rFQ.update({
              where: { id: rfq.id },
              data: { status: "Closed" }
            });
            await tx.rFQStatusHistory.create({
              data: {
                rfqId: rfq.id,
                fromStatus: rfq.status,
                toStatus: "Closed",
                changedById: user.id,
                notes: `RFQ closed on negotiation success for quotation ${quote.quotationCode}`,
              }
            });
          }
        }
      }

      // Transition Deal to Won
      if (existing.dealId) {
        await transitionDealStatus(existing.dealId, "Won", {
          actorId: user.id,
          reason: `Negotiation ${existing.negotiationCode} closed as success`,
          companyId: user.companyId!,
        }, tx);
      } else {
        // Prospect -> Active customer sync if no linked deal
        const customer = await tx.customer.findUnique({
          where: { id: existing.customerId },
          select: { id: true, status: true }
        });
        if (customer && customer.status === "Prospect") {
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
              notes: `Auto-activated on negotiation success (${existing.negotiationCode})`,
            }
          });
        }
      }

      // Cancel pending follow-ups for this customer
      await tx.followUp.updateMany({
        where: {
          customerId: existing.customerId,
          status: { in: ["Pending", "Overdue"] },
        },
        data: { status: "Cancelled" },
      });

      // Send notifications to Sales Manager
      const managers = await tx.user.findMany({
        where: { role: "SalesManager", companyId: user.companyId, isActive: true },
        select: { id: true }
      });
      for (const mgr of managers) {
        await tx.notification.create({
          data: {
            userId: mgr.id,
            title: "Deal Won!",
            message: `Deal Won: Customer negotiation ${existing.negotiationCode} closed as success — ₹${finalAmt.toFixed(2)}`,
            type: "Deal",
            link: `/negotiations/${id}`,
          }
        });
      }

      // Send notification to Quotation Creator
      const quoteCreator = existing.quotationId ? await tx.quotation.findUnique({ where: { id: existing.quotationId }, select: { createdById: true } }) : null;
      if (quoteCreator) {
        await tx.notification.create({
          data: {
            userId: quoteCreator.createdById,
            title: "Negotiation Won! 🎉",
            message: `Negotiation ${existing.negotiationCode} has been won`,
            type: "Quotation",
            link: `/negotiations/${id}`,
          }
        });
      }

      // Send notification to Admin/CostingEngineer — New Order
      const financeUsers = await tx.user.findMany({
        where: { role: { in: ["Admin", "CostingEngineer"] }, companyId: user.companyId, isActive: true },
        select: { id: true }
      });
      for (const fin of financeUsers) {
        await tx.notification.create({
          data: {
            userId: fin.id,
            title: "New Order",
            message: `New order via negotiation success ${existing.negotiationCode} — ₹${finalAmt.toFixed(2)}`,
            type: "Order",
            link: `/negotiations/${id}`,
          }
        });
      }
    }

    // 2. Cascading logic for Closed-Failure
    if (body.status === "Closed-Failure" && body.status !== existing.status) {
      if (existing.quotationId) {
        // Update quotation to Rejected
        await tx.quotation.update({
          where: { id: existing.quotationId },
          data: {
            status: "Rejected",
            rejectedAt: now,
            rejectionReason: body.rejectionReasonText || "Negotiation closed as failure"
          }
        });

        // Insert quotation_status_history
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: existing.quotationId,
            fromStatus: existing.status === "PendingApproval" ? "UnderReview" : existing.status,
            toStatus: "Rejected",
            changedById: user.id,
            notes: body.rejectionReasonText || "Negotiation closed as failure",
          }
        });
      }

      // Transition Deal to Lost
      if (existing.dealId) {
        await transitionDealStatus(existing.dealId, "Lost", {
          actorId: user.id,
          reason: body.rejectionReasonText || `Negotiation ${existing.negotiationCode} closed as failure`,
          companyId: user.companyId!,
        }, tx);
      }
    }

    // 3. Update negotiation record
    return await tx.negotiation.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
        contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
        quotation: { select: { id: true, quotationCode: true, finalAmount: true, status: true, rfqId: true, rfq: { select: { id: true, rfqCode: true } } } },
        deal: { select: { id: true, dealName: true, status: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        revisions: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { revisionNumber: "asc" },
        },
      },
    });
  });

  if (body.status && body.status !== existing.status) {
    await logAudit(user.id, "Negotiation", "StatusChange", `Negotiation ${existing.negotiationCode} status: ${existing.status} → ${body.status}`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: body.status },
      context: extractAuditContext(request),
    });


  } else {
    await logAudit(user.id, "Negotiation", "Update", `Updated negotiation ${existing.negotiationCode}`, {
      resourceId: id,
      context: extractAuditContext(request),
    });
  }

  return NextResponse.json({ success: true, data: negotiation });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  await prisma.negotiation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit(user.id, "Negotiation", "Delete", `Deleted negotiation ${existing.negotiationCode}`, {
    resourceId: id,
    previousState: { negotiationCode: existing.negotiationCode, status: existing.status },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, message: "Negotiation deleted" });
}
