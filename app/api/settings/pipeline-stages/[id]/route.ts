import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// PATCH /api/settings/pipeline-stages/[id]
// Updates displayOrder, probabilityPercent, displayName, isActive on a PipelineStageMaster row.
// These values are read by the stage-change API at runtime — editing here actually
// controls pipeline behavior (not cosmetic).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.pipelineStageMaster.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Stage not found" }, { status: 404 });

  const body = await request.json();

  const updateData: any = {};
  if (body.displayName !== undefined) updateData.displayName = body.displayName;
  if (body.displayOrder !== undefined) updateData.displayOrder = parseInt(body.displayOrder);
  if (body.probabilityPercent !== undefined) {
    const p = parseInt(body.probabilityPercent);
    if (isNaN(p) || p < 0 || p > 100) {
      return NextResponse.json({ success: false, message: "probabilityPercent must be 0–100" }, { status: 400 });
    }
    updateData.probabilityPercent = p;
  }
  if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
  if (body.isClosedStage !== undefined) updateData.isClosedStage = Boolean(body.isClosedStage);

  const updated = await prisma.pipelineStageMaster.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: updated });
}

// DELETE /api/settings/pipeline-stages/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager", "SuperAdmin"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.pipelineStageMaster.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Stage not found" }, { status: 404 });

  // Soft-delete via isActive=false to avoid breaking existing deal.status values
  await prisma.pipelineStageMaster.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true, message: "Stage deactivated" });
}
