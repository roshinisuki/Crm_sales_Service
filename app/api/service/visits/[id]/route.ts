import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const visit = await prisma.serviceVisit.findUnique({
      where: { id },
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
        partsUsed: true,
        photos: true,
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    return NextResponse.json(visit);
  } catch (error: any) {
    console.error("Error fetching visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.serviceVisit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.engineerId !== undefined) updateData.engineerId = body.engineerId;
    if (body.scheduledDate !== undefined) updateData.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
    if (body.checkInTime !== undefined) updateData.checkInTime = body.checkInTime ? new Date(body.checkInTime) : null;
    if (body.checkOutTime !== undefined) updateData.checkOutTime = body.checkOutTime ? new Date(body.checkOutTime) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.customerId !== undefined) updateData.customerId = body.customerId || null;
    if (body.customerAssetId !== undefined) updateData.customerAssetId = body.customerAssetId || null;
    if (body.outcomeNotes !== undefined) updateData.outcomeNotes = body.outcomeNotes;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data: updateData,
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
        partsUsed: true,
        photos: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    await prisma.serviceVisit.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
