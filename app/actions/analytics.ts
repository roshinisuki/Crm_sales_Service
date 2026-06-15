"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function getSalesAnalyticsAction(dateRange?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    let dateCutoff: Date | undefined;
    if (dateRange === "last30days") {
      dateCutoff = new Date();
      dateCutoff.setDate(dateCutoff.getDate() - 30);
    } else if (dateRange === "last3months") {
      dateCutoff = new Date();
      dateCutoff.setMonth(dateCutoff.getMonth() - 3);
    } else if (dateRange === "last6months") {
      dateCutoff = new Date();
      dateCutoff.setMonth(dateCutoff.getMonth() - 6);
    }

    let rbacCustomerFilter: any = { companyId: userPayload.companyId };
    let rbacDealFilter: any = { companyId: userPayload.companyId };

    if (userPayload.role === "SalesExecutive") {
      rbacCustomerFilter.assignedUserId = userPayload.id;
      rbacDealFilter.OR = [
        { assignedUserId: userPayload.id },
        { customer: { assignedUserId: userPayload.id } }
      ];
      rbacDealFilter.companyId = userPayload.companyId;
    } else if (userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    if (dateCutoff) {
      rbacCustomerFilter.createdAt = { gte: dateCutoff };
      rbacDealFilter.createdAt = { gte: dateCutoff };
    }

    // 1. KPI Aggregations
    const totalLeads = await prisma.lead.count({
      where: {
        AND: [
          rbacCustomerFilter,
          { status: { in: ["New", "Contacted", "Qualified", "ProposalSent", "Negotiation"] } }
        ]
      }
    });

    const qualifiedLeads = await prisma.lead.count({
      where: {
        AND: [
          rbacCustomerFilter,
          { status: "Qualified" }
        ]
      }
    });

    const openDealsCount = await prisma.deal.count({
      where: {
        AND: [
          rbacDealFilter,
          { status: { in: ["Open", "ProposalSent", "Negotiation"] } }
        ]
      }
    });

    const wonDealsCount = await prisma.deal.count({
      where: {
        AND: [
          rbacDealFilter,
          { status: "Won" }
        ]
      }
    });

    const lostDealsCount = await prisma.deal.count({
      where: {
        AND: [
          rbacDealFilter,
          { status: "Lost" }
        ]
      }
    });

    const totalDealsCount = openDealsCount + wonDealsCount + lostDealsCount;

    // Pipeline Revenue (Sum of deal values for open deals)
    const pipelineSum = await prisma.deal.aggregate({
      _sum: { dealValue: true },
      where: {
        AND: [
          rbacDealFilter,
          { status: { in: ["Open", "ProposalSent", "Negotiation"] } }
        ]
      }
    });
    const pipelineRevenue = pipelineSum._sum.dealValue || 0;

    // Won Revenue (Sum of won deal values)
    const wonRevenueSum = await prisma.deal.aggregate({
      _sum: { dealValue: true },
      where: {
        AND: [
          rbacDealFilter,
          { status: "Won" }
        ]
      }
    });
    const wonRevenue = wonRevenueSum._sum.dealValue || 0;

    // Conversion rate: Won / Total Deals
    const conversionRate = totalDealsCount > 0 ? Math.round((wonDealsCount / totalDealsCount) * 100) : 0;

    // 2. Sales Funnel Chart Data
    // We compute stage counts from both lead status and deals
    const funnelStages = [
      {
        stage: "New Lead",
        count: await prisma.lead.count({
          where: { AND: [rbacCustomerFilter, { status: "New" }] }
        })
      },
      {
        stage: "Contacted",
        count: await prisma.lead.count({
          where: { AND: [rbacCustomerFilter, { status: "Contacted" }] }
        })
      },
      {
        stage: "Qualified",
        count: await prisma.lead.count({
          where: { AND: [rbacCustomerFilter, { status: "Qualified" }] }
        })
      },
      {
        stage: "Proposal Sent",
        count: await prisma.deal.count({
          where: { AND: [rbacDealFilter, { status: "ProposalSent" }] }
        })
      },
      {
        stage: "Negotiation",
        count: await prisma.deal.count({
          where: { AND: [rbacDealFilter, { status: "Negotiation" }] }
        })
      },
      {
        stage: "Closed Won",
        count: wonDealsCount
      }
    ];

    // 3. Lead Source Analytics
    // Group customers by leadSource
    const customersBySource = await prisma.customer.groupBy({
      by: ["leadSource"],
      _count: { id: true },
      where: rbacCustomerFilter
    });

    // We can also aggregate deal value per source by querying won deals
    const wonDealsWithSource = await prisma.deal.findMany({
      where: {
        AND: [
          rbacDealFilter,
          { status: "Won" }
        ]
      },
      include: {
        customer: { select: { leadSource: true } }
      }
    });

    const sourceValueMap: { [key: string]: number } = {};
    const sourceWonCountMap: { [key: string]: number } = {};

    wonDealsWithSource.forEach((d) => {
      const source = d.customer?.leadSource || "Unknown";
      sourceValueMap[source] = (sourceValueMap[source] || 0) + d.dealValue;
      sourceWonCountMap[source] = (sourceWonCountMap[source] || 0) + 1;
    });

    const sourceAnalytics = customersBySource.map((s) => {
      const sourceName = s.leadSource || "Unknown";
      const totalLeadsForSource = s._count.id;
      const wonCount = sourceWonCountMap[sourceName] || 0;
      const totalRevenue = sourceValueMap[sourceName] || 0;
      const convRate = totalLeadsForSource > 0 ? Math.round((wonCount / totalLeadsForSource) * 100) : 0;

      return {
        source: sourceName,
        count: totalLeadsForSource,
        revenue: totalRevenue,
        conversionRate: convRate
      };
    });

    // 4. Executive/Agent Performance (Exclude for Executives themselves to keep it team-level)
    let agentPerformance: any[] = [];
    if (userPayload.role !== "SalesExecutive") {
      const executives = await prisma.user.findMany({
        where: { role: "SalesExecutive", companyId: userPayload.companyId },
        select: { id: true, name: true }
      });

      const performancePromises = executives.map(async (exec) => {
        const totalAssignedDeals = await prisma.deal.count({
          where: { 
            assignedUserId: exec.id,
            companyId: userPayload.companyId,
            ...(dateCutoff ? { createdAt: { gte: dateCutoff } } : {})
          }
        });
        const wonAssignedDeals = await prisma.deal.count({
          where: { 
            assignedUserId: exec.id, 
            status: "Won",
            companyId: userPayload.companyId,
            ...(dateCutoff ? { createdAt: { gte: dateCutoff } } : {})
          }
        });
        const sumVal = await prisma.deal.aggregate({
          _sum: { dealValue: true },
          where: { 
            assignedUserId: exec.id, 
            status: "Won",
            companyId: userPayload.companyId,
            ...(dateCutoff ? { createdAt: { gte: dateCutoff } } : {})
          }
        });
        const totalWonValue = sumVal._sum.dealValue || 0;
        const conv = totalAssignedDeals > 0 ? Math.round((wonAssignedDeals / totalAssignedDeals) * 100) : 0;

        return {
          name: exec.name,
          dealsCount: totalAssignedDeals,
          wonCount: wonAssignedDeals,
          revenue: totalWonValue,
          conversionRate: conv
        };
      });

      agentPerformance = await Promise.all(performancePromises);
      // Sort by revenue descending
      agentPerformance.sort((a, b) => b.revenue - a.revenue);
    }

    // 5. Revenue Trend (Won deals by month over last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const trendCutoff = dateCutoff && dateCutoff > sixMonthsAgo ? dateCutoff : sixMonthsAgo;

    const wonDealsTrend = await prisma.deal.findMany({
      where: {
        AND: [
          rbacDealFilter,
          { status: "Won" },
          { updatedAt: { gte: trendCutoff } }
        ]
      },
      select: { dealValue: true, updatedAt: true },
      orderBy: { updatedAt: "asc" }
    });

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendMap: { [key: string]: number } = {};

    // Initialize last 6 months
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      trendMap[label] = 0;
    }

    wonDealsTrend.forEach((d) => {
      const date = new Date(d.updatedAt);
      const label = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      if (trendMap[label] !== undefined) {
        trendMap[label] += d.dealValue;
      }
    });

    // Convert map to ordered array
    const revenueTrend = Object.keys(trendMap)
      .reverse()
      .map((key) => ({
        month: key,
        revenue: trendMap[key]
      }));

    return {
      success: true,
      data: {
        kpis: {
          totalLeads,
          qualifiedLeads,
          openDeals: openDealsCount,
          wonDeals: wonDealsCount,
          pipelineRevenue,
          wonRevenue,
          conversionRate
        },
        funnel: funnelStages,
        leadSources: sourceAnalytics,
        agentPerformance,
        revenueTrend
      }
    };
  } catch (error) {
    console.error("GET Sales Analytics Error:", error);
    return { success: false, message: "Failed to fetch sales analytics data" };
  }
}
