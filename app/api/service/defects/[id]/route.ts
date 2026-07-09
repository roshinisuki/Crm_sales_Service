import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const defect = await prisma.defect.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: true,
        priority: true,
        status: true,
        category: true,
        defectType: true,
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

    if (!defect) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 });
    }

    return NextResponse.json(defect);
  } catch (error: any) {
    console.error("Error fetching defect:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.defect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 });
    }

    const updated = await prisma.defect.update({
      where: { id },
      data: body,
      include: {
        customer: true,
        customerAsset: true,
        priority: true,
        status: true,
        category: true,
        defectType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating defect:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    await prisma.defect.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting defect:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
