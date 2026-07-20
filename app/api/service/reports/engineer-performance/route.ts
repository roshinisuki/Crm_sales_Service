import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const engineers = await prisma.serviceEngineer.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Gather all tickets assigned to engineers
    const [requests, complaints, defects, installations, visits, reviews] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: { assignedEngineerId: { in: engineers.map(e => e.id) } },
        select: { id: true, assignedEngineerId: true, statusId: true, createdAt: true, closedAt: true, priority: { select: { slaLimitHours: true } } },
      }),
      prisma.complaint.findMany({
        where: { assignedEngineerId: { in: engineers.map(e => e.id) } },
        select: { id: true, assignedEngineerId: true, statusId: true, createdAt: true, closedAt: true, priority: { select: { slaLimitHours: true } } },
      }),
      prisma.defect.findMany({
        where: { assignedEngineerId: { in: engineers.map(e => e.id) } },
        select: { id: true, assignedEngineerId: true, statusId: true, createdAt: true, closedAt: true, priority: { select: { slaLimitHours: true } } },
      }),
      prisma.installation.findMany({
        where: { assignedEngineerId: { in: engineers.map(e => e.id) } },
        select: { id: true, assignedEngineerId: true, statusId: true, createdAt: true, closedAt: true, priority: { select: { slaLimitHours: true } } },
      }),
      prisma.serviceVisit.findMany({
        where: { engineerId: { in: engineers.map(e => e.id) } },
        include: { status: { select: { name: true } } },
      }),
      prisma.serviceReview.findMany({
        where: { engineerId: { in: engineers.map(e => e.id) }, status: "Submitted" },
        select: { engineerId: true, rating: true },
      }),
    ]);

    // Fetch all statuses for quick lookup
    const allStatuses = await prisma.serviceStatus.findMany();
    const statusMap = new Map(allStatuses.map(s => [s.id, s.name]));

    const result = engineers.map(eng => {
      const engRequests = requests.filter(r => r.assignedEngineerId === eng.id);
      const engComplaints = complaints.filter(c => c.assignedEngineerId === eng.id);
      const engDefects = defects.filter(d => d.assignedEngineerId === eng.id);
      const engInstallations = installations.filter(i => i.assignedEngineerId === eng.id);
      const engVisits = visits.filter(v => v.engineerId === eng.id);
      const engReviews = reviews.filter(r => r.engineerId === eng.id);

      const allTickets = [...engRequests, ...engComplaints, ...engDefects, ...engInstallations];
      const assigned = allTickets.length;
      const resolved = allTickets.filter(t => {
        const sName = statusMap.get(t.statusId);
        return sName === "Closed" || sName === "Resolved" || sName === "Completed";
      }).length;

      // SLA met: closed within slaLimitHours
      let slaMet = 0;
      let slaTotal = 0;
      let totalResolutionHours = 0;
      let resolvedTicketsWithTime = 0;

      for (const t of allTickets) {
        const sName = statusMap.get(t.statusId);
        if (sName === "Closed" || sName === "Resolved" || sName === "Completed") {
          slaTotal++;
          
          if (t.closedAt) {
            const created = new Date(t.createdAt).getTime();
            const closed = new Date(t.closedAt).getTime();
            const slaHours = t.priority?.slaLimitHours || 24;
            const durationHrs = Math.abs(closed - created) / (1000 * 60 * 60);
            
            totalResolutionHours += durationHrs;
            resolvedTicketsWithTime++;
            
            if (durationHrs <= slaHours) {
              slaMet++;
            }
          }
        }
      }
      
      const slaMetRate = slaTotal > 0 ? `${Math.round((slaMet / slaTotal) * 100)}%` : "-";
      const completedVisits = engVisits.filter(v => v.status?.name === "Completed" || v.status?.name === "Closed").length;

      const avgRating = engReviews.length > 0
        ? (engReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / engReviews.length).toFixed(1)
        : "-";

      const avgResolutionTimeHrs = resolvedTicketsWithTime > 0 
        ? (totalResolutionHours / resolvedTicketsWithTime).toFixed(1) 
        : "-";

      return {
        id: eng.id,
        name: eng.user?.name || "Unknown",
        team: eng.team?.name || "Unassigned",
        assigned,
        resolved,
        slaMet: slaMetRate,
        completedVisits,
        avgRating,
        totalReviews: engReviews.length,
        avgResolutionTimeHrs,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching engineer performance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
