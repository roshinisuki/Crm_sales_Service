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
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { companyId: user.companyId, deletedAt: null };
  if (statuses.length > 0) where.status = { in: statuses };
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (startDate || endDate) {
    where.receivedDate = {};
    if (startDate) where.receivedDate.gte = new Date(startDate);
    if (endDate) where.receivedDate.lte = new Date(endDate + "T23:59:59");
  }

  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const rfqs = await prisma.rFQ.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      product: { select: { id: true, productCode: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { receivedDate: "desc" },
  });

  const total = rfqs.length;
  const underReview = rfqs.filter((r) => r.status === "UnderReview").length;
  const costingPending = rfqs.filter((r) => r.status === "CostingPending").length;
  const converted = rfqs.filter((r) => r.status === "QuotationCreated" || r.status === "Closed").length;
  const closed = rfqs.filter((r) => r.status === "Closed").length;

  const formattedRfqs = rfqs.map((r) => ({
    id: r.id,
    rfqCode: r.rfqCode,
    customerName: r.customer?.name || "—",
    productName: r.product?.name || r.product?.productCode || "—",
    quantity: r.quantity,
    status: r.status,
    assignedTo: r.assignedUser?.name || "—",
    receivedDate: r.receivedDate ? new Date(r.receivedDate).toISOString() : null,
  }));

  return NextResponse.json({
    success: true,
    summary: { total, underReview, costingPending, converted, closed },
    rfqs: formattedRfqs,
  });
}
