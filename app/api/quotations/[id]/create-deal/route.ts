import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { transitionDealStatus } from "@/lib/dealService";

// Create a Deal from an Accepted Quotation.
// Links the quotation back to the new deal via `quotation.dealId`.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // Only Admin / SalesManager / SalesExecutive may create deals
  if (!["Admin", "SalesManager", "SalesExecutive"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const expectedCloseDate = body.expectedCloseDate
    ? new Date(body.expectedCloseDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default +30 days
  const assignedUserId = body.assignedUserId || null;
  const notes = body.notes || "";

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { customer: { select: { id: true, name: true } }, items: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (existing.status !== "Accepted") {
    return NextResponse.json({ success: false, message: "Only Accepted quotations can be converted to a Deal" }, { status: 400 });
  }

  if (existing.dealId) {
    return NextResponse.json({ success: false, message: "A deal is already linked to this quotation", data: { dealId: existing.dealId } }, { status: 400 });
  }

  const dealName = `${existing.customer?.name || "Customer"} — ${existing.quotationCode}`;

  const finalAssignedUserId = user.role === "SalesExecutive" ? user.id : assignedUserId;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the Deal at Qualified (pipeline vocabulary)
    const deal = await tx.deal.create({
      data: {
        dealName,
        customerId: existing.customerId,
        dealValue: existing.finalAmount,
        expectedCloseDate,
        assignedUserId: finalAssignedUserId,
        notes: `Created from Quotation ${existing.quotationCode}. ${notes || ""}`.trim(),
        status: "Qualified",
        companyId: user.companyId,
      },
    });

    // 2. Record initial stage history
    await tx.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: null,
        toStatus: "Qualified",
        changedById: user.id,
      },
    });

    // 3. Link quotation to deal
    await tx.quotation.update({
      where: { id: existing.id },
      data: { dealId: deal.id },
    });

    // 4. (Removed Deal Won transition; deal is only transitioned to Won upon PO approval)

    return deal;
  });

  await logAudit(
    user.id,
    "Deal",
    "Create",
    `Created deal "${result.dealName}" from quotation ${existing.quotationCode} (Value: ${result.dealValue})`
  );

  // Notify assigned executive if creator is different
  if (finalAssignedUserId && finalAssignedUserId !== user.id) {
    await dispatchNotification({
      userId: finalAssignedUserId,
      title: "New Deal Assigned",
      message: `You have been assigned a new deal: "${result.dealName}".`,
      type: "deal",
      link: `/deals/${result.id}`,
    });
  }

  // Notify Managers/Leads (scoped to tenant company)
  const managers = await prisma.user.findMany({
    where: { role: { in: ["Admin", "SalesManager"] }, isActive: true, companyId: user.companyId },
    select: { id: true },
  });
  const managerIds = managers.map((m) => m.id).filter((mid) => mid !== user.id);
  if (managerIds.length > 0) {
    await dispatchNotificationsToMany({
      userIds: managerIds,
      title: "New Deal Created",
      message: `${user.email} created a new deal "${result.dealName}" from quotation ${existing.quotationCode}.`,
      type: "deal",
      link: `/deals/${result.id}`,
    });
  }

  return NextResponse.json({ success: true, data: result, message: "Deal created from quotation" });
}
