import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

const DEFAULT_ESCALATION_THRESHOLD = 15;
const DEFAULT_ESCALATION_ROLE = "SalesDirector";

async function getEscalationConfig(): Promise<{ threshold: number; role: string }> {
  const [thresholdConfig, roleConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_escalation_role" } }),
  ]);
  const threshold = thresholdConfig ? parseFloat(thresholdConfig.value) : DEFAULT_ESCALATION_THRESHOLD;
  const role = roleConfig?.value || DEFAULT_ESCALATION_ROLE;
  return { threshold: isNaN(threshold) ? DEFAULT_ESCALATION_THRESHOLD : threshold, role };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (existing.status !== "Draft") {
    return NextResponse.json({ success: false, message: "Only Draft quotations can request approval" }, { status: 400 });
  }

  // Find Sales Manager for approval (from same company)
  // If discount exceeds escalation threshold, route to escalation role instead
  const escalationConfig = await getEscalationConfig();
  const requiresEscalation = existing.discountPercent > escalationConfig.threshold;
  const approverRole = requiresEscalation ? escalationConfig.role : "SalesManager";

  let approverId = body.approverId;
  if (!approverId) {
    const manager = await prisma.user.findFirst({
      where: { role: approverRole, companyId: user.companyId, isActive: true },
      select: { id: true },
    });
    if (!manager) {
      return NextResponse.json({ success: false, message: `No ${approverRole} found to approve` }, { status: 400 });
    }
    approverId = manager.id;
  }

  // Check if there's already a pending approval
  const existingApproval = await prisma.quotationApproval.findFirst({
    where: { quotationId: id, status: "Pending" },
  });
  if (existingApproval) {
    return NextResponse.json({ success: false, message: "Approval already pending for this quotation" }, { status: 400 });
  }

  try {
    const approval = await prisma.$transaction(async (tx) => {
      const appr = await tx.quotationApproval.create({
        data: {
          quotationId: id,
          requestedById: user.id,
          approverId,
          status: "Pending",
          discountPercent: existing.discountPercent,
          notes: body.notes || null,
          requiredApproverRole: approverRole,
          revisionAuthorId: existing.createdById,
        },
      });

      // Notify approver
      await tx.notification.create({
        data: {
          userId: approverId,
          title: requiresEscalation ? "Escalation Approval Needed: Quotation" : "Approval Needed: Quotation",
          message: `Approval needed: Quotation ${existing.quotationCode} has ${existing.discountPercent}% discount${requiresEscalation ? " — escalated to " + approverRole : ""}`,
          type: "Approval",
          link: `/quotations/${id}`,
        },
      });

      return appr;
    });

    await logAudit(user.id, "Quotation", "RequestApproval", `Requested approval for quotation ${existing.quotationCode}`, {
      resourceId: id,
      newState: { approverId, discountPercent: existing.discountPercent },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: approval }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to request approval: ${error.message}` },
      { status: 500 }
    );
  }
}
