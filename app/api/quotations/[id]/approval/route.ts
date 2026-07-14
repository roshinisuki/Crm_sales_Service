import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { applyNegotiationRevision, rejectNegotiationRevision } from "@/lib/negotiation-revision";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["SalesManager", "Admin", "SuperAdmin"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Only Sales Managers and Admins can approve quotations" }, { status: 403 });
  }

  // SuperAdmin must use support mode to access client operational data
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.decision || !["Approved", "Rejected"].includes(body.decision)) {
    return NextResponse.json({ success: false, message: "Decision must be 'Approved' or 'Rejected'" }, { status: 400 });
  }

  // Find the latest pending approval
  const approval = await prisma.quotationApproval.findFirst({
    where: { quotationId: id, status: "Pending" },
    orderBy: { createdAt: "desc" },
  });
  if (!approval) {
    return NextResponse.json({ success: false, message: "No pending approval found" }, { status: 404 });
  }

  // Self-approval prevention: the user who authored the price revision cannot approve it
  // Exception: Admin can self-approve to bypass the approval workflow
  if (approval.revisionAuthorId && approval.revisionAuthorId === user.id && user.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: "You cannot approve a quotation revision that you authored yourself. This must be approved by a different approver." },
      { status: 403 }
    );
  }

  // Escalation role check: if requiredApproverRole is set, verify the approver's role matches
  if (approval.requiredApproverRole && user.role !== approval.requiredApproverRole && user.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: `This quotation revision requires approval from a ${approval.requiredApproverRole}. Your role (${user.role}) is not authorized to approve this revision.` },
      { status: 403 }
    );
  }

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { quotationCode: true, createdById: true, negotiationId: true, revisionNumber: true, parentQuotationId: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.quotationApproval.update({
        where: { id: approval.id },
        data: {
          status: body.decision,
          decidedAt: new Date(),
          notes: body.notes || approval.notes,
        },
      });

      // Update quotation status based on approval decision
      const newQuoteStatus = body.decision === "Approved" ? "Approved" : "Rejected";
      await tx.quotation.update({
        where: { id },
        data: { status: newQuoteStatus },
      });

      // Sync linked negotiation status if this quotation is linked to a negotiation
      if (existing.negotiationId) {
        const pendingRevision = await tx.negotiationRevision.findFirst({
          where: { negotiationId: existing.negotiationId, status: "Pending" },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        });
        if (pendingRevision) {
          if (body.decision === "Approved") {
            // Apply the revision via the single source of truth function
            await applyNegotiationRevision({
              negotiationId: existing.negotiationId,
              revisionId: pendingRevision.id,
              actorId: user.id,
              tx,
            });
          } else {
            // Reject: revert negotiation to Active
            await rejectNegotiationRevision({
              negotiationId: existing.negotiationId,
              revisionId: pendingRevision.id,
              actorId: user.id,
              tx,
              revertStatus: "Active",
            });
          }
        }
      }

      // Notify creator
      await tx.notification.create({
        data: {
          userId: existing.createdById,
          title: body.decision === "Approved" ? "Quotation Approved" : "Quotation Approval Rejected",
          message:
            body.decision === "Approved"
              ? `Quotation ${existing.quotationCode} (R${existing.revisionNumber}) approved — you may now send`
              : `Quotation approval rejected: ${body.notes || "No notes provided"}`,
          type: "Approval",
          link: `/quotations/${id}`,
        },
      });

      return updated;
    });

    await logAudit(user.id, "Quotation", "ApprovalDecision", `${body.decision} quotation ${existing.quotationCode}`, {
      resourceId: id,
      newState: { approvalId: approval.id, decision: body.decision },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to process approval: ${error.message}` },
      { status: 500 }
    );
  }
}
