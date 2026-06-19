import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Simple in-memory cache
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "SalesExecutive") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, data: cache.data, cached: true });
  }

  const companyId = user.companyId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Row 1 — KPI Cards
  const [totalLeads, leadsToCustomer, totalRFQs, quotationsSent, quotationsAccepted, revenueWon] = await Promise.all([
    prisma.lead.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
    }),
    prisma.customer.count({
      where: {
        convertedFromLead: { not: null },
        onboardedAt: { gte: monthStart, lte: monthEnd },
        companyId,
      },
    }),
    prisma.rFQ.count({
      where: { receivedDate: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
    }),
    prisma.quotation.count({
      where: {
        sentAt: { gte: monthStart, lte: monthEnd },
        status: { not: "Draft" },
        companyId,
        deletedAt: null,
      },
    }),
    prisma.quotation.count({
      where: {
        acceptedAt: { gte: monthStart, lte: monthEnd },
        status: "Accepted",
        companyId,
        deletedAt: null,
      },
    }),
    prisma.quotation.aggregate({
      where: {
        acceptedAt: { gte: monthStart, lte: monthEnd },
        status: "Accepted",
        companyId,
        deletedAt: null,
      },
      _sum: { finalAmount: true },
    }),
  ]);

  const conversionPercent = totalLeads > 0 ? Math.round((leadsToCustomer / totalLeads) * 1000) / 10 : 0;

  const kpis = {
    totalLeads,
    leadsToCustomer,
    conversionPercent,
    totalRFQs,
    quotationsSent,
    quotationsAccepted,
    revenueWon: revenueWon._sum.finalAmount || 0,
  };

  // Row 2 — Pipeline by Stage
  const pipelineStages = await prisma.pipelineStage.findMany({
    where: { companyId, isActive: true },
    orderBy: { order: "asc" },
  });

  const deals = await prisma.deal.findMany({
    where: { companyId, deletedAt: null },
    select: { status: true, dealValue: true },
  });

  const pipelineByStage = pipelineStages.map((stage) => {
    const stageDeals = deals.filter((d) => d.status === stage.name);
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      order: stage.order,
      dealCount: stageDeals.length,
      totalValue: stageDeals.reduce((sum, d) => sum + d.dealValue, 0),
    };
  });

  // Row 3 — Team Performance
  const executives = await prisma.user.findMany({
    where: { companyId, role: "SalesExecutive", isActive: true },
    select: { id: true, name: true },
  });

  const teamPerformance = await Promise.all(
    executives.map(async (exec) => {
      const [leadsAssigned, visitsDone, followUpsDone, dealsWon] = await Promise.all([
        prisma.lead.count({
          where: { assignedUserId: exec.id, createdAt: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
        }),
        prisma.customerVisit.count({
          where: { hostedBy: exec.id, status: "COMPLETED", checkOutTime: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
        }),
        prisma.followUp.count({
          where: { completedById: exec.id, status: "Completed", completedAt: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
        }),
        prisma.deal.count({
          where: { assignedUserId: exec.id, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd }, companyId, deletedAt: null },
        }),
      ]);
      return { id: exec.id, name: exec.name, leadsAssigned, visitsDone, followUpsDone, dealsWon };
    })
  );

  // Row 4 — Recent Activity (last 10)
  const recentLogs = await prisma.communicationLog.findMany({
    where: { companyId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      sentByUser: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 10,
  });

  const recentVisits = await prisma.customerVisit.findMany({
    where: { companyId, deletedAt: null, status: "COMPLETED" },
    include: { customer: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } },
    orderBy: { checkOutTime: "desc" },
    take: 10,
  });

  const recentActivity: any[] = [];
  for (const log of recentLogs) {
    recentActivity.push({
      type: log.channel,
      actor: log.sentByUser?.name || "System",
      description: `${log.channel} — ${log.customer?.name || log.lead?.name || "Unknown"}`,
      timestamp: log.sentAt,
    });
  }
  for (const v of recentVisits) {
    recentActivity.push({
      type: "Visit",
      actor: v.host?.name || "System",
      description: `Visited ${v.customer?.name || "Unknown"}`,
      timestamp: v.checkOutTime || v.createdAt,
    });
  }
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivityTop10 = recentActivity.slice(0, 10);

  // Row 5 — RFQ to PO Funnel (all-time)
  const [rfqsReceived, quotationsCreated, quotationsAcceptedAllTime] = await Promise.all([
    prisma.rFQ.count({ where: { companyId, deletedAt: null } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: { not: "Draft" } } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Accepted" } }),
  ]);

  const funnel = {
    rfqsReceived,
    quotationsCreated,
    quotationsAccepted: quotationsAcceptedAllTime,
    pos: null, // Placeholder for Variant 3
  };

  const data = { kpis, pipelineByStage, teamPerformance, recentActivity: recentActivityTop10, funnel };
  cache = { data, timestamp: Date.now() };

  return NextResponse.json({ success: true, data, cached: false });
}
