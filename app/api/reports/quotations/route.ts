import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const statuses = searchParams.get("status")?.split(",").filter(Boolean) || [];
  const customerId = searchParams.get("customerId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { companyId: user.companyId, deletedAt: null, status: { not: "Draft" } };
  if (statuses.length > 0) where.status = { in: statuses };
  if (customerId) where.customerId = customerId;
  if (startDate || endDate) {
    where.sentAt = {};
    if (startDate) where.sentAt.gte = new Date(startDate);
    if (endDate) where.sentAt.lte = new Date(endDate + "T23:59:59");
  }

  if (user.role === "SalesExecutive") where.createdById = user.id;

  const quotations = await prisma.quotation.findMany({
    where,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { sentAt: "desc" },
  });

  const totalSent = quotations.length;
  const accepted = quotations.filter((q) => q.status === "Accepted").length;
  const rejected = quotations.filter((q) => q.status === "Rejected").length;
  const expired = quotations.filter((q) => q.status === "Expired").length;
  const acceptanceRate = totalSent > 0 ? Math.round((accepted / totalSent) * 1000) / 10 : 0;

  const formattedQuotations = quotations.map((q) => ({
    id: q.id,
    quotationCode: q.quotationCode,
    customerName: q.customer?.name || "—",
    totalAmount: q.totalAmount,
    discountPercent: q.discountPercent,
    finalAmount: q.finalAmount,
    status: q.status,
    sentAt: q.sentAt ? new Date(q.sentAt).toISOString() : null,
    validUntil: new Date(q.validUntil).toISOString(),
  }));

  return NextResponse.json({
    success: true,
    summary: { totalSent, accepted, rejected, expired, acceptanceRate },
    quotations: formattedQuotations,
  });
}
