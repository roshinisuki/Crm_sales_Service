import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const competitorId = searchParams.get("competitorId");

  const dateFilter: any = {};
  if (fromStr || toStr) {
    dateFilter.createdAt = {};
    if (fromStr) dateFilter.createdAt.gte = new Date(fromStr);
    if (toStr) dateFilter.createdAt.lte = new Date(toStr);
  }

  const where: any = { companyId: user.companyId, ...dateFilter };
  if (competitorId) where.competitorId = competitorId;

  const lostAnalyses = await prisma.lostDealAnalysis.findMany({
    where,
    include: {
      competitor: { select: { id: true, name: true } },
      lossReason: { select: { id: true, name: true } },
      deal: { select: { id: true, dealName: true, dealValue: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate by competitor
  const competitorMap = new Map<string, {
    competitorName: string;
    lostCount: number;
    avgTheirPrice: number;
    avgOurPrice: number;
    priceCount: number;
    lossReasons: Map<string, number>;
  }>();

  lostAnalyses.forEach(la => {
    const key = la.competitorId || "unknown";
    const existing = competitorMap.get(key) || {
      competitorName: la.competitor?.name || "Unknown",
      lostCount: 0,
      avgTheirPrice: 0,
      avgOurPrice: 0,
      priceCount: 0,
      lossReasons: new Map<string, number>(),
    };
    existing.lostCount++;
    if (la.competitorWonPrice) { existing.avgTheirPrice += la.competitorWonPrice; existing.priceCount++; }
    if (la.ourFinalPrice) { existing.avgOurPrice += la.ourFinalPrice; }
    const reasonName = la.lossReason?.name || "Unknown";
    existing.lossReasons.set(reasonName, (existing.lossReasons.get(reasonName) || 0) + 1);
    competitorMap.set(key, existing);
  });

  const byCompetitor = Array.from(competitorMap.entries()).map(([id, v]) => {
    const theirAvg = v.priceCount > 0 ? v.avgTheirPrice / v.priceCount : 0;
    const ourAvg = v.priceCount > 0 ? v.avgOurPrice / v.priceCount : 0;
    const priceGapPct = theirAvg > 0 ? Math.round(((theirAvg - ourAvg) / theirAvg) * 100) : 0;
    const topReason = Array.from(v.lossReasons.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      competitorId: id,
      competitorName: v.competitorName,
      lostCount: v.lostCount,
      avgTheirPrice: theirAvg,
      avgOurPrice: ourAvg,
      priceGapPct,
      mostCommonLossReason: topReason ? topReason[0] : "—",
    };
  }).sort((a, b) => b.lostCount - a.lostCount);

  // Summary
  const totalLost = lostAnalyses.length;
  const topCompetitor = byCompetitor[0]?.competitorName || "—";
  const allPriceGaps = byCompetitor.filter(c => c.priceGapPct !== 0).map(c => c.priceGapPct);
  const avgPriceGapPct = allPriceGaps.length > 0 ? Math.round(allPriceGaps.reduce((s, g) => s + g, 0) / allPriceGaps.length) : 0;

  // Get all competitors for dropdown
  const allCompetitors = await prisma.competitor.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: {
      summary: { totalLost, topCompetitor, avgPriceGapPct },
      byCompetitor,
      details: lostAnalyses,
      competitors: allCompetitors,
    },
  });
}
