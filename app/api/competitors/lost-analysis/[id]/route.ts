import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/lost-analysis/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager", "SalesExecutive"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.lostDealAnalysis.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.lostDealAnalysis.update({
    where: { id },
    data: {
      competitorId: body.competitorId || null,
      lossReasonId: body.lossReasonId || null,
      competitorWonPrice: body.competitorWonPrice ?? null,
      ourFinalPrice: body.ourFinalPrice ?? null,
      lostReason: body.lostReason || null,
      lessonsLearned: body.lessonsLearned || null,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}


export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/lost-analysis/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.lostDealAnalysis.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  await prisma.lostDealAnalysis.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
