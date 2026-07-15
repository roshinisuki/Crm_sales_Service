import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const requestItem = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: {
          include: {
            AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
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
      }
    });

    if (!requestItem) {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }

    return NextResponse.json(requestItem);
  } catch (error: any) {
    console.error("Error fetching service request:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Whitelist allowed fields to prevent arbitrary updates
    const allowedFields: Record<string, any> = {};
    const permitted = ["title", "description", "categoryId", "priorityId", "statusId", "customerId", "customerAssetId", "assignedTeamId", "assignedEngineerId", "closedAt"];
    for (const key of permitted) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: allowedFields,
      include: {
        customer: true,
        customerAsset: {
          include: {
            AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
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

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("Error updating service request:", error);
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
    await prisma.serviceRequest.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting service request:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
