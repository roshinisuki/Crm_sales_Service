import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/lost-analysis");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId");
  const lossReasonId = searchParams.get("lossReasonId");

  const where: any = { companyId: user.companyId };
  if (competitorId) where.competitorId = competitorId;
  if (lossReasonId) where.lossReasonId = lossReasonId;

  const analyses = await prisma.lostDealAnalysis.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { id: true, name: true } } } },
      competitor: { select: { id: true, name: true } },
      lossReason: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: analyses });
}


export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/lost-analysis");
  if (guard) return guard;
  if (!["Admin", "SalesManager", "SalesExecutive"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.dealId) return NextResponse.json({ success: false, message: "Deal is required" }, { status: 400 });

  // Ensure deal belongs to company
  const deal = await prisma.deal.findFirst({ where: { id: body.dealId, companyId: user.companyId } });
  if (!deal) return NextResponse.json({ success: false, message: "Deal not found" }, { status: 404 });

  const analysis = await prisma.lostDealAnalysis.create({
    data: {
      dealId: body.dealId,
      competitorId: body.competitorId || null,
      lossReasonId: body.lossReasonId || null,
      competitorWonPrice: body.competitorWonPrice ?? null,
      ourFinalPrice: body.ourFinalPrice ?? null,
      lostReason: body.lostReason || null,
      lessonsLearned: body.lessonsLearned || null,
      recordedById: user.id,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: analysis });
}
