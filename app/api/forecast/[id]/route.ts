import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.FORECAST, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/forecast/[id]");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.forecastEntry.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Entry not found" }, { status: 404 });

  const updateData: any = {};
  if (body.month !== undefined) updateData.month = parseInt(body.month);
  if (body.year !== undefined) updateData.year = parseInt(body.year);
  if (body.forecastType !== undefined) updateData.forecastType = body.forecastType;
  if (body.targetAmount !== undefined) updateData.targetAmount = parseFloat(body.targetAmount);
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;

  const entry = await prisma.forecastEntry.update({
    where: { id },
    data: updateData,
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: entry });
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.FORECAST, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/forecast/[id]");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.forecastEntry.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Entry not found" }, { status: 404 });

  await prisma.forecastEntry.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "Entry deleted" });
}
