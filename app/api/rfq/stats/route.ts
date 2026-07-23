import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/stats");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const where: any = { deletedAt: null, companyId: user.companyId };
  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const rfqs = await prisma.rFQ.findMany({
    where,
    select: { id: true, status: true, createdAt: true, customerDueDate: true },
  });

  const now = new Date();
  const total = rfqs.length;

  const pendingCosting = rfqs.filter((r) => r.status === "CostingPending").length;

  // Aging buckets for Costing Pending — use status history for accurate aging
  const costingPendingRfqs = rfqs.filter((r) => r.status === "CostingPending");
  const costingPendingIds = costingPendingRfqs.map((r) => r.id);

  // Fetch the most recent "toStatus = CostingPending" history entry for each RFQ
  const historyEntries = costingPendingIds.length > 0
    ? await prisma.rFQStatusHistory.findMany({
        where: { rfqId: { in: costingPendingIds }, toStatus: "CostingPending" },
        select: { rfqId: true, changedAt: true },
        orderBy: { changedAt: "desc" },
      })
    : [];

  // Build a map of rfqId -> latest changedAt for CostingPending
  const costingSinceMap = new Map<string, Date>();
  for (const h of historyEntries) {
    if (!costingSinceMap.has(h.rfqId)) {
      costingSinceMap.set(h.rfqId, new Date(h.changedAt));
    }
  }

  const getAgingDays = (rfqId: string, fallbackDate: Date) => {
    const since = costingSinceMap.get(rfqId);
    const refDate = since || fallbackDate;
    return Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const aging_0_2 = costingPendingRfqs.filter((r) => {
    const days = getAgingDays(r.id, new Date(r.createdAt));
    return days >= 0 && days <= 2;
  }).length;
  const aging_3_5 = costingPendingRfqs.filter((r) => {
    const days = getAgingDays(r.id, new Date(r.createdAt));
    return days >= 3 && days <= 5;
  }).length;
  const aging_5_plus = costingPendingRfqs.filter((r) => {
    const days = getAgingDays(r.id, new Date(r.createdAt));
    return days > 5;
  }).length;

  // Overdue customer due date
  const overdueCustomerDue = rfqs.filter((r) => {
    if (!r.customerDueDate) return false;
    return new Date(r.customerDueDate) < now && !["QuotationCreated", "Closed"].includes(r.status);
  }).length;

  // RFQ to Quotation rate
  const quotationCreated = rfqs.filter((r) => r.status === "QuotationCreated").length;
  const rfqToQuotationRate = total > 0 ? Math.round((quotationCreated / total) * 100) : 0;

  return NextResponse.json({
    success: true,
    data: {
      total,
      pending_costing: pendingCosting,
      aging_0_2,
      aging_3_5,
      aging_5_plus,
      overdue_customer_due: overdueCustomerDue,
      rfq_to_quotation_rate: rfqToQuotationRate,
    },
  });
}
