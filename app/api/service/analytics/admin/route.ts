import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [requests, complaints, defects, installations, visits, activeEngineers, activeAmc] = await Promise.all([
      prisma.serviceRequest.findMany({
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.complaint.findMany({
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.defect.findMany({
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.installation.findMany({
        select: { id: true, createdAt: true, closedAt: true, status: { select: { name: true } }, priority: { select: { slaLimitHours: true } } }
      }),
      prisma.serviceVisit.findMany({
        select: { id: true, createdAt: true, completedAt: true, status: { select: { name: true } } }
      }),
      prisma.serviceEngineer.count({
        where: { isActive: true }
      }),
      prisma.aMCContract.count({
        where: { status: { name: 'Active' } }
      })
    ]);

    const isResolved = (statusName: string | undefined) => 
      statusName === 'Closed' || statusName === 'Resolved' || statusName === 'Completed';

    const processModule = (items: any[], isVisit = false) => {
      let openCount = 0;
      let totalResHours = 0;
      let resCount = 0;
      let slaMet = 0;
      let slaTotal = 0;
      let escalations = 0;

      items.forEach(item => {
        const status = item.status?.name;
        if (!isResolved(status)) {
          openCount++;
          if (status?.includes('Escalated')) escalations++;
        }

        if (isResolved(status)) {
          const closed = isVisit ? item.completedAt : item.closedAt;
          if (closed) {
            const duration = Math.abs(new Date(closed).getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
            totalResHours += duration;
            resCount++;

            if (!isVisit) {
              slaTotal++;
              if (duration <= (item.priority?.slaLimitHours || 24)) {
                slaMet++;
              }
            }
          }
        }
      });

      return {
        openCount,
        escalations,
        avgResTime: resCount > 0 ? (totalResHours / resCount).toFixed(1) : "-",
        slaCompliance: slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : null
      };
    };

    const rStats = processModule(requests);
    const cStats = processModule(complaints);
    const dStats = processModule(defects);
    const iStats = processModule(installations);
    const vStats = processModule(visits, true);

    const totalOpen = rStats.openCount + cStats.openCount + dStats.openCount + iStats.openCount + vStats.openCount;
    const totalEscalations = rStats.escalations + cStats.escalations + dStats.escalations + iStats.escalations + vStats.escalations;

    const moduleHealth = [
      { name: "Requests", ...rStats },
      { name: "Complaints", ...cStats },
      { name: "Defects", ...dStats },
      { name: "Installations", ...iStats },
      { name: "Visits", ...vStats, slaCompliance: "-" } // Visits don't typically have SLA limits tracked exactly the same way here
    ];

    return NextResponse.json({
      kpis: {
        totalOpen,
        totalEscalations,
        activeEngineers,
        activeAmc
      },
      moduleHealth
    });

  } catch (error: any) {
    console.error("Error fetching admin analytics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
