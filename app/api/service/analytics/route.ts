import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    
    // For scoped view, filter by the engineer's user ID
    let engineerFilter: any = {};
    if (scope === 'me') {
      const engineer = await prisma.serviceEngineer.findFirst({
        where: { userId: user.id }
      });
      if (engineer) {
        engineerFilter = { assignedEngineerId: engineer.id };
      } else {
         // User is not an engineer, return empty stats for 'me'
        engineerFilter = { assignedEngineerId: 'NONE' }; 
      }
    }

    const [requests, complaints, defects] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: engineerFilter,
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.complaint.findMany({
        where: engineerFilter,
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.defect.findMany({
        where: engineerFilter,
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      })
    ]);

    const allTickets = [...requests, ...complaints, ...defects];

    // 1. Ticket volume over time (monthly count for all time)
    const volumeMap = new Map<string, number>();
    allTickets.forEach(t => {
      const created = new Date(t.createdAt);
      // Group by YYYY-MM
      const yearMonth = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      volumeMap.set(yearMonth, (volumeMap.get(yearMonth) || 0) + 1);
    });

    const ticketVolume = Array.from(volumeMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Resolution time distribution
    const resolutionTime = {
      '0-2h': 0,
      '2-6h': 0,
      '6-12h': 0,
      '12h+': 0
    };

    allTickets.forEach(t => {
      if ((t.status?.name === 'Closed' || t.status?.name === 'Resolved' || t.status?.name === 'Completed') && t.closedAt) {
        const hours = Math.abs(new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        if (hours <= 2) resolutionTime['0-2h']++;
        else if (hours <= 6) resolutionTime['2-6h']++;
        else if (hours <= 12) resolutionTime['6-12h']++;
        else resolutionTime['12h+']++;
      }
    });

    // 3. SLA aggregation (Resolved only) & Avg Resolution Time
    const slaStatus = {
      met: 0,
      breached: 0
    };

    let totalResolutionHours = 0;
    let resolvedTicketsWithTime = 0;

    allTickets.forEach(t => {
      const isResolved = (t.status?.name === 'Closed' || t.status?.name === 'Resolved' || t.status?.name === 'Completed');
      
      if (isResolved && t.closedAt) {
        const limitHours = t.priority?.slaLimitHours || 24;
        const createdTime = new Date(t.createdAt).getTime();
        const closedTime = new Date(t.closedAt).getTime();
        const durationHours = Math.abs(closedTime - createdTime) / (1000 * 60 * 60);
        
        totalResolutionHours += durationHours;
        resolvedTicketsWithTime++;

        if (durationHours <= limitHours) {
          slaStatus.met++;
        } else {
          slaStatus.breached++;
        }
      }
    });

    const avgResolutionTimeHrs = resolvedTicketsWithTime > 0 
      ? (totalResolutionHours / resolvedTicketsWithTime).toFixed(1) 
      : "-";

    return NextResponse.json({
      ticketVolume,
      resolutionTime,
      slaStatus,
      totalRequests: allTickets.length,
      resolvedCount: allTickets.filter(t => t.status?.name === 'Closed' || t.status?.name === 'Resolved' || t.status?.name === 'Completed').length,
      avgResolutionTimeHrs
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
