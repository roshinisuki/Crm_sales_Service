import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const stages = await prisma.pipelineStage.findMany({
    where: { companyId: user.companyId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ success: true, data: stages });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });

  // Get max order
  const maxOrder = await prisma.pipelineStage.aggregate({
    where: { companyId: user.companyId },
    _max: { order: true },
  });

  const stage = await prisma.pipelineStage.create({
    data: {
      name: body.name,
      color: body.color || "#378ADD",
      order: (maxOrder._max.order || 0) + 1,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: stage }, { status: 201 });
}
