import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

function getPeriodDateRange(targetType: string, period: string): { start: Date; end: Date } {
  if (targetType === "Monthly") {
    const [year, month] = period.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  } else if (targetType === "Quarterly") {
    const [yearStr, qStr] = period.split("-Q");
    const year = parseInt(yearStr);
    const q = parseInt(qStr);
    const startMonth = (q - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  } else {
    const year = parseInt(period);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
}

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TARGETS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/targets/achievement");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const year = searchParams.get("year");
  const userId = searchParams.get("userId");
  const territoryId = searchParams.get("territoryId");

  const where: any = { companyId: user.companyId };
  if (targetType) where.targetType = targetType;
  if (userId) where.assignedUserId = userId;
  if (territoryId) where.territoryId = territoryId;
  if (year) where.period = { contains: year };

  const targets = await prisma.salesTarget.findMany({
    where,
    orderBy: { period: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true, region: true } },
    },
  });

  // Recalculate achieved amounts from approved POs
  const results = await Promise.all(targets.map(async (t) => {
    const { start, end } = getPeriodDateRange(t.targetType, t.period);

    const poWhere: any = {
      status: "Approved",
      approvedAt: { gte: start, lte: end },
      companyId: user.companyId,
    };
    if (t.assignedUserId) {
      poWhere.assignedUserId = t.assignedUserId;
    }

    const approvedPOs = await prisma.purchaseOrder.findMany({
      where: poWhere,
      select: { finalAmount: true, totalAmount: true },
    });

    const achieved = approvedPOs.reduce((sum, po) => sum + (po.finalAmount || po.totalAmount || 0), 0);
    const gap = t.targetAmount - achieved;
    const achievementPct = t.targetAmount > 0 ? Math.round((achieved / t.targetAmount) * 100) : 0;
    const status = achievementPct >= 100 ? "Achieved" : achievementPct >= 80 ? "On Track" : achievementPct >= 50 ? "Behind" : "At Risk";

    return {
      ...t,
      achievedAmount: achieved,
      gap,
      achievementPct,
      status,
    };
  }));

  return NextResponse.json({ success: true, data: results });
}
