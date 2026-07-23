import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

const VALID_STATUSES = ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.SAMPLE_MANAGEMENT, "GET /api/samples/[id]");
  if (guard) return guard;

  const { id } = await params;

  const sample = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
      product: { select: { id: true, name: true, productCode: true, unit: true, basePrice: true, productType: true } },
      rfq: { select: { id: true, rfqCode: true, status: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
    },
  });

  if (!sample) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: sample });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.SAMPLE_MANAGEMENT, "PUT /api/samples/[id]");
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  // B16: SalesRep can only modify samples assigned to them
  if (user.role === "SalesRep" && existing.assignedUserId && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "You can only modify samples assigned to you" }, { status: 403 });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
  }

  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.productId !== undefined) updateData.productId = body.productId;
  if (body.rfqId !== undefined) updateData.rfqId = body.rfqId || null;
  if (body.opportunityId !== undefined) updateData.opportunityId = body.opportunityId || null;
  if (body.quantity !== undefined) updateData.quantity = body.quantity ? parseFloat(body.quantity) : 1;
  if (body.specifications !== undefined) updateData.specifications = body.specifications || null;
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.trackingNumber !== undefined) updateData.trackingNumber = body.trackingNumber || null;
  if (body.customerFeedback !== undefined) updateData.customerFeedback = body.customerFeedback || null;
  if (body.revisionNotes !== undefined) updateData.revisionNotes = body.revisionNotes || null;

  // Status-specific field updates
  if (body.status !== undefined && body.status !== existing.status) {
    updateData.status = body.status;
    const now = new Date();
    if (body.status === "SentToCustomer") updateData.sentDate = now;
    if (body.status === "Approved") {
      updateData.approvedDate = now;
      updateData.approvedById = user.id;
    }
    if (body.status === "Rejected") {
      updateData.rejectedDate = now;
      updateData.rejectedById = user.id;
    }
    if (body.status === "Revision") updateData.revisionDate = now;
  }

  let updatedSample;
  try {
    updatedSample = await prisma.$transaction(async (tx) => {
      const sample = await tx.sampleRequest.update({
        where: { id },
        data: updateData,
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          contact: { select: { id: true, name: true, email: true, phone: true } },
          product: { select: { id: true, name: true, productCode: true, unit: true } },
          rfq: { select: { id: true, rfqCode: true } },
          assignedUser: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          rejectedBy: { select: { id: true, name: true } },
        },
      });

      if (body.status === "Approved" && existing.opportunityId) {
        // Upsert opportunity detail
        const oppDetail = await tx.opportunityDetail.findUnique({ where: { dealId: existing.opportunityId } });
        if (oppDetail) {
          await tx.opportunityDetail.update({
            where: { dealId: existing.opportunityId },
            data: { sampleStatus: "approved" },
          });
        } else {
          await tx.opportunityDetail.create({
            data: { dealId: existing.opportunityId, sampleStatus: "approved" },
          });
        }

        const deal = await tx.deal.findUnique({ where: { id: existing.opportunityId } });
        if (deal && deal.status !== "RequirementGathering") {
          await tx.deal.update({
            where: { id: deal.id },
            data: { status: "RequirementGathering", probabilityPercent: 35, stageEnteredAt: new Date() },
          });
          
          await tx.dealStageHistory.create({
            data: {
              dealId: deal.id,
              fromStatus: deal.status,
              toStatus: "RequirementGathering",
              changedById: user.id,
              durationInPreviousStage: 0,
              outcomeNotes: "Sample approved — auto-advanced to Requirement Gathering",
            },
          });

          // Create auto-follow-up
          const followUpDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
          await tx.followUp.create({
            data: {
              customerId: deal.customerId,
              assignedUserId: deal.assignedUserId || user.id,
              nextMeetingDate: followUpDate,
              dueDate: followUpDate,
              remarks: "Schedule discovery call",
              status: "Pending",
              priority: "High",
              sourceType: "STAGE_CHANGE",
              sourceId: deal.id,
              autoCreated: true,
              companyId: user.companyId,
              stageAtCreation: "Deal",
            }
          });
        }
      }

      if (body.status === "Rejected" && existing.opportunityId) {
        // Upsert opportunity detail
        const oppDetail = await tx.opportunityDetail.findUnique({ where: { dealId: existing.opportunityId } });
        if (oppDetail) {
          await tx.opportunityDetail.update({
            where: { dealId: existing.opportunityId },
            data: { sampleStatus: "rejected" },
          });
        } else {
          await tx.opportunityDetail.create({
            data: { dealId: existing.opportunityId, sampleStatus: "rejected" },
          });
        }

        const deal = await tx.deal.findUnique({ where: { id: existing.opportunityId } });
        if (deal && deal.status !== "Rejected") {
          await tx.deal.update({
            where: { id: deal.id },
            data: { status: "Rejected", stageEnteredAt: new Date(), rejectedReason: "Sample rejected" },
          });
          
          await tx.dealStageHistory.create({
            data: {
              dealId: deal.id,
              fromStatus: deal.status,
              toStatus: "Rejected",
              changedById: user.id,
              durationInPreviousStage: 0,
              outcomeNotes: "Sample rejected",
            },
          });
        }
      }

      return sample;
    });
  } catch (error) {
    console.error("Sample update transaction failed:", error);
    return NextResponse.json({ success: false, message: "Failed to update sample and linked records" }, { status: 500 });
  }

  // Audit log
  if (body.status !== undefined && body.status !== existing.status) {
    const { logAudit, extractAuditContext } = await import("@/lib/audit");
    await logAudit(
      user.id,
      "SampleRequest",
      "StatusChange",
      `Sample ${existing.sampleCode || id} status changed to ${body.status}`,
      {
        resourceId: id,
        previousState: { status: existing.status },
        newState: { status: body.status },
        context: extractAuditContext(request),
        severity: "INFO",
      }
    );
  }

  return NextResponse.json({ success: true, data: updatedSample });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.SAMPLE_MANAGEMENT, "DELETE /api/samples/[id]");
  if (guard) return guard;

  const { id } = await params;

  const existing = await prisma.sampleRequest.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Sample not found" }, { status: 404 });

  // B16: SalesRep can only delete samples assigned to them
  if (user.role === "SalesRep" && existing.assignedUserId && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "You can only delete samples assigned to you" }, { status: 403 });
  }

  await prisma.sampleRequest.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Sample deleted" });
}
