import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEscalations } from "@/lib/escalationService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const statusId = searchParams.get("statusId");
    
    let whereClause: any = {};
    if (customerId) whereClause.customerId = customerId;
    if (statusId) whereClause.statusId = statusId;

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      include: {
        customer: true,
        customerAsset: true,
        priority: true,
        status: true,
        category: true,
        complaintType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const complaintsWithEscalations = await computeEscalations(complaints);
    return NextResponse.json(complaintsWithEscalations);
  } catch (error: any) {
    console.error("Error fetching complaints:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      complaintTypeId,
      priorityId,
      statusId,
      customerId,
      customerAssetId,
      assignedTeamId,
      assignedEngineerId,
      createdById,
    } = body;

    if (!title || !categoryId || !complaintTypeId || !priorityId || !statusId || !customerId) {
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

    // Auto-assignment logic: derive team from category via TeamToCategory mapping
    let actualTeamId = assignedTeamId;
    let actualEngineerId = assignedEngineerId;
    
    if (!actualTeamId && categoryId) {
      const categoryWithTeams = await prisma.serviceCategory.findUnique({
        where: { id: categoryId },
        include: { teams: { where: { isActive: true } } },
      });
      if (categoryWithTeams && categoryWithTeams.teams.length > 0) {
        actualTeamId = categoryWithTeams.teams[0].id;
      }
    }

    if (actualTeamId && !actualEngineerId) {
      const firstEngineer = await prisma.serviceEngineer.findFirst({
        where: { teamId: actualTeamId, isActive: true },
      });
      if (firstEngineer) {
        actualEngineerId = firstEngineer.id;
      }
    }

    const newComplaint = await prisma.complaint.create({
      data: {
        title,
        description,
        categoryId,
        complaintTypeId,
        priorityId,
        statusId,
        customerId,
        customerAssetId,
        assignedTeamId: actualTeamId,
        assignedEngineerId: actualEngineerId,
        createdById: finalCreatedById,
      },
      include: {
        customer: true,
        customerAsset: true,
        priority: true,
        status: true,
        category: true,
        complaintType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      }
    });

    return NextResponse.json(newComplaint);
  } catch (error: any) {
    console.error("Error creating complaint:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
