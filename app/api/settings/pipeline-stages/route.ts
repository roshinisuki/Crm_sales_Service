import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/settings/pipeline-stages
// Returns PipelineStageMaster rows — these ACTUALLY control stage behavior
// (probability, order). /settings/pipeline-stages now manages this table,
// not the cosmetic PipelineStage table.
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const stages = await prisma.pipelineStageMaster.findMany({
    where: { companyId: user.companyId, isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  return NextResponse.json({ success: true, data: stages });
}

// POST /api/settings/pipeline-stages
// Creates a new PipelineStageMaster row (Admin/SalesManager only).
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.stageName || !body.displayName) {
    return NextResponse.json({ success: false, message: "stageName and displayName are required" }, { status: 400 });
  }

  // Prevent duplicates
  const existing = await prisma.pipelineStageMaster.findFirst({
    where: { stageName: body.stageName, companyId: user.companyId },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "A stage with this stageName already exists" }, { status: 409 });
  }

  const maxOrder = await prisma.pipelineStageMaster.aggregate({
    where: { companyId: user.companyId },
    _max: { displayOrder: true },
  });

  const stage = await prisma.pipelineStageMaster.create({
    data: {
      stageName: body.stageName,
      displayName: body.displayName,
      displayOrder: body.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
      probabilityPercent: body.probabilityPercent ?? 0,
      isClosedStage: body.isClosedStage ?? false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: stage }, { status: 201 });
}
