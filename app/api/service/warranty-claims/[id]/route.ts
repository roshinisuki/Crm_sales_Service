import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const claim = await prisma.warrantyClaim.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error: any) {
    console.error("Error fetching warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.warrantyClaim.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.resolution !== undefined) updateData.resolution = body.resolution;

    const updated = await prisma.warrantyClaim.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    await prisma.warrantyClaim.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
