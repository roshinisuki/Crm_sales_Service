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
          { status: { in: ["New", "Contacted", "FollowUpDue", "SQL", "Qualified"] } }
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
          { status: { in: ["SalesOpportunity", "RequirementGathering", "MeetingScheduled", "Active"] } }
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

    // Pipeline Revenue (Sum of deal values for active pipeline)
    const pipelineSum = await prisma.deal.aggregate({
      _sum: { dealValue: true },
      where: {
        AND: [
          rbacDealFilter,
          { status: { in: ["SalesOpportunity", "RequirementGathering", "MeetingScheduled", "Active"] } }
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

    // 2. Sales Funnel Chart Data (BRD Variant 1: Lead → Opportunity → Deal)
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
        count: await prisma.deal.count({
          where: { AND: [rbacDealFilter, { status: { in: ["SalesOpportunity", "RequirementGathering"] } }] }
        })
      },
      {
        stage: "Meeting Scheduled",
        count: await prisma.deal.count({
          where: { AND: [rbacDealFilter, { status: "MeetingScheduled" }] }
        })
      },
      {
        stage: "Active Deal",
        count: await prisma.deal.count({
          where: { AND: [rbacDealFilter, { status: "Active" }] }
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
        revenueTrend,
        customerScoreTrend: await getCustomerScoreTrendData(userPayload, trendCutoff),
      }
    };
  } catch (error) {
    console.error("GET Sales Analytics Error:", error);
    return { success: false, message: "Failed to fetch sales analytics data" };
  }
}

// ─── Customer Score Trend Data ───────────────────────────────────────────────
// Fetches demoCustomerRating from opportunities over time, aggregates by month.
// Returns array of { label, score } for the line chart. Separate from pipeline.
async function getCustomerScoreTrendData(userPayload: any, trendCutoff: Date): Promise<{ label: string; score: number }[]> {
  try {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize last 6 months with 0
    const scoreMap: { [key: string]: { total: number; count: number } } = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      scoreMap[label] = { total: 0, count: 0 };
    }

    // Query deals with their OpportunityDetail (which holds demoCustomerRating)
    const rbacDealFilter: any = { companyId: userPayload.companyId };
    if (userPayload.role === "SalesExecutive") {
      rbacDealFilter.OR = [
        { assignedUserId: userPayload.id },
        { customer: { assignedUserId: userPayload.id } }
      ];
    }

    const deals = await prisma.deal.findMany({
      where: {
        AND: [
          rbacDealFilter,
          { opportunityDetail: { demoCustomerRating: { not: null } } },
          { updatedAt: { gte: trendCutoff } },
        ],
      },
      select: {
        updatedAt: true,
        opportunityDetail: { select: { demoCustomerRating: true } },
      },
      orderBy: { updatedAt: "asc" },
    });

    // Parse ratings and aggregate by month
    deals.forEach((deal: any) => {
      const rating = deal.opportunityDetail?.demoCustomerRating;
      if (!rating) return;

      // Parse numeric score from string (e.g. "8/10", "8", "4 out of 5", "Excellent")
      let score: number | null = null;
      const numericMatch = rating.match(/(\d+(?:\.\d+)?)/);
      if (numericMatch) {
        score = parseFloat(numericMatch[1]);
        // If score > 10, normalize to 10-scale
        if (score > 10) score = score / 10;
      } else {
        // Word-based ratings
        const lower = rating.toLowerCase();
        if (lower.includes("excellent") || lower.includes("very good")) score = 9;
        else if (lower.includes("good") || lower.includes("satisfied")) score = 7;
        else if (lower.includes("average") || lower.includes("neutral")) score = 5;
        else if (lower.includes("poor") || lower.includes("bad") || lower.includes("dissatisfied")) score = 3;
      }

      if (score === null) return;

      const date = new Date(deal.updatedAt);
      const label = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      if (scoreMap[label]) {
        scoreMap[label].total += score;
        scoreMap[label].count += 1;
      }
    });

    // Convert to ordered array with average scores
    return Object.keys(scoreMap)
      .reverse()
      .map((key) => {
        const { total, count } = scoreMap[key];
        return {
          label: key,
          score: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
        };
      })
      .filter((item) => item.score > 0); // Only show months with data
  } catch (error) {
    console.error("Customer Score Trend Error:", error);
    return [];
  }
}
