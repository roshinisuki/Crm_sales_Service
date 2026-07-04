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
            where: { status: "COMPLETED", deletedAt: null },
            orderBy: { checkInTime: "desc" },
            take: 1,
            select: {
              checkInTime: true,
              outcomeType: true,
              outcomeNotes: true,
              visitType: true,
              locationVerified: true,
              outcomeNotes: true,
            },
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

  // Also fetch upcoming planned visits for these key account customers
  const keyAccountCustomerIds = keyAccounts.map((ka: any) => ka.customerId).filter(Boolean);
  const plannedVisits = keyAccountCustomerIds.length > 0
    ? await prisma.customerVisit.findMany({
        where: {
          customerId: { in: keyAccountCustomerIds },
          status: "PLANNED",
          deletedAt: null,
          plannedDate: { gte: new Date() },
        },
        orderBy: { plannedDate: "asc" },
        select: {
          id: true,
          customerId: true,
          plannedDate: true,
          plannedTime: true,
          purpose: true,
          visitType: true,
          hostedBy: true,
          host: { select: { id: true, name: true } },
        },
      })
    : [];

  // Build a map of customerId -> next planned visit
  const plannedVisitMap = new Map<string, any>();
  for (const pv of plannedVisits) {
    if (!plannedVisitMap.has(pv.customerId)) {
      plannedVisitMap.set(pv.customerId, pv);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data = (keyAccounts as any[])
    .filter(ka => ka.customer?.followUps?.length > 0 || ka.customer?.customerVisits?.length > 0 || ka.nextReviewDate || plannedVisitMap.has(ka.customerId))
    .map(ka => {
      const nextReview = ka.nextReviewDate ? new Date(ka.nextReviewDate) : null;
      const nextMeeting = ka.customer.followUps[0]?.nextMeetingDate ? new Date(ka.customer.followUps[0].nextMeetingDate) : null;
      const plannedVisit = plannedVisitMap.get(ka.customerId);
      const plannedVisitDate = plannedVisit?.plannedDate ? new Date(plannedVisit.plannedDate) : null;

      // Determine the earliest upcoming date for week grouping
      const upcomingDates = [nextReview, nextMeeting, plannedVisitDate].filter((d): d is Date => !!d && d >= today);
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
        lastOutcomeNotes: ka.customer.customerVisits[0]?.outcomeNotes || null,
        lastVisitType: ka.customer.customerVisits[0]?.visitType || null,
        lastLocationVerified: ka.customer.customerVisits[0]?.locationVerified ?? null,
        nextMeetingDate: ka.customer.followUps[0]?.nextMeetingDate || null,
        nextMeetingPurpose: ka.customer.followUps[0]?.visitType || ka.customer.followUps[0]?.type || null,
        plannedVisitId: plannedVisit?.id || null,
        plannedVisitDate: plannedVisit?.plannedDate || null,
        plannedVisitTime: plannedVisit?.plannedTime || null,
        plannedVisitPurpose: plannedVisit?.purpose || null,
        plannedVisitType: plannedVisit?.visitType || null,
        plannedVisitHost: plannedVisit?.host?.name || null,
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
