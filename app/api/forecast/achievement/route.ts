import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const forecastType = searchParams.get("forecastType") || "Revenue";
  const assignedUserId = searchParams.get("assignedUserId") || "";

  // Fetch forecast entries for the year
  const whereEntry: any = { companyId: user.companyId, year, forecastType };
  if (assignedUserId) whereEntry.assignedUserId = assignedUserId;

  const entries = await prisma.forecastEntry.findMany({ where: whereEntry });

  // For each month, calculate achievedAmount from accepted quotations
  const result: any[] = [];

  for (let month = 1; month <= 12; month++) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const whereQuotation: any = {
      status: "Accepted",
      acceptedAt: { gte: monthStart, lte: monthEnd },
      companyId: user.companyId,
      deletedAt: null,
    };

    if (assignedUserId) {
      whereQuotation.createdById = assignedUserId;
    }

    const agg = await prisma.quotation.aggregate({
      where: whereQuotation,
      _sum: { finalAmount: true },
    });

    const achievedAmount = agg._sum.finalAmount || 0;
    const entry = entries.find((e) => e.month === month);
    const targetAmount = entry?.targetAmount || 0;
    const gap = achievedAmount - targetAmount;
    const achievementPercent = targetAmount > 0 ? Math.round((achievedAmount / targetAmount) * 1000) / 10 : 0;

    // Update achievedAmount on the forecast entry
    if (entry) {
      await prisma.forecastEntry.update({
        where: { id: entry.id },
        data: { achievedAmount },
      });
    }

    result.push({
      month,
      monthName: new Date(year, month - 1).toLocaleString("en-US", { month: "short" }),
      targetAmount,
      achievedAmount,
      gap,
      achievementPercent,
    });
  }

  return NextResponse.json({ success: true, data: result });
}
