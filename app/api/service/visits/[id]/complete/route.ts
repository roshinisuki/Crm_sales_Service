import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { outcomeNotes } = body;

    if (!outcomeNotes || !outcomeNotes.trim()) {
      return NextResponse.json({ error: "Outcome notes are required to complete a visit" }, { status: 400 });
    }

    const existing = await prisma.serviceVisit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // Find the "Completed" status for the visit module
    const completedStatus = await prisma.serviceStatus.findFirst({
      where: { name: "Closed", module: "request" },
    });
    // Fallback: try "Completed" name
    const finalCompletedStatus = completedStatus || await prisma.serviceStatus.findFirst({
      where: { name: "Completed" },
    });

    if (!finalCompletedStatus) {
      return NextResponse.json({ error: "Completed status not found in ServiceStatus table" }, { status: 500 });
    }

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data: {
        statusId: finalCompletedStatus.id,
        outcomeNotes: outcomeNotes.trim(),
        completedAt: new Date(),
        checkOutTime: new Date(),
      },
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error completing visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
