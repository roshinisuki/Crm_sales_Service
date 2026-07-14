import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEventAsync } from "@/lib/activity-event";

/**
 * POST /api/quotations/[id]/hold
 * Put a quotation on hold with a reason.
 * Only allowed from Sent or UnderReview status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || "Put on hold";

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, quotationCode: true, status: true, negotiationId: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Sent", "UnderReview"].includes(existing.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot put a ${existing.status} quotation on hold. Only Sent or UnderReview quotations can be held.` },
      { status: 400 }
    );
  }

  const previousStatus = existing.status;

  await prisma.quotation.update({
    where: { id },
    data: {
      status: "OnHold",
      holdReason: reason,
      holdAt: new Date(),
    },
  });

  await prisma.quotationStatusHistory.create({
    data: {
      quotationId: id,
      fromStatus: previousStatus,
      toStatus: "OnHold",
      changedById: user.id,
      notes: reason,
    },
  });

  await logEventAsync({
    entityType: "Quotation",
    entityId: id,
    type: "quotation_held",
    fromStatus: previousStatus,
    toStatus: "OnHold",
    actorId: user.id,
    metadata: { quotationCode: existing.quotationCode, reason },
  });

  await logAudit(user.id, "Quotation", "Hold", `Put quotation ${existing.quotationCode} on hold: ${reason}`, {
    resourceId: id,
    previousState: { status: previousStatus },
    newState: { status: "OnHold", reason },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, message: "Quotation put on hold" });
}

/**
 * DELETE /api/quotations/[id]/hold
 * Resume a quotation from OnHold back to its previous status.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, quotationCode: true, status: true, holdReason: true, negotiationId: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (existing.status !== "OnHold") {
    return NextResponse.json({ success: false, message: "Only OnHold quotations can be resumed" }, { status: 400 });
  }

  // Determine resume status: if negotiation exists → UnderReview, else → Sent
  const resumeStatus = existing.negotiationId ? "UnderReview" : "Sent";

  await prisma.quotation.update({
    where: { id },
    data: {
      status: resumeStatus,
      holdReason: null,
      holdAt: null,
    },
  });

  await prisma.quotationStatusHistory.create({
    data: {
      quotationId: id,
      fromStatus: "OnHold",
      toStatus: resumeStatus,
      changedById: user.id,
      notes: "Resumed from hold",
    },
  });

  await logEventAsync({
    entityType: "Quotation",
    entityId: id,
    type: "quotation_resumed",
    fromStatus: "OnHold",
    toStatus: resumeStatus,
    actorId: user.id,
    metadata: { quotationCode: existing.quotationCode },
  });

  await logAudit(user.id, "Quotation", "Resume", `Resumed quotation ${existing.quotationCode} from hold to ${resumeStatus}`, {
    resourceId: id,
    previousState: { status: "OnHold" },
    newState: { status: resumeStatus },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, message: `Quotation resumed to ${resumeStatus}` });
}
