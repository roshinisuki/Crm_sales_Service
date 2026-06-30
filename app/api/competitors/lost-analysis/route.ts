import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

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
      lessonsLearned: body.lessonsLearned || null,
      recordedById: user.id,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: analysis });
}
