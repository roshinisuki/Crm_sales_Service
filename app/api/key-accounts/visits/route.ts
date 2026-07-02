import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  return startOfWeek.toISOString().split("T")[0];
}

function getWeekLabel(weekKey: string): string {
  const start = new Date(weekKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export async function GET(_request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const keyAccounts = await prisma.keyAccount.findMany({
    where: { companyId: user.companyId },
    include: {
      customer: {
        select: {
          id: true, name: true,
          customerVisits: {
            where: { status: "COMPLETED" },
            orderBy: { checkInTime: "desc" },
            take: 1,
            select: { checkInTime: true, outcomeType: true },
          },
          followUps: {
            where: { nextMeetingDate: { gte: new Date() }, status: "Pending" },
            orderBy: { nextMeetingDate: "asc" },
            take: 1,
            select: { nextMeetingDate: true, visitType: true, type: true },
          },
        },
      },
      accountManager: { select: { id: true, name: true, role: true } },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data = (keyAccounts as any[])
    .filter(ka => ka.customer?.followUps?.length > 0 || ka.customer?.customerVisits?.length > 0 || ka.nextReviewDate)
    .map(ka => {
      const nextReview = ka.nextReviewDate ? new Date(ka.nextReviewDate) : null;
      const nextMeeting = ka.customer.followUps[0]?.nextMeetingDate ? new Date(ka.customer.followUps[0].nextMeetingDate) : null;

      // Determine the earliest upcoming date for week grouping
      const upcomingDates = [nextReview, nextMeeting].filter((d): d is Date => !!d && d >= today);
      const earliestDate = upcomingDates.length > 0 ? new Date(Math.min(...upcomingDates.map(d => d.getTime()))) : null;

      const isOverdue = nextReview ? nextReview < today : false;

      return {
        id: ka.id,
        customerId: ka.customer.id,
        customerName: ka.customer.name,
        accountManager: ka.accountManager?.name || "—",
        accountManagerRole: ka.accountManager?.role || "—",
        nextReviewDate: ka.nextReviewDate,
        isOverdue,
        lastVisitDate: ka.customer.customerVisits[0]?.checkInTime || null,
        lastOutcome: ka.customer.customerVisits[0]?.outcomeType || "—",
        nextMeetingDate: ka.customer.followUps[0]?.nextMeetingDate || null,
        nextMeetingPurpose: ka.customer.followUps[0]?.visitType || ka.customer.followUps[0]?.type || null,
        weekKey: earliestDate ? getWeekKey(earliestDate) : isOverdue ? "overdue" : "unscheduled",
        weekLabel: earliestDate ? getWeekLabel(getWeekKey(earliestDate)) : isOverdue ? "Overdue" : "Unscheduled",
        earliestDate,
      };
    })
    .sort((a, b) => {
      // Overdue first, then by earliest date
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      const aDate = a.earliestDate?.getTime() ?? Infinity;
      const bDate = b.earliestDate?.getTime() ?? Infinity;
      return aDate - bDate;
    });

  return NextResponse.json({ success: true, data });
}
