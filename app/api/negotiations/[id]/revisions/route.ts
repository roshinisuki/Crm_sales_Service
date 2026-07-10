import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { computeItemMarginPercent, computeOverallMarginPercent } from "@/lib/quotation-margins";

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
  const discountPercent = body.discountPercent ? parseFloat(body.discountPercent) : 0;
  const reason = body.reason || null;
  const nextRevisionNumber = (negotiation.revisions[0]?.revisionNumber || 0) + 1;

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

    // Auto-create a quotation revision linked to this negotiation if the negotiation has a linked quotation
    //
    // REVISION CHAIN MODEL (root-anchored):
    //   parentQuotationId on every revision points to the ROOT quotation (R1).
    //   revisionNumber is computed from the LATEST revision (max revisionNumber) + 1,
    //   NOT from root.revisionNumber + 1 (which would always produce 2).
    //   To walk the chain: query by parentQuotationId = rootId, orderBy revisionNumber.
    //
    let quotationRevisionId: string | null = null;
    if (negotiation.quotationId) {
      // Fetch the root quotation (R1) — used for parent anchor and field copying
      const rootQuotation = await tx.quotation.findFirst({
        where: { id: negotiation.quotationId, deletedAt: null },
        include: { items: true },
      });
      if (rootQuotation) {
        // Find the LATEST revision quotation (highest revisionNumber) linked to this negotiation
        const latestRevision = await tx.quotation.findFirst({
          where: { negotiationId: id, deletedAt: null },
          orderBy: { revisionNumber: "desc" },
          include: { items: true },
        });
        // The "prior" quotation is the latest revision if it exists, otherwise root itself
        const priorQuotation = latestRevision || rootQuotation;
        const newRevisionNumber = priorQuotation.revisionNumber + 1;

        // Snapshot the prior quotation before creating the new revision
        const snapshotJson = JSON.stringify({
          quotationCode: priorQuotation.quotationCode,
          revisionNumber: priorQuotation.revisionNumber,
          status: priorQuotation.status,
          finalAmount: priorQuotation.finalAmount,
          discountPercent: priorQuotation.discountPercent,
          items: priorQuotation.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        });
        await tx.quotationRevisionSnapshot.create({
          data: {
            quotationId: priorQuotation.id,
            revisionNumber: priorQuotation.revisionNumber,
            snapshotJson,
            createdById: user.id,
          },
        });

        // Generate new quotation code for the revision
        const year = new Date().getFullYear();
        const yearCount = await tx.quotation.count({
          where: {
            companyId: user.companyId,
            quotationCode: { startsWith: `QT-${year}-` },
          },
        });
        const newCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

        // Root-anchored: parentQuotationId always points to R1
        const rootParentId = rootQuotation.parentQuotationId || rootQuotation.id;

        // ─── Proportional price recalculation ────────────────────────────
        // Scale each line item's unitPrice/totalPrice/lineTotal proportionally
        // so the new total matches proposedAmount (relative to prior finalAmount).
        const priorFinalAmount = priorQuotation.finalAmount || priorQuotation.totalAmount || 0;
        const scaleFactor = priorFinalAmount > 0 ? proposedAmount / priorFinalAmount : 1;

        // Compute new line items with recalculated prices, tax, and margin
        let newSubtotal = 0;
        let newTaxAmount = 0;
        const newItemsData: Array<any> = [];

        for (const item of priorQuotation.items) {
          const newUnitPrice = item.unitPrice * scaleFactor;
          const newTotalPrice = item.totalPrice * scaleFactor;
          const newLineTotal = item.lineTotal * scaleFactor;
          const itemTaxAmount = newLineTotal * (item.taxPercent / 100);

          newSubtotal += newLineTotal;
          newTaxAmount += itemTaxAmount;

          // Recalculate marginPercent against new unitPrice if cost basis exists
          const newMarginPercent = computeItemMarginPercent(
            newUnitPrice,
            item.costBasisUnitPrice != null ? Number(item.costBasisUnitPrice) : null
          );

          newItemsData.push({
            quotationId: null as any, // will be set after quotation create
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: newUnitPrice,
            totalPrice: newTotalPrice,
            discountPercent: item.discountPercent,
            taxPercent: item.taxPercent,
            lineTotal: newLineTotal,
            hsn: item.hsn,
            unit: item.unit,
            notes: item.notes,
            // Carry cost basis and margin data from prior revision
            costBasisUnitPrice: item.costBasisUnitPrice,
            marginPercent: newMarginPercent,
            priceSource: item.priceSource || "RFQCosting",
            quantityBreakId: item.quantityBreakId,
          });
        }

        // proposedAmount is tax-inclusive (matches how quotation finalAmount works)
        const newFinalAmount = proposedAmount;

        const newQuotation = await tx.quotation.create({
          data: {
            quotationCode: newCode,
            rfqId: rootQuotation.rfqId,
            customerId: rootQuotation.customerId,
            contactId: rootQuotation.contactId,
            dealId: rootQuotation.dealId,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            discountPercent,
            totalAmount: newSubtotal,
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            finalAmount: newFinalAmount,
            termsAndConditions: rootQuotation.termsAndConditions,
            paymentTerms: rootQuotation.paymentTerms,
            deliveryTerms: rootQuotation.deliveryTerms,
            freightTerms: rootQuotation.freightTerms,
            leadTimeDays: rootQuotation.leadTimeDays,
            revisionNumber: newRevisionNumber,
            status: requiresApproval ? "PendingApproval" : "Draft",
            createdById: user.id,
            companyId: user.companyId,
            negotiationId: id,
            parentQuotationId: rootParentId,
          },
        });

        // Create line items for the new revision quotation
        for (const itemData of newItemsData) {
          await tx.quotationItem.create({
            data: {
              ...itemData,
              quotationId: newQuotation.id,
            },
          });
        }

        // Compute overall margin for the new revision
        const overallMargin = computeOverallMarginPercent(
          newItemsData.map((it) => ({
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            costBasisUnitPrice: it.costBasisUnitPrice != null ? Number(it.costBasisUnitPrice) : null,
          }))
        );
        if (overallMargin != null) {
          await tx.quotation.update({
            where: { id: newQuotation.id },
            data: { overallMarginPercent: overallMargin },
          });
        }

        // Create status history for the new revision
        await tx.quotationStatusHistory.create({
          data: {
            quotationId: newQuotation.id,
            fromStatus: null,
            toStatus: requiresApproval ? "PendingApproval" : "Draft",
            changedById: user.id,
            notes: `Revision R${newRevisionNumber} created from negotiation ${negotiation.negotiationCode}`,
          },
        });

        // If approval is required, create a QuotationApproval with the correct approver role
        if (requiresApproval) {
          // Find approver with the required role
          const approver = await tx.user.findFirst({
            where: { role: approverRole, companyId: user.companyId, isActive: true },
            select: { id: true },
          });
          if (approver) {
            await tx.quotationApproval.create({
              data: {
                quotationId: newQuotation.id,
                requestedById: user.id,
                approverId: approver.id,
                status: "Pending",
                discountPercent,
                notes: reason || `Price revision from negotiation ${negotiation.negotiationCode}`,
                requiredApproverRole: approverRole,
                revisionAuthorId: user.id,
              },
            });
            // Notify approver
            await tx.notification.create({
              data: {
                userId: approver.id,
                title: requiresEscalation ? "Escalation Approval Needed: Quotation Revision" : "Approval Needed: Quotation Revision",
                message: `Revision R${newRevisionNumber} of ${rootQuotation.quotationCode} needs approval (discount ${discountPercent}%${requiresEscalation ? " — escalated to " + approverRole : ""})`,
                type: "Approval",
                link: `/quotations/${newQuotation.id}`,
              },
            });
          }
        }

        quotationRevisionId = newQuotation.id;
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
