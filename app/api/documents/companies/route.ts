import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("documentType") || searchParams.get("type") || "";

  // Base where for documents
  const docWhere: any = {
    deletedAt: null,
    companyId: user.companyId,
    customerId: { not: null },
    isCurrent: true,
  };
  if (documentType && documentType !== "ALL") {
    docWhere.documentType = documentType;
  }

  // Get all documents matching the filter, grouped by customerId
  const documents = await prisma.cRMDocument.findMany({
    where: docWhere,
    select: {
      customerId: true,
      documentType: true,
      createdAt: true,
    },
  });

  // Group by customerId
  const customerMap = new Map<string, {
    total: number;
    drawings: number;
    ndas: number;
    quotations: number;
    purchaseOrders: number;
    thisMonth: number;
  }>();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const doc of documents) {
    const cid = doc.customerId!;
    if (!customerMap.has(cid)) {
      customerMap.set(cid, {
        total: 0,
        drawings: 0,
        ndas: 0,
        quotations: 0,
        purchaseOrders: 0,
        thisMonth: 0,
      });
    }
    const stats = customerMap.get(cid)!;
    stats.total++;
    if (doc.documentType === "Drawing") stats.drawings++;
    if (doc.documentType === "NDA") stats.ndas++;
    if (doc.documentType === "Quotation") stats.quotations++;
    if (doc.documentType === "PurchaseOrder") stats.purchaseOrders++;
    if (new Date(doc.createdAt) >= monthStart) stats.thisMonth++;
  }

  const customerIds = Array.from(customerMap.keys());
  if (customerIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  // Fetch customer details + latest deal stage
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds }, deletedAt: null },
    select: {
      id: true,
      name: true,
      customerCode: true,
      industryType: true,
      status: true,
      assignedUser: { select: { id: true, name: true } },
      deals: {
        where: { deletedAt: null },
        select: { status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const result = customers.map((c) => {
    const stats = customerMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      customerCode: c.customerCode,
      industryType: c.industryType || null,
      status: c.status,
      assignedUserName: c.assignedUser?.name || null,
      dealStage: c.deals[0]?.status || null,
      documentCount: stats?.total ?? 0,
      counts: {
        total: stats?.total ?? 0,
        drawings: stats?.drawings ?? 0,
        ndas: stats?.ndas ?? 0,
        quotations: stats?.quotations ?? 0,
        purchaseOrders: stats?.purchaseOrders ?? 0,
        thisMonth: stats?.thisMonth ?? 0,
      },
    };
  });

  // Sort by document count descending
  result.sort((a, b) => b.documentCount - a.documentCount);

  return NextResponse.json({ success: true, data: result });
}
