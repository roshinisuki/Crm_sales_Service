import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  // Get all sales executives in company
  const executives = await prisma.user.findMany({
    where: { companyId: user.companyId, role: "SalesExecutive", isActive: true },
    select: { id: true, name: true },
  });

  const filteredExecs = assignedUserId ? executives.filter((e) => e.id === assignedUserId) : executives;

  const rows = await Promise.all(
    filteredExecs.map(async (exec) => {
      const leadWhere: any = { assignedUserId: exec.id, companyId: user.companyId, deletedAt: null };
      if (hasDateFilter) leadWhere.createdAt = dateFilter;

      const callWhere: any = { sentByUserId: exec.id, companyId: user.companyId, deletedAt: null, channel: "Call" };
      if (hasDateFilter) callWhere.sentAt = dateFilter;

      const meetingWhere: any = { sentByUserId: exec.id, companyId: user.companyId, deletedAt: null, channel: "Meeting" };
      if (hasDateFilter) meetingWhere.sentAt = dateFilter;

      const visitWhere: any = { hostedBy: exec.id, companyId: user.companyId, deletedAt: null, status: "COMPLETED" };
      if (hasDateFilter) visitWhere.checkOutTime = dateFilter;

      const rfqWhere: any = { assignedUserId: exec.id, companyId: user.companyId, deletedAt: null };
      if (hasDateFilter) rfqWhere.receivedDate = dateFilter;

      const quotationWhere: any = { createdById: exec.id, companyId: user.companyId, deletedAt: null, status: { not: "Draft" } };
      if (hasDateFilter) quotationWhere.sentAt = dateFilter;

      const dealWhere: any = { assignedUserId: exec.id, companyId: user.companyId, deletedAt: null, status: "Won" };
      if (hasDateFilter) dealWhere.updatedAt = dateFilter;

      const [leadsAssigned, callsMade, meetingsDone, visits, rfqs, quotationsSent, wonDeals, revenueAgg] = await Promise.all([
        prisma.lead.count({ where: leadWhere }),
        prisma.communicationLog.count({ where: callWhere }),
        prisma.communicationLog.count({ where: meetingWhere }),
        prisma.customerVisit.count({ where: visitWhere }),
        prisma.rFQ.count({ where: rfqWhere }),
        prisma.quotation.count({ where: quotationWhere }),
        prisma.deal.count({ where: dealWhere }),
        prisma.deal.aggregate({ where: dealWhere, _sum: { dealValue: true } }),
      ]);

      return {
        id: exec.id,
        name: exec.name,
        leadsAssigned,
        callsMade,
        meetingsDone,
        visits,
        rfqs,
        quotationsSent,
        wonDeals,
        revenue: revenueAgg._sum.dealValue || 0,
      };
    })
  );

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalDealsWon = rows.reduce((sum, r) => sum + r.wonDeals, 0);
  const totalLeads = rows.reduce((sum, r) => sum + r.leadsAssigned, 0);
  const avgRevenuePerExec = rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0;

  return NextResponse.json({
    success: true,
    summary: { totalRevenue, totalDealsWon, totalLeads, avgRevenuePerExec },
    rows,
  });
}
