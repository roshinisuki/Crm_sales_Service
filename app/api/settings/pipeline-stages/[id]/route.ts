import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.pipelineStage.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Stage not found" }, { status: 404 });

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.order !== undefined) updateData.order = body.order;

  const stage = await prisma.pipelineStage.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: stage });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.pipelineStage.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Stage not found" }, { status: 404 });

  // Check if any deals use this stage name
  const dealCount = await prisma.deal.count({
    where: { status: existing.name, companyId: user.companyId, deletedAt: null },
  });

  if (dealCount > 0) {
    return NextResponse.json({ success: false, message: `Cannot delete: ${dealCount} deals use this stage` }, { status: 400 });
  }

  await prisma.pipelineStage.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "Stage deleted" });
}
