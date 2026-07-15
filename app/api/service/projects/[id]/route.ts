import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      createdBy: { select: { id: true, name: true } },
      assets: {
        include: {
          customer: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, poCode: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return NextResponse.json({ success: false, message: "Project not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, projectCode, customerId, dealId, status, startDate, endDate, notes } = body;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, message: "Project not found" }, { status: 404 });

  if (projectCode && projectCode !== existing.projectCode) {
    const conflict = await prisma.project.findUnique({ where: { projectCode } });
    if (conflict) return NextResponse.json({ success: false, message: "Project code already exists" }, { status: 409 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(projectCode !== undefined ? { projectCode: projectCode.trim() } : {}),
      ...(customerId !== undefined ? { customerId } : {}),
      ...(dealId !== undefined ? { dealId: dealId || null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  await logAudit(user.id, "Project", "Update", `Updated project ${updated.projectCode}`);

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user || !["Admin", "SuperAdmin"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, message: "Project not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  await logAudit(user.id, "Project", "Delete", `Deleted project ${existing.projectCode}`);

  return NextResponse.json({ success: true, message: "Project deleted" });
}
