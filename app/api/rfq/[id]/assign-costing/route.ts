import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";
import { logAudit, extractAuditContext } from "@/lib/audit";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/assign-costing");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (!body.assigned_costing_owner) {
    return NextResponse.json({ success: false, message: "Costing owner is required" }, { status: 400 });
  }

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { _count: { select: { lineItems: true } } },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Validate: rfq has at least 1 line item
  if (rfq._count.lineItems === 0) {
    return NextResponse.json(
      { success: false, message: "Cannot assign costing — RFQ must have at least 1 line item" },
      { status: 400 }
    );
  }

  // Validate: assigned user exists and is active
  const costingUser = await prisma.user.findFirst({
    where: { id: body.assigned_costing_owner, isActive: true, deletedAt: null },
  });
  if (!costingUser) {
    return NextResponse.json({ success: false, message: "Assigned costing owner not found or inactive" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.rFQ.update({
      where: { id },
      data: {
        costingOwnerId: body.assigned_costing_owner,
        status: "CostingPending",
      },
    });

    await tx.rFQStatusHistory.create({
      data: {
        rfqId: id,
        fromStatus: rfq.status,
        toStatus: "CostingPending",
        changedById: user.id,
        notes: `Costing assigned to ${costingUser.name}`,
      },
    });

    return result;
  });

  // Notify costing owner
  await dispatchNotification({
    userId: body.assigned_costing_owner,
    title: "RFQ Assigned for Costing",
    message: `RFQ ${rfq.rfqCode} assigned for costing. Customer due: ${rfq.customerDueDate ? new Date(rfq.customerDueDate).toLocaleDateString() : "N/A"}`,
    type: "rfq",
    link: `/rfq/${id}`,
  });

  await logAudit(user.id, "RFQ", "AssignCosting", `Assigned costing for RFQ ${rfq.rfqCode} to ${costingUser.name}`, {
    resourceId: id,
    previousState: { status: rfq.status },
    newState: { status: "CostingPending", costingOwnerId: body.assigned_costing_owner },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: updated });
}
