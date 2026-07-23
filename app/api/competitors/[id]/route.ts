import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]");
  if (guard) return guard;

  const { id } = await params;
  const competitor = await prisma.competitor.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      products: { orderBy: { updatedAt: "desc" } },
      _count: { select: { lostDeals: true } },
    },
  });

  if (!competitor) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: competitor });
}


export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.competitor.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const competitor = await prisma.competitor.update({
    where: { id },
    data: {
      name: body.name,
      website: body.website,
      description: body.description,
      strengths: body.strengths,
      weaknesses: body.weaknesses,
      isActive: body.isActive,
    },
  });

  return NextResponse.json({ success: true, data: competitor });
}


export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]");
  if (guard) return guard;
  if (!["Admin"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.competitor.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.competitor.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });
  return NextResponse.json({ success: true });
}
