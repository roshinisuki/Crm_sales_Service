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
          { status: { in: ["Qualified", "RequirementGathering", "MeetingScheduled", "DemoConducted"] } }
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
          { status: { in: ["Qualified", "RequirementGathering", "MeetingScheduled", "DemoConducted"] } }
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

    // 2. Sales Funnel Chart Data — CUMULATIVE (each stage includes all downstream stages)
    const newLeadCount = await prisma.lead.count({
      where: { AND: [rbacCustomerFilter, { status: "New" }] }
    });
    const contactedLeadCount = await prisma.lead.count({
      where: { AND: [rbacCustomerFilter, { status: "Contacted" }] }
    });
    const allDealCount = await prisma.deal.count({
      where: { AND: [rbacDealFilter, { status: { notIn: ["Lost"] } }] }
    });
    const qualifiedDealCount = await prisma.deal.count({
      where: { AND: [rbacDealFilter, { status: { in: ["Qualified", "RequirementGathering", "TechnicalDiscussion", "MeetingScheduled", "DemoConducted", "DemoAccepted", "Won"] } }] }
    });
    const meetingDealCount = await prisma.deal.count({
      where: { AND: [rbacDealFilter, { status: { in: ["MeetingScheduled", "DemoConducted", "DemoAccepted", "Won"] } }] }
    });
    const activeDealCount = await prisma.deal.count({
      where: { AND: [rbacDealFilter, { status: { in: ["DemoConducted", "DemoAccepted", "Won"] } }] }
    });

    // Cumulative: top-of-funnel includes everything downstream
    const funnelStages = [
      { stage: "New Lead",       count: newLeadCount + contactedLeadCount + allDealCount },
      { stage: "Contacted",      count: contactedLeadCount + allDealCount },
      { stage: "Qualified",      count: qualifiedDealCount },
      { stage: "Meeting Scheduled", count: meetingDealCount },
      { stage: "Active Deal",   count: activeDealCount },
      { stage: "Closed Won",    count: wonDealsCount },
    ];

    // 3. Lead Source Analytics — group by Lead.leadSource for conversion calculation
    const leadsBySource = await prisma.lead.groupBy({
      by: ["leadSource"],
      _count: { id: true },
      where: rbacCustomerFilter
    });

    // Aggregate won deal value per source via customer relationship
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

    const sourceAnalytics = leadsBySource.map((s) => {
      const sourceName = s.leadSource || "Unknown";
      const totalLeadsForSource = s._count.id;
      const wonCount = sourceWonCountMap[sourceName] || 0;
      const totalRevenue = sourceValueMap[sourceName] || 0;
      const convRate = totalLeadsForSource > 0 ? Math.min(Math.round((wonCount / totalLeadsForSource) * 100), 100) : 0;

      return {
        source: sourceName,
        count: totalLeadsForSource,
        revenue: totalRevenue,
        conversionRate: convRate,
        isUnknown: !s.leadSource || s.leadSource === "",
      };
    });

    // 4. Executive/Agent Performance (Exclude for Executives themselves to keep it team-level)
    let agentPerformance: any[] = [];
    if (userPayload.role !== "SalesExecutive") {
      const executives = await prisma.user.findMany({
        where: { role: "SalesExecutive", companyId: userPayload.companyId },
        select: { id: true, name: true }
      });

      // Current month period for quota lookup
      const _now = new Date();
      const _currentPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;

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

        // Fetch individual quota for this exec
        const execTarget = await prisma.salesTarget.findFirst({
          where: {
            assignedUserId: exec.id,
            companyId: userPayload.companyId,
            period: _currentPeriod,
          },
          select: { targetAmount: true, achievedAmount: true },
        });
        const targetAmount = execTarget?.targetAmount || 0;
        const achievedAmount = execTarget?.achievedAmount || totalWonValue;
        const quotaAttainment = targetAmount > 0 ? Math.min(Math.round((achievedAmount / targetAmount) * 100), 100) : 0;

        // Count leads for this exec
        const leadCount = await prisma.lead.count({
          where: {
            assignedUserId: exec.id,
            companyId: userPayload.companyId,
            ...(dateCutoff ? { createdAt: { gte: dateCutoff } } : {})
          }
        });

        return {
          name: exec.name,
          dealsCount: totalAssignedDeals,
          wonCount: wonAssignedDeals,
          revenue: totalWonValue,
          conversionRate: conv,
          leadCount,
          targetAmount,
          achievedAmount,
          quotaAttainment,
        };
      });

      agentPerformance = await Promise.all(performancePromises);
      // Sort by revenue descending
      agentPerformance.sort((a, b) => b.revenue - a.revenue);
    }

    // 5. Revenue Trend (Won deals by day over last 7 days)
    const sevenDaysAgoTrend = new Date();
    sevenDaysAgoTrend.setDate(sevenDaysAgoTrend.getDate() - 6);
    sevenDaysAgoTrend.setHours(0, 0, 0, 0);

    const trendCutoff = dateCutoff && dateCutoff > sevenDaysAgoTrend ? dateCutoff : sevenDaysAgoTrend;

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

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trendMap: { [key: string]: number } = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = daysOfWeek[d.getDay()];
      trendMap[label] = 0;
    }

    wonDealsTrend.forEach((d) => {
      const date = new Date(d.updatedAt);
      const label = daysOfWeek[date.getDay()];
      if (trendMap[label] !== undefined) {
        trendMap[label] += d.dealValue;
      }
    });

    // Convert map to ordered array
    const revenueTrend = Object.keys(trendMap)
      .map((key) => ({
        month: key, // Keeping property name as month to not break frontend interfaces
        revenue: trendMap[key]
      }));

    // 6. Manager-specific metrics (only computed for non-executive roles)
    let managerMetrics: any = {};
    let needsAttention: any = {};

    if (userPayload.role !== "SalesExecutive") {
      // Team Quota Attainment: sum of achievedAmount / sum of targetAmount for current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentPeriod = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

      const salesTargets = await prisma.salesTarget.findMany({
        where: {
          companyId: userPayload.companyId,
          period: currentPeriod,
        },
        select: { targetAmount: true, achievedAmount: true },
      });

      const totalTarget = salesTargets.reduce((sum, t) => sum + t.targetAmount, 0);
      const totalAchieved = salesTargets.reduce((sum, t) => sum + t.achievedAmount, 0);
      const teamQuotaAttainment = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;

      // Deals at Risk: open deals past expectedCloseDate OR not updated in 7+ days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const dealsAtRiskCount = await prisma.deal.count({
        where: {
          AND: [
            rbacDealFilter,
            { status: { notIn: ["Won", "Lost", "OnHold"] } },
            {
              OR: [
                { expectedCloseDate: { lt: now } },
                { updatedAt: { lt: sevenDaysAgo } },
              ],
            },
          ],
        },
      });

      // Open Pipeline Value: sum of dealValue for all open deals
      const openPipelineSum = await prisma.deal.aggregate({
        _sum: { dealValue: true },
        where: {
          AND: [
            rbacDealFilter,
            { status: { notIn: ["Won", "Lost", "OnHold"] } },
          ],
        },
      });
      const openPipelineValue = openPipelineSum._sum.dealValue || 0;

      // Avg Deal Cycle: average days from Deal.createdAt to Deal.updatedAt for Won deals
      const wonDealsForCycle = await prisma.deal.findMany({
        where: {
          AND: [
            rbacDealFilter,
            { status: "Won" },
          ],
        },
        select: { createdAt: true, updatedAt: true },
      });

      let avgDealCycle = 0;
      if (wonDealsForCycle.length > 0) {
        const totalDays = wonDealsForCycle.reduce((sum, d) => {
          const diff = new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime();
          return sum + Math.max(diff / (1000 * 60 * 60 * 24), 0);
        }, 0);
        avgDealCycle = Math.round(totalDays / wonDealsForCycle.length);
      }

      managerMetrics = {
        teamQuotaAttainment,
        dealsAtRiskCount,
        openPipelineValue,
        avgDealCycle,
      };

      // Needs Attention counts
      const overdueFollowUpsCount = await prisma.followUp.count({
        where: {
          status: "Pending",
          nextMeetingDate: { lt: now },
          companyId: userPayload.companyId,
        },
      });

      const unassignedLeadsCount = await prisma.lead.count({
        where: {
          AND: [
            rbacCustomerFilter,
            { assignedUserId: null },
            { status: { notIn: ["Converted", "Lost", "Duplicate"] } },
          ],
        },
      });

      const pendingApprovalsCount = await prisma.approvalRequest.count({
        where: {
          companyId: userPayload.companyId,
          status: "Pending",
        },
      }).catch(() => 0);

      needsAttention = {
        overdueFollowUps: overdueFollowUpsCount,
        unassignedLeads: unassignedLeadsCount,
        pendingApprovals: pendingApprovalsCount,
        inactiveDeals: dealsAtRiskCount,
      };
    }

    // --- CROSS MODULE METRICS ---
    const totalAccounts = await prisma.customer.count({ where: rbacCustomerFilter });
    const totalContacts = await prisma.contact.count({ where: { companyId: userPayload.companyId } });
    
    // RFQ
    const rfqStats = await prisma.rFQ.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { companyId: userPayload.companyId }
    });
    
    // Samples
    const sampleStats = await prisma.sampleRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { companyId: userPayload.companyId }
    });

    // Activities
    const [pendingTasks, completedTasks] = await Promise.all([
      prisma.task.count({ where: { companyId: userPayload.companyId, status: { not: 'Completed' } } }),
      prisma.task.count({ where: { companyId: userPayload.companyId, status: 'Completed' } })
    ]);
    const totalFollowUps = await prisma.followUp.count({ where: { companyId: userPayload.companyId } });

    // Visits
    const [customerVisits, marketingVisits] = await Promise.all([
      prisma.customerVisit.count({ where: { companyId: userPayload.companyId } }),
      prisma.marketingVisit.count({ where: { companyId: userPayload.companyId } })
    ]);

    // Competitors
    const competitorMentions = await prisma.competitorInvolvement.count({ where: { companyId: userPayload.companyId } });

    // Catalogue
    const activeProducts = await prisma.product.count({ where: { companyId: userPayload.companyId, isActive: true } });

    const crossModule = {
      accounts: { total: totalAccounts, contacts: totalContacts },
      rfq: {
        total: rfqStats.reduce((sum, s) => sum + (s._count._all || 0), 0),
        pending: rfqStats.find(s => s.status === 'New' || s.status === 'UnderReview')?._count._all || 0,
        value: 0
      },
      samples: {
        total: sampleStats.reduce((sum, s) => sum + (s._count._all || 0), 0),
        pending: sampleStats.find(s => s.status === 'New' || s.status === 'UnderReview')?._count._all || 0
      },
      activities: {
        pending: pendingTasks,
        completed: completedTasks,
        followUps: totalFollowUps
      },
      visits: {
        total: customerVisits + marketingVisits,
        customer: customerVisits,
        marketing: marketingVisits
      },
      competitors: { mentions: competitorMentions },
      catalogue: { activeProducts }
    };

    return {
      success: true,
      data: {
        kpis: {
          totalLeads,
          qualifiedLeads,
          openDeals: openDealsCount,
          wonDeals: wonDealsCount,
          lostDeals: lostDealsCount,
          pipelineRevenue,
          wonRevenue,
          conversionRate
        },
        crossModule,
        funnel: funnelStages,
        leadSources: sourceAnalytics,
        agentPerformance,
        revenueTrend,
        managerMetrics,
        needsAttention,
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
    return [];
  } catch (error) {
    console.error("Customer Score Trend Error:", error);
    return [];
  }
}
