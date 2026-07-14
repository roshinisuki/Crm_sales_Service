import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEventAsync } from "@/lib/activity-event";

/**
 * POST /api/purchase-orders/[id]/reconcile
 *
 * Reconciles the PO's finalAmount against the linked quotation's finalAmount.
 * Sets `amountReconciled` and `quotationFinalAmount` fields.
 * Returns the reconciliation result.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { items: true, quotation: { select: { id: true, finalAmount: true, quotationCode: true } } },
  });
  if (!po) return NextResponse.json({ success: false, message: "Purchase order not found" }, { status: 404 });

  if (!po.quotationId || !po.quotation) {
    return NextResponse.json({ success: false, message: "PO has no linked quotation to reconcile against" }, { status: 400 });
  }

  const quoteFinalAmount = po.quotation.finalAmount || 0;
  const poFinalAmount = po.finalAmount || 0;
  const difference = Math.abs(poFinalAmount - quoteFinalAmount);
  const tolerance = 0.01; // 1 paise tolerance
  const reconciled = difference < tolerance;

  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      quotationFinalAmount: quoteFinalAmount,
      amountReconciled: reconciled,
    },
  });

  await logEventAsync({
    entityType: "PurchaseOrder",
    entityId: id,
    rootEntityId: po.quotationId,
    type: "po_reconciled",
    actorId: user.id,
    metadata: {
      poCode: po.poCode,
      poFinalAmount,
      quotationFinalAmount: quoteFinalAmount,
      difference,
      reconciled,
    },
  });

  await logAudit(user.id, "PurchaseOrder", "Reconcile", `Reconciled PO ${po.poCode}: difference=${difference.toFixed(2)}, reconciled=${reconciled}`, {
    resourceId: id,
    newState: { amountReconciled: reconciled, quotationFinalAmount: quoteFinalAmount },
    context: extractAuditContext(request),
  });

  return NextResponse.json({
    success: true,
    data: {
      poCode: po.poCode,
      poFinalAmount,
      quotationFinalAmount: quoteFinalAmount,
      difference: Math.round(difference * 100) / 100,
      reconciled,
    },
  });
}
