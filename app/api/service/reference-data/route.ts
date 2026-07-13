import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get("module") || "Request";

    const [customers, assets, categories, priorities, statuses, teams, engineers, complaintTypes, defectTypes] = await Promise.all([
      prisma.customer.findMany({ select: { id: true, name: true, customerCode: true } }),
      prisma.customerAsset.findMany({ select: { id: true, productName: true, serialNumber: true, customerId: true } }),
      prisma.serviceCategory.findMany({ select: { id: true, name: true } }),
      prisma.priorityLevel.findMany({ select: { id: true, name: true, color: true } }),
      (async () => {
        const statusSelect = { id: true, name: true, color: true } as const;
        let statuses = await prisma.serviceStatus.findMany({
          where: moduleName ? { module: moduleName } : undefined,
          select: statusSelect,
          orderBy: { order: "asc" }
        });
        // Fallback: if no module-specific statuses, return all active statuses
        if (statuses.length === 0) {
          statuses = await prisma.serviceStatus.findMany({
            select: statusSelect,
            orderBy: { order: "asc" }
          });
        }
        return statuses;
      })(),
      prisma.serviceTeam.findMany({ select: { id: true, name: true } }),
      prisma.serviceEngineer.findMany({ 
        select: { id: true, teamId: true, user: { select: { name: true } } } 
      }),
      prisma.complaintType.findMany({ select: { id: true, name: true } }),
      prisma.defectType.findMany({ select: { id: true, name: true } }),
    ]);

    return NextResponse.json({
      Customer: customers.map(c => ({ value: c.id, label: `${c.name} (${c.customerCode})` })),
      CustomerAsset: assets.map(a => ({ value: a.id, label: `${a.productName} - ${a.serialNumber}`, customerId: a.customerId })),
      ServiceCategory: categories.map(c => ({ value: c.id, label: c.name })),
      PriorityLevel: priorities.map(p => ({ value: p.id, label: p.name, color: p.color })),
      ServiceStatus: statuses.map(s => ({ value: s.id, label: s.name, color: s.color })),
      ServiceTeam: teams.map(t => ({ value: t.id, label: t.name })),
      ServiceEngineer: engineers.map(e => ({ value: e.id, label: e.user.name, teamId: e.teamId })),
      ComplaintType: complaintTypes.map(c => ({ value: c.id, label: c.name })),
      DefectType: defectTypes.map(d => ({ value: d.id, label: d.name })),
    });
  } catch (error: any) {
    console.error("Error fetching reference data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
