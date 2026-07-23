import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "GET /api/competitors");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get("isActive");
  const q = searchParams.get("q");

  const where: any = { companyId: user.companyId };
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;
  if (q) where.name = { contains: q };

  const competitors = await prisma.competitor.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      products: { select: { id: true, name: true, priceRange: true, ourAdvantage: true, description: true }, orderBy: { updatedAt: "desc" } },
      _count: { select: { products: true, lostDeals: true } },
      involvements: {
        select: {
          id: true,
          threatLevel: true,
          finalResult: true,
          dealId: true,
          deal: { select: { id: true, status: true, dealValue: true, updatedAt: true } },
          updatedAt: true,
        },
      },
    },
  });

  // Compute per-competitor stats
  const enriched = competitors.map((c) => {
    const involvements = c.involvements ?? [];
    const wins = involvements.filter((i) => i.finalResult === "Win").length;
    const losses = involvements.filter((i) => i.finalResult === "Loss").length;
    const open = involvements.filter((i) => !i.finalResult || i.finalResult === "Open").length;
    const totalDecided = wins + losses;
    const winRate = totalDecided > 0 ? Math.round((wins / totalDecided) * 1000) / 10 : null;

    // Threat level: most severe across involvements
    const threatLevels = involvements.map((i) => i.threatLevel).filter(Boolean);
    let computedThreat = "Low";
    if (threatLevels.includes("High")) computedThreat = "High";
    else if (threatLevels.includes("Medium")) computedThreat = "Medium";

    // Active deals: involvements where deal is not Won/Lost
    const activeDeals = involvements.filter(
      (i) => i.deal && !["Won", "Lost"].includes(i.deal.status)
    ).length;

    // Last activity: most recent involvement or lostDeal or product update
    const lastActivityDates: Date[] = [
      ...involvements.map((i) => i.updatedAt),
      ...involvements.map((i) => i.deal?.updatedAt).filter((d): d is Date => !!d),
    ];
    const lastActivity = lastActivityDates.length ? new Date(Math.max(...lastActivityDates.map((d) => new Date(d).getTime()))) : null;

    // Remove the raw involvements array from response to keep payload lean
    const { involvements: _inv, ...rest } = c;
    return {
      ...rest,
      stats: {
        winRate,
        wins,
        losses,
        openDeals: open,
        activeDeals,
        threatLevel: computedThreat,
        totalInvolvements: involvements.length,
        lastActivity,
      },
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "POST /api/competitors");
  if (guard) return guard;

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });

  const competitor = await prisma.competitor.create({
    data: {
      name: body.name,
      website: body.website || null,
      description: body.description || null,
      strengths: body.strengths || null,
      weaknesses: body.weaknesses || null,
      isActive: body.isActive !== false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: competitor });
}
