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

  return NextResponse.json({ success: true, data: negotiation });
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
    if (existing.status === "PendingApproval" && ["Closed-Success", "Closed-Failure", "Active", "PriceRevision", "CommercialDiscussion"].includes(body.status)) {
      return NextResponse.json({ success: false, message: "Cannot change status while approval is pending. Resolve the approval in the Approval Center first." }, { status: 400 });
    }
    // Enforce sequential status transitions server-side (mirrors UI STATUS_FLOW)
    const SERVER_STATUS_FLOW: Record<string, string[]> = {
      Active: ["PriceRevision", "Closed-Success", "Closed-Failure"],
      PriceRevision: ["CommercialDiscussion", "Closed-Success", "Closed-Failure"],
      CommercialDiscussion: ["PendingApproval", "Closed-Success", "Closed-Failure"],
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
  if (body.status !== undefined && body.status !== existing.status) {
    updateData.status = body.status;
    const now = new Date();
    if (body.status === "Closed-Success") {
      updateData.outcome = "Won";
      updateData.closedAt = now;
      if (body.finalAmount !== undefined) updateData.finalAmount = parseFloat(body.finalAmount);
    }
    if (body.status === "Closed-Failure") {
      updateData.outcome = "Lost";
      updateData.closedAt = now;
    }
  }

  const negotiation = await prisma.negotiation.update({
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
