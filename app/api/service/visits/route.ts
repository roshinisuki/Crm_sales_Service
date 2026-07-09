import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const engineerId = searchParams.get("engineerId");
    const statusId = searchParams.get("statusId");
    const requestId = searchParams.get("requestId");
    const complaintId = searchParams.get("complaintId");
    const defectId = searchParams.get("defectId");
    const installationId = searchParams.get("installationId");
    
    let whereClause: any = {};
    if (engineerId) whereClause.engineerId = engineerId;
    if (statusId) whereClause.statusId = statusId;
    if (requestId) whereClause.requestId = requestId;
    if (complaintId) whereClause.complaintId = complaintId;
    if (defectId) whereClause.defectId = defectId;
    if (installationId) whereClause.installationId = installationId;

    const visits = await prisma.serviceVisit.findMany({
      where: whereClause,
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(visits);
  } catch (error: any) {
    console.error("Error fetching visits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      notes,
      statusId,
      engineerId,
      scheduledDate,
      requestId,
      complaintId,
      defectId,
      installationId,
      createdById,
    } = body;

    if (!title || !statusId || !engineerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Default to a real user if none provided
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        finalCreatedById = firstUser.id;
      }
    }

    const newVisit = await prisma.serviceVisit.create({
      data: {
        title,
        notes,
        statusId,
        engineerId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        requestId,
        complaintId,
        defectId,
        installationId,
        createdById: finalCreatedById,
      },
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
      }
    });

    return NextResponse.json(newVisit);
  } catch (error: any) {
    console.error("Error creating visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
