import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const installation = await prisma.installation.findUnique({
      where: { id },
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
        visits: {
          include: {
            engineer: { include: { user: true } },
            status: true
          }
        },
      },
    });

    if (!installation) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    return NextResponse.json(installation);
  } catch (error: any) {
    console.error("Error fetching installation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.installation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    // Whitelist allowed fields
    const allowedFields: Record<string, any> = {};
    const permitted = ["title", "description", "categoryId", "priorityId", "statusId", "customerId", "customerAssetId", "assignedTeamId", "assignedEngineerId", "closedAt"];
    for (const key of permitted) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    const updated = await prisma.installation.update({
      where: { id },
      data: allowedFields,
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

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating installation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user || !["Admin", "SuperAdmin"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.installation.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting installation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
