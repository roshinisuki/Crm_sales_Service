import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const contract = await prisma.aMCContract.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "AMC contract not found" }, { status: 404 });
    }

    return NextResponse.json(contract);
  } catch (error: any) {
    console.error("Error fetching AMC contract:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.aMCContract.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "AMC contract not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.renewalStatus !== undefined) updateData.renewalStatus = body.renewalStatus;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    const updated = await prisma.aMCContract.update({
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
    console.error("Error updating AMC contract:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    await prisma.aMCContract.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting AMC contract:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
