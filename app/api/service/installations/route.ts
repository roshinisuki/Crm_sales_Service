import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEscalations } from "@/lib/escalationService";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const statusId = searchParams.get("statusId");
    
    let whereClause: any = {};
    if (customerId) whereClause.customerId = customerId;
    if (statusId) whereClause.statusId = statusId;

    const installations = await prisma.installation.findMany({
      where: whereClause,
      include: {
        customer: true,
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const installationsWithEscalations = await computeEscalations(installations);
    return NextResponse.json(installationsWithEscalations);
  } catch (error: any) {
    console.error("Error fetching installations:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      priorityId,
      statusId,
      customerId,
      customerAssetId,
      assignedTeamId,
      assignedEngineerId,
      createdById,
    } = body;

    if (!title || !categoryId || !priorityId || !statusId || !customerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use authenticated user, or fall back to provided createdById
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      finalCreatedById = user.id;
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

    const newInstallation = await prisma.installation.create({
      data: {
        title,
        description,
        categoryId,
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
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      }
    });

    return NextResponse.json(newInstallation);
  } catch (error: any) {
    console.error("Error creating installation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
