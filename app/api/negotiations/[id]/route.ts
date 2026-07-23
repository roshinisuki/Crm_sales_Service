import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEvent, logEventAsync } from "@/lib/activity-event";
import { cascadeNegotiationSuccess, cascadeNegotiationFailure } from "@/lib/negotiation-cascade";

const VALID_STATUSES = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Closed-Success", "Closed-Failure"];

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]");
  if (guard) return guard;

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
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]");
  if (guard) return guard;
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
    if (existing.status === "PendingApproval" && ["PriceRevision", "CommercialDiscussion"].includes(body.status)) {
      return NextResponse.json({ success: false, message: "Cannot change status while approval is pending. Resolve the approval in the Approval Center first." }, { status: 400 });
    }
    // Enforce sequential status transitions server-side (mirrors UI STATUS_FLOW)
    const SERVER_STATUS_FLOW: Record<string, string[]> = {
      Active: ["PriceRevision", "Closed-Success", "Closed-Failure"],
      PriceRevision: ["CommercialDiscussion"],
      CommercialDiscussion: ["PendingApproval", "PriceRevision", "Closed-Success", "Closed-Failure"],
      PendingApproval: ["Active", "Closed-Success", "Closed-Failure"],
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
      // Bug #9 fix: use the quotation's finalAmount (authoritative, set by applyNegotiationRevision)
      // instead of negotiation.revisedAmount (the proposedAmount which may differ due to per-item
      // rounding). Fall back to revisedAmount/initialAmount only if quotation has no finalAmount.
      const linkedQuote = existing.quotationId ? await prisma.quotation.findUnique({
        where: { id: existing.quotationId },
        select: { finalAmount: true, totalAmount: true },
      }) : null;
      const finalAmt = body.finalAmount !== undefined
        ? parseFloat(body.finalAmount)
        : (linkedQuote?.finalAmount || linkedQuote?.totalAmount || (existing.revisedAmount !== null ? existing.revisedAmount : existing.initialAmount));
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
      await cascadeNegotiationSuccess({
        quotationId: existing.quotationId,
        dealId: existing.dealId,
        customerId: existing.customerId,
        negotiationCode: existing.negotiationCode,
        negotiationId: id,
        actorId: user.id,
        companyId: user.companyId!,
        finalAmount: finalAmt,
        fromNegotiationStatus: existing.status,
        tx,
      });
    }

    // 2. Cascading logic for Closed-Failure
    if (body.status === "Closed-Failure" && body.status !== existing.status) {
      await cascadeNegotiationFailure({
        quotationId: existing.quotationId,
        dealId: existing.dealId,
        customerId: existing.customerId,
        negotiationCode: existing.negotiationCode,
        negotiationId: id,
        actorId: user.id,
        companyId: user.companyId!,
        rejectionReason: body.rejectionReasonText,
        fromNegotiationStatus: existing.status,
        tx,
      });
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

    await logEventAsync({
      entityType: "Negotiation",
      entityId: id,
      rootEntityId: existing.quotationId || undefined,
      type: "negotiation_status_changed",
      fromStatus: existing.status,
      toStatus: body.status,
      actorId: user.id,
      metadata: { negotiationCode: existing.negotiationCode },
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
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]");
  if (guard) return guard;
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
