import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// Manually request approval for a negotiation — creates a real ApprovalHistory entry
// so it appears in the Approval Center and can be approved/rejected there.
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]/request-approval");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // Allow requesting approval from CommercialDiscussion or PriceRevision
  if (!["CommercialDiscussion", "PriceRevision"].includes(negotiation.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot request approval from status "${negotiation.status}". Allowed: CommercialDiscussion, PriceRevision.` },
      { status: 400 }
    );
  }

  // Use the latest revision's discount if available, otherwise use the negotiation's discountRequested
  const latestRevision = negotiation.revisions[0];
  const discountPercent = latestRevision?.discountPercent || negotiation.discountRequested || 0;
  const remarks = body.reason || body.remarks || latestRevision?.reason || null;

  const result = await prisma.$transaction(async (tx) => {
    // Transition negotiation to PendingApproval
    const updated = await tx.negotiation.update({
      where: { id },
      data: {
        status: "PendingApproval",
        ...(discountPercent ? { discountRequested: discountPercent } : {}),
      },
    });

    // Update the latest pending revision's submittedAgainstRound for concurrency guard
    if (latestRevision && latestRevision.status === "Pending") {
      await tx.negotiationRevision.update({
        where: { id: latestRevision.id },
        data: { submittedAgainstRound: negotiation.currentRound },
      });
    }

    // Create ApprovalHistory entry so it appears in the Approval Center
    const approval = await tx.approvalHistory.create({
      data: {
        approvalType: "Negotiation",
        entityType: "Negotiation",
        entityId: id,
        status: "Pending",
        discountPercent: discountPercent || 0,
        remarks,
        requestedById: user.id,
        previousStatus: negotiation.status,
        companyId: user.companyId,
      },
    });

    return { updated, approval };
  });

  await logAudit(user.id, "Negotiation", "RequestApproval", `Manually requested approval for negotiation ${negotiation.negotiationCode}`, {
    resourceId: id,
    previousState: { status: negotiation.status },
    newState: { status: "PendingApproval" },
    context: extractAuditContext(request),
  });

  // Notify approvers (SalesManager / Admin)
  const approvers = await prisma.user.findMany({
    where: { role: { in: ["SalesManager", "Admin"] }, companyId: user.companyId },
    select: { id: true },
  });
  for (const approver of approvers) {
    await dispatchNotification({
      userId: approver.id,
      title: "Negotiation Approval Requested",
      message: `Negotiation ${negotiation.negotiationCode} requires approval${discountPercent ? ` (discount ${discountPercent}%)` : ""}.`,
      type: "approval",
      link: `/negotiations/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: result.updated,
    message: "Approval requested — it will appear in the Approval Center.",
  }, { status: 201 });
}
