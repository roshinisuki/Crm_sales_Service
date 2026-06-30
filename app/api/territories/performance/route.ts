import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const territories = await prisma.territory.findMany({
    where: { companyId: user.companyId, isActive: true },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      accounts: {
        select: {
          customerId: true,
          customer: {
            select: {
              id: true,
              deals: { where: { status: "Won" }, select: { dealValue: true } },
              customerVisits: { where: { status: "COMPLETED" }, select: { id: true } },
            },
          },
        },
      },
      targets: { select: { id: true, targetType: true, period: true, targetAmount: true, achievedAmount: true } },
    },
  });

  // Get leads count per assigned user
  const userIds = territories.map(t => t.assignedUserId).filter(Boolean) as string[];
  const leadCounts = await prisma.lead.groupBy({
    by: ["assignedUserId"],
    where: { assignedUserId: { in: userIds }, companyId: user.companyId },
    _count: { id: true },
  });
  const leadCountMap = new Map(leadCounts.map(lc => [lc.assignedUserId, lc._count.id]));

  // Get follow-ups done per assigned user
  const followUpCounts = await prisma.followUp.groupBy({
    by: ["assignedUserId"],
    where: { assignedUserId: { in: userIds }, companyId: user.companyId, status: "Completed" },
    _count: { id: true },
  });
  const followUpMap = new Map(followUpCounts.map(fu => [fu.assignedUserId, fu._count.id]));

  const performance = territories.map(t => {
    const customerIds = t.accounts.map(a => a.customerId);
    const wonDealsRevenue = t.accounts.reduce((sum, a) => {
      return sum + a.customer.deals.reduce((s, d) => s + d.dealValue, 0);
    }, 0);
    const completedVisits = t.accounts.reduce((sum, a) => sum + a.customer.customerVisits.length, 0);
    const leadsCount = t.assignedUserId ? (leadCountMap.get(t.assignedUserId) ?? 0) : 0;
    const followUpsDone = t.assignedUserId ? (followUpMap.get(t.assignedUserId) ?? 0) : 0;

    const latestTarget = t.targets[0] ?? null;
    const targetAmount = latestTarget?.targetAmount ?? 0;
    const achievedAmount = latestTarget?.achievedAmount ?? wonDealsRevenue;

    return {
      id: t.id,
      name: t.name,
      region: t.region,
      assignedUser: t.assignedUser,
      leads: leadsCount,
      visits: completedVisits,
      followUpsDone,
      dealsWon: t.accounts.reduce((sum, a) => sum + a.customer.deals.length, 0),
      revenue: wonDealsRevenue,
      targetAmount,
      achievedAmount,
      targetVsAchieved: targetAmount > 0 ? `${Math.round((achievedAmount / targetAmount) * 100)}%` : "—",
      accountCount: customerIds.length,
    };
  });

  return NextResponse.json({ success: true, data: performance });
}
