import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      items: true,
      customer: { select: { id: true, name: true } },
      quotationApprovals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Draft", "Approved"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Draft or Approved quotations can be sent" }, { status: 400 });
  }

  if (existing.items.length === 0) {
    return NextResponse.json({ success: false, message: "Cannot send quotation without line items" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(existing.validUntil) < today) {
    return NextResponse.json({ success: false, message: "Validity date has passed — update before sending" }, { status: 400 });
  }

  // Fetch approval and floor matrices
  const [discountConfig, floorConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_discount_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "quotation_margin_floor_percent" } }),
  ]);
  const discountThreshold = discountConfig ? parseFloat(discountConfig.value) : 5.0;
  const marginFloor = floorConfig ? parseFloat(floorConfig.value) : 15.0;

  // Compute realized weighted discount and evaluate triggers
  let totalGross = 0;
  let totalNet = existing.subtotal - (existing.subtotal * existing.discountPercent / 100);

  let maxLineDiscount = 0;
  let hasMarginBreach = false;
  const reasons: string[] = [];

  for (const item of existing.items) {
    const qty = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    const gross = qty * unitPrice;
    totalGross += gross;

    if (item.discountPercent > maxLineDiscount) {
      maxLineDiscount = item.discountPercent;
    }

    if (item.costBasisUnitPrice != null) {
      const costBasis = Number(item.costBasisUnitPrice);
      const margin = unitPrice > 0 ? ((unitPrice - costBasis) / unitPrice) * 100 : 0;
      if (margin < marginFloor) {
        hasMarginBreach = true;
      }
    }
  }

  const blendedDiscount = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

  if (blendedDiscount > discountThreshold) {
    reasons.push(`Blended discount of ${blendedDiscount.toFixed(1)}% exceeds the ${discountThreshold}% threshold`);
  }
  if (maxLineDiscount > discountThreshold) {
    reasons.push(`Line-item discount ceiling of ${maxLineDiscount.toFixed(1)}% exceeds the ${discountThreshold}% threshold`);
  }
  if (hasMarginBreach) {
    reasons.push(`One or more line items have margins falling below the minimum floor of ${marginFloor}%`);
  }

  const hasApprovedApproval = existing.quotationApprovals.some(
    (a: any) => a.status === "Approved"
  );

  if (reasons.length > 0 && !hasApprovedApproval && user.role !== "Admin") {
    return NextResponse.json(
      {
        success: false,
        requires_approval: true,
        reasons,
        message: `Quotation requires manager approval before sending. Reasons:\n- ${reasons.join("\n- ")}`,
      },
      { status: 402 }
    );
  }

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      // 1. Update quotation status
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "Sent", sentAt: new Date() },
      });

      // 2. Insert quotation_status_history
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: "Sent",
          changedById: user.id,
          notes: `Quotation sent to customer.${reasons.length > 0 ? " Approved override." : ""}`,
        },
      });

      // 3. Create follow-up (Call, scheduled +2 days)
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 2);

      await tx.followUp.create({
        data: {
          assignedUserId: existing.assignedUserId || user.id,
          nextMeetingDate: followUpDate,
          remarks: `Auto-generated follow up for quotation ${existing.quotationCode}`,
          status: "Pending",
          customerId: existing.customerId,
          companyId: user.companyId,
          notes: `Auto-generated follow up for quotation ${existing.quotationCode} sent to ${existing.customer?.name || "Customer"}.`,
          stageAtCreation: "Deal",
        },
      });



      return q;
    });

    await logAudit(user.id, "Quotation", "Send", `Sent quotation ${existing.quotationCode} to customer`, {
      resourceId: id,
      newState: { status: "Sent" },
      context: extractAuditContext(request),
    });

    // Notify assigned user if different from sender
    if (existing.assignedUserId && existing.assignedUserId !== user.id) {
      await dispatchNotification({
        userId: existing.assignedUserId,
        title: "Quotation Sent",
        message: `Quotation ${existing.quotationCode} has been sent to ${existing.customer?.name || "customer"}.`,
        type: "quotation",
        link: `/quotations/${id}`,
      }).catch(() => undefined);
    }

    // Notify customer contact if linked
    if (existing.contactId) {
      await dispatchNotification({
        userId: existing.contactId,
        title: "Quotation Received",
        message: `You have received quotation ${existing.quotationCode}. Total: ₹${existing.finalAmount.toFixed(2)}`,
        type: "quotation",
        link: `/quotations/${id}`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, data: quotation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to send quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
