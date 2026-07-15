import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday start
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const allVisits = await prisma.serviceVisit.findMany({
      include: {
        status: true,
        engineer: { include: { user: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    // Determine the "Scheduled" and "Completed" status IDs
    const scheduledStatuses = allVisits.filter(v => v.status.name === "Scheduled" || v.status.name === "Assigned");
    const completedVisits = allVisits.filter(v => v.status.name === "Completed" || v.status.name === "Closed");

    // Overdue = Scheduled + scheduledDate has passed
    const overdueVisits = scheduledStatuses.filter(v => {
      if (!v.scheduledDate) return false;
      return new Date(v.scheduledDate) < now;
    });

    // Scheduled today
    const scheduledToday = scheduledStatuses.filter(v => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      return d >= startOfToday && d < endOfToday;
    });

    // Upcoming this week (scheduled, future, within this week)
    const upcomingThisWeek = scheduledStatuses.filter(v => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      return d >= now && d < endOfWeek;
    });

    // Completed this month
    const completedThisMonth = completedVisits.filter(v => {
      const d = v.completedAt || v.checkOutTime || v.updatedAt;
      return d >= startOfMonth && d < endOfMonth;
    });

    return NextResponse.json({
      total: allVisits.length,
      scheduledToday: scheduledToday.length,
      upcomingThisWeek: upcomingThisWeek.length,
      overdue: overdueVisits.length,
      completedThisMonth: completedThisMonth.length,
    });
  } catch (error: any) {
    console.error("Error fetching visit stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
