import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Aggregated win/loss stats scoped to the user's company.
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const dateFilter: any = {};
  if (fromStr || toStr) {
    dateFilter.updatedAt = {};
    if (fromStr) dateFilter.updatedAt.gte = new Date(fromStr);
    if (toStr) dateFilter.updatedAt.lte = new Date(toStr);
  }

  const baseWhere = { companyId: user.companyId, ...dateFilter };

  // Fetch deals with competitor involvements for per-competitor win/loss
  const [wonCount, lostCount, wonValue, lostValue, dealsWithInvolvements, lostAnalyses] = await Promise.all([
    prisma.deal.count({ where: { ...baseWhere, status: "Won" } }),
    prisma.deal.count({ where: { ...baseWhere, status: "Lost" } }),
    prisma.deal.aggregate({ where: { ...baseWhere, status: "Won" }, _sum: { dealValue: true } }),
    prisma.deal.aggregate({ where: { ...baseWhere, status: "Lost" }, _sum: { dealValue: true } }),
    prisma.deal.findMany({
      where: { ...baseWhere, status: { in: ["Won", "Lost"] } },
      select: {
        id: true, dealName: true, status: true, dealValue: true, updatedAt: true,
        customer: { select: { id: true, name: true, territoryAccounts: { select: { territory: { select: { id: true, name: true } } } } } },
        competitorInvolvements: { select: { competitorId: true, competitor: { select: { id: true, name: true } }, finalResult: true, winLossReasonId: true, winLossReason: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lostDealAnalysis.findMany({
      where: { companyId: user.companyId, ...(dateFilter.updatedAt ? { createdAt: dateFilter.updatedAt } : {}) },
      select: { competitorId: true, lossReasonId: true, competitorWonPrice: true, ourFinalPrice: true, lostReason: true, lessonsLearned: true },
    }),
  ]);

  // Per-competitor win/loss from CompetitorInvolvement
  const competitorStatsMap = new Map<string, { name: string; wins: number; losses: number }>();
  for (const deal of dealsWithInvolvements) {
    for (const inv of deal.competitorInvolvements) {
      if (!inv.competitorId) continue;
      const existing = competitorStatsMap.get(inv.competitorId) || { name: inv.competitor?.name || "Unknown", wins: 0, losses: 0 };
      if (deal.status === "Won") existing.wins++;
      else if (deal.status === "Lost") existing.losses++;
      competitorStatsMap.set(inv.competitorId, existing);
    }
  }

  const winRateByCompetitor = Array.from(competitorStatsMap.entries()).map(([id, s]) => {
    const total = s.wins + s.losses;
    return {
      competitorId: id,
      competitorName: s.name,
      wins: s.wins,
      losses: s.losses,
      total,
      winRate: total > 0 ? Math.round((s.wins / total) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.total - a.total);

  // Loss reason aggregation from LostDealAnalysis
  const lossReasonMap = new Map<string, { name: string; count: number }>();
  for (const la of lostAnalyses) {
    if (la.lossReasonId) {
      const existing = lossReasonMap.get(la.lossReasonId) || { name: "Unknown", count: 0 };
      existing.count++;
      lossReasonMap.set(la.lossReasonId, existing);
    }
  }

  // Win reason aggregation from CompetitorInvolvement on won deals
  const winReasonMap = new Map<string, { name: string; count: number }>();
  for (const deal of dealsWithInvolvements) {
    if (deal.status !== "Won") continue;
    for (const inv of deal.competitorInvolvements) {
      if (inv.winLossReasonId) {
        const existing = winReasonMap.get(inv.winLossReasonId) || { name: inv.winLossReason?.name || "Unknown", count: 0 };
        existing.count++;
        winReasonMap.set(inv.winLossReasonId, existing);
      }
    }
  }

  // Territory stats: best-performing territory by win rate
  const territoryMap = new Map<string, { name: string; wins: number; losses: number }>();
  for (const deal of dealsWithInvolvements) {
    const terr = deal.customer?.territoryAccounts?.[0]?.territory;
    if (!terr) continue;
    const existing = territoryMap.get(terr.id) || { name: terr.name, wins: 0, losses: 0 };
    if (deal.status === "Won") existing.wins++;
    else if (deal.status === "Lost") existing.losses++;
    territoryMap.set(terr.id, existing);
  }

  let bestTerritory: { name: string; winRate: number } | null = null;
  for (const [, s] of territoryMap) {
    const total = s.wins + s.losses;
    if (total < 1) continue;
    const wr = Math.round((s.wins / total) * 1000) / 10;
    if (!bestTerritory || wr > bestTerritory.winRate) {
      bestTerritory = { name: s.name, winRate: wr };
    }
  }

  // Most common win reason
  let mostCommonWinReason = "—";
  let maxWinReasonCount = 0;
  for (const [, s] of winReasonMap) {
    if (s.count > maxWinReasonCount) { maxWinReasonCount = s.count; mostCommonWinReason = s.name; }
  }

  // 6-month trend: win rate per month from deal.updatedAt
  const now = new Date();
  const trend: { month: string; winRate: number; won: number; lost: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthDeals = dealsWithInvolvements.filter(
      (d) => d.updatedAt >= monthStart && d.updatedAt <= monthEnd
    );
    const won = monthDeals.filter((d) => d.status === "Won").length;
    const lost = monthDeals.filter((d) => d.status === "Lost").length;
    const total = won + lost;
    trend.push({
      month: monthStart.toLocaleDateString("en-US", { month: "short" }),
      winRate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
      won,
      lost,
    });
  }

  // Loss reason breakdown for chart
  const byLossReason = Array.from(lossReasonMap.entries()).map(([id, s]) => ({
    lossReasonId: id,
    lossReasonName: s.name,
    lostCount: s.count,
  })).sort((a, b) => b.lostCount - a.lostCount);

  // Deal-level detail for table
  const dealDetails = dealsWithInvolvements.map((d) => ({
    id: d.id,
    dealName: d.dealName,
    status: d.status,
    dealValue: d.dealValue,
    customerName: d.customer?.name || "—",
    territory: d.customer?.territoryAccounts?.[0]?.territory?.name || "—",
    updatedAt: d.updatedAt,
    competitors: d.competitorInvolvements.map((i) => i.competitor?.name).filter(Boolean),
  }));

  const total = wonCount + lostCount;
  const winRate = total > 0 ? Math.round((wonCount / total) * 1000) / 10 : 0;

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        wonCount,
        lostCount,
        wonValue: wonValue._sum.dealValue || 0,
        lostValue: lostValue._sum.dealValue || 0,
        winRate,
        total,
        bestTerritory: bestTerritory?.name || "—",
        bestTerritoryWinRate: bestTerritory?.winRate || 0,
        mostCommonWinReason,
      },
      winRateByCompetitor,
      byLossReason,
      trend,
      dealDetails,
    },
  });
}
