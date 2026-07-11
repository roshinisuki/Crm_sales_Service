import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { computeItemMarginPercent, computeOverallMarginPercent, applyDiscountToQuotationItems } from "@/lib/quotation-margins";

// Default discount threshold (%) above which approval is required.
// Falls back to this if no Approval Matrix config is found.
const DEFAULT_DISCOUNT_THRESHOLD = 5;
const DEFAULT_ESCALATION_THRESHOLD = 15;
const DEFAULT_ESCALATION_ROLE = "SalesDirector";

async function getDiscountThreshold(companyId: string): Promise<number> {
  const config = await prisma.systemConfig.findFirst({
    where: { key: "approval_matrix_discount_threshold" },
  });
  if (config) {
    const val = parseFloat(config.value);
    if (!isNaN(val)) return val;
  }
  return DEFAULT_DISCOUNT_THRESHOLD;
}

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

  if (body.proposedAmount === undefined || body.proposedAmount === null || body.proposedAmount === "") {
    return NextResponse.json({ success: false, message: "Proposed amount is required" }, { status: 400 });
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // Only allow revisions when Active or PriceRevision
  if (!["Active", "PriceRevision"].includes(negotiation.status)) {
    return NextResponse.json({ success: false, message: "Cannot add revision to a negotiation that is not Active or in PriceRevision" }, { status: 400 });
  }

  const proposedAmount = parseFloat(body.proposedAmount);
  const reason = body.reason || null;
  const nextRevisionNumber = (negotiation.revisions[0]?.revisionNumber || 0) + 1;

  // B.6: Validate proposedAmount — reject non-positive or amounts greater than current amount
  const currentAmount = negotiation.revisedAmount || negotiation.initialAmount;
  if (isNaN(proposedAmount) || proposedAmount <= 0) {
    return NextResponse.json({ success: false, message: "Proposed amount must be a positive number" }, { status: 400 });
  }
  if (proposedAmount > currentAmount) {
    return NextResponse.json({ success: false, message: `Proposed amount (${proposedAmount}) cannot exceed the current negotiated amount (${currentAmount}). Revisions can only lower the price.` }, { status: 400 });
  }

  // B.4: Compute discount percent server-side instead of trusting client
  const discountPercent = currentAmount > 0
    ? Math.max(0, ((currentAmount - proposedAmount) / currentAmount) * 100)
    : 0;

  // Calculate cumulative discount relative to initialAmount
  const cumulativeDiscount = negotiation.initialAmount > 0
    ? Math.max(0, ((negotiation.initialAmount - proposedAmount) / negotiation.initialAmount) * 100)
    : discountPercent;

  // Determine if approval is required based on discount threshold from Approval Matrix settings
  const threshold = await getDiscountThreshold(user.companyId!);
  const escalationConfig = await getEscalationConfig();
  const requiresApproval = discountPercent > threshold;
  const requiresEscalation = discountPercent > escalationConfig.threshold;
  const approverRole = requiresEscalation ? escalationConfig.role : "SalesManager";

  // Create the revision in a transaction along with status + approval request
  const result = await prisma.$transaction(async (tx) => {
    const revision = await tx.negotiationRevision.create({
      data: {
        negotiationId: id,
        revisionNumber: nextRevisionNumber,
        proposedAmount,
        discountPercent,
        reason,
        status: requiresApproval ? "Pending" : "Approved",
        createdById: user.id,
      },
    });

    let quotationRevisionId: string | null = null;
    // Apply discount to the underlying Quotation ONLY if it does not require approval.
    // If it requires approval, the Quotation will be updated in the Approval Center handler.
    if (!requiresApproval && negotiation.quotationId) {
      const rootQuotation = await tx.quotation.findFirst({
        where: { id: negotiation.quotationId, deletedAt: null },
        include: { items: true },
      });
      if (rootQuotation) {
        // Create a snapshot of the quotation before applying the new discount
        const snapshotJson = JSON.stringify({
          quotationCode: rootQuotation.quotationCode,
          revisionNumber: rootQuotation.revisionNumber,
          status: rootQuotation.status,
          validUntil: rootQuotation.validUntil,
          subtotal: rootQuotation.subtotal,
          taxAmount: rootQuotation.taxAmount,
          totalAmount: rootQuotation.totalAmount,
          discountPercent: rootQuotation.discountPercent,
          finalAmount: rootQuotation.finalAmount,
          termsAndConditions: rootQuotation.termsAndConditions,
          paymentTerms: rootQuotation.paymentTerms,
          deliveryTerms: rootQuotation.deliveryTerms,
          freightTerms: rootQuotation.freightTerms,
          leadTimeDays: rootQuotation.leadTimeDays,
          overallMarginPercent: rootQuotation.overallMarginPercent ? Number(rootQuotation.overallMarginPercent) : null,
          items: rootQuotation.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountPercent: it.discountPercent,
            taxPercent: it.taxPercent,
            lineTotal: it.lineTotal,
            hsn: it.hsn,
            unit: it.unit,
            notes: it.notes,
            costBasisUnitPrice: it.costBasisUnitPrice ? Number(it.costBasisUnitPrice) : null,
            marginPercent: it.marginPercent ? Number(it.marginPercent) : null,
            priceSource: it.priceSource,
            quantityBreakId: it.quantityBreakId,
          })),
        });

        await tx.quotationRevisionSnapshot.create({
          data: {
            quotationId: rootQuotation.id,
            revisionNumber: rootQuotation.revisionNumber,
            snapshotJson,
            createdById: user.id,
          },
        });

        const totalAmount = rootQuotation.totalAmount || 0;
        // C.3/C.4: Recalculate line items + tax proportionally using cumulativeDiscount
        const recalc = applyDiscountToQuotationItems(
          rootQuotation.items.map(i => ({ id: i.id, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, taxPercent: i.taxPercent, discountPercent: i.discountPercent })),
          totalAmount,
          cumulativeDiscount
        );
        await tx.quotation.update({
          where: { id: rootQuotation.id },
          data: {
            discountPercent: cumulativeDiscount,
            finalAmount: recalc.finalAmount,
            taxAmount: recalc.taxAmount,
            subtotal: recalc.subtotal,
          },
        });
        // Update each line item
        for (const updatedItem of recalc.items) {
          await tx.quotationItem.update({
            where: { id: updatedItem.id },
            data: {
              unitPrice: updatedItem.unitPrice,
              totalPrice: updatedItem.totalPrice,
              lineTotal: updatedItem.lineTotal,
              discountPercent: updatedItem.discountPercent,
            },
          });
        }
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: rootQuotation.id,
            fromStatus: rootQuotation.status,
            toStatus: rootQuotation.status,
            changedById: user.id,
            notes: `Discount of ${cumulativeDiscount.toFixed(2)}% applied via auto-approved negotiation revision`,
          },
        });
      }
    }

    if (requiresApproval) {
      // Set negotiation to PendingApproval; revision stays Pending
      await tx.negotiation.update({
        where: { id },
        data: {
          status: "PendingApproval",
          revisedAmount: proposedAmount,
          discountRequested: discountPercent,
        },
      });

      // Create an ApprovalHistory entry so it appears in the Approval Center
      await tx.approvalHistory.create({
        data: {
          approvalType: "Negotiation",
          entityType: "Negotiation",
          entityId: id,
          status: "Pending",
          discountPercent,
          remarks: reason,
          requestedById: user.id,
          previousStatus: negotiation.status,
          companyId: user.companyId,
        },
      });
    } else {
      // Auto-approve: set negotiation to PriceRevision
      await tx.negotiation.update({
        where: { id },
        data: {
          status: "PriceRevision",
          revisedAmount: proposedAmount,
          discountRequested: discountPercent,
        },
      });
    }

    return { revision, quotationRevisionId };
  });

  // Fetch the updated negotiation with revisions to return
  const updated = await prisma.negotiation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      revisions: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { revisionNumber: "asc" },
      },
    },
  });

  // B15: Notify assigned user about the revision
  if (updated?.assignedUserId) {
    await dispatchNotification({
      userId: updated.assignedUserId,
      title: requiresApproval ? "Negotiation Revision Needs Approval" : "Negotiation Revision Created",
      message: requiresApproval
        ? `Revision #${nextRevisionNumber} for ${updated.negotiationCode} requires approval (discount ${discountPercent}%${requiresEscalation ? " — escalated to " + approverRole : ""}).`
        : `Revision #${nextRevisionNumber} for ${updated.negotiationCode} was auto-approved.`,
      type: "negotiation",
      link: `/negotiations/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: requiresApproval
      ? `Revision #${nextRevisionNumber} created. Discount ${discountPercent}% exceeds threshold ${threshold}%${requiresEscalation ? " and escalated to " + approverRole : ""} — sent for approval.`
      : `Revision #${nextRevisionNumber} created and auto-approved. Negotiation moved to PriceRevision.`,
  }, { status: 201 });
}
