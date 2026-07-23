import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TARGETS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/targets/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.salesTarget.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const target = await prisma.salesTarget.update({
    where: { id },
    data: {
      targetType: body.targetType,
      period: body.period,
      targetAmount: parseFloat(body.targetAmount),
      assignedUserId: body.assignedUserId || null,
      territoryId: body.territoryId || null,
      notes: body.notes,
    },
  });

  await logAudit(user.id, "Target", "UPDATE", `Updated target ${body.period}`, {
    resourceId: id,
    previousState: existing,
    newState: target,
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: target });
}


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TARGETS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/targets/[id]");
  if (guard) return guard;
  if (!["Admin"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.salesTarget.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.salesTarget.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit(user.id, "Target", "DELETE", `Deleted target ${existing.period}`, {
    resourceId: id,
    previousState: existing,
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true });
}
