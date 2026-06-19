import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const stages = searchParams.get("stage")?.split(",").filter(Boolean) || [];
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { companyId: user.companyId, deletedAt: null };
  if (stages.length > 0) where.status = { in: stages };
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59");
  }

  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = deals.length;
  const won = deals.filter((d) => d.status === "Won").length;
  const lost = deals.filter((d) => d.status === "Lost").length;
  const active = deals.filter((d) => !["Won", "Lost"].includes(d.status)).length;
  const winRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

  const formattedDeals = deals.map((d) => ({
    id: d.id,
    dealName: d.dealName,
    customerName: d.customer?.name || "—",
    stage: d.status,
    dealValue: d.dealValue,
    expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate).toISOString() : null,
    assignedTo: d.assignedUser?.name || "—",
    createdDate: new Date(d.createdAt).toISOString(),
  }));

  return NextResponse.json({
    success: true,
    summary: { total, won, lost, active, winRate },
    deals: formattedDeals,
  });
}
