import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const customerId = searchParams.get("customerId");
  const dealId = searchParams.get("dealId");
  const projectId = searchParams.get("projectId");

  const where: any = {};
  if (status && status !== "All") {
    where.status = status;
  }
  if (customerId) {
    where.customerId = customerId;
  }
  if (dealId) {
    where.dealId = dealId;
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: "insensitive" } },
      { productName: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const assets = await prisma.customerAsset.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      purchaseOrder: { select: { id: true, poCode: true, poNumber: true } },
      product: { select: { id: true, name: true, productCode: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      project: { select: { id: true, projectCode: true, name: true } },
      AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: assets });
}
