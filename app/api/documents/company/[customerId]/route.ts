import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

async function resolveEntityName(entityType: string, entityId: string): Promise<string | null> {
  try {
    switch (entityType) {
      case "Customer": {
        const acc = await prisma.customer.findUnique({ where: { id: entityId }, select: { name: true, customerCode: true } });
        return acc ? `${acc.customerCode} — ${acc.name}` : null;
      }
      case "Deal": {
        const deal = await prisma.deal.findUnique({ where: { id: entityId }, select: { dealName: true, opportunityCode: true } });
        return deal?.dealName ?? deal?.opportunityCode ?? null;
      }
      case "RFQ": {
        const rfq = await prisma.rFQ.findUnique({ where: { id: entityId }, select: { rfqCode: true } });
        return rfq?.rfqCode ?? null;
      }
      case "Quotation": {
        const quot = await prisma.quotation.findUnique({ where: { id: entityId }, select: { quotationCode: true } });
        return quot?.quotationCode ?? null;
      }
      case "PurchaseOrder": {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: entityId }, select: { poCode: true } });
        return po?.poCode ?? null;
      }
      case "Negotiation": {
        const neg = await prisma.negotiation.findUnique({ where: { id: entityId }, select: { negotiationCode: true } });
        return neg?.negotiationCode ?? null;
      }
      case "SampleRequest": {
        const sample = await prisma.sampleRequest.findUnique({ where: { id: entityId }, select: { sampleCode: true } });
        return sample?.sampleCode ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.DOCUMENTS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/documents/company/[customerId]");
  if (guard) return guard;

  const { customerId } = await params;
  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("documentType") || searchParams.get("type") || "";
  const thisMonthOnly = searchParams.get("thisMonth") === "true";

  // Verify customer exists within tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null, companyId: user.companyId },
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

  if (!customer) return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });

  // Build where clause for documents
  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
    customerId,
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (documentType && documentType !== "ALL") {
    where.documentType = documentType;
  }
  if (thisMonthOnly) {
    where.createdAt = { gte: monthStart };
  }
  // Show only current revisions by default
  where.isCurrent = true;

  // Fetch documents (current revisions only) + their revision siblings
  const [documents, allDocs] = await Promise.all([
    prisma.cRMDocument.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        revisions: {
          where: { deletedAt: null },
          select: { id: true, revisionNumber: true, isCurrent: true, fileSize: true, createdAt: true, fileUrl: true },
          orderBy: { revisionNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Fetch ALL docs for this customer (unfiltered) to compute KPI counts
    prisma.cRMDocument.findMany({
      where: { deletedAt: null, companyId: user.companyId, customerId, isCurrent: true },
      select: { documentType: true, createdAt: true },
    }),
  ]);

  // Enrich with entity names + full revision family
  const enriched = await Promise.all(
    documents.map(async (doc) => {
      const relatedEntityName = doc.entityType && doc.entityId
        ? await resolveEntityName(doc.entityType, doc.entityId)
        : null;

      // Build full revision family: if doc has parent, fetch parent + siblings; otherwise use child revisions
      let revisionFamily = doc.revisions;
      if (doc.parentDocumentId) {
        // This doc is a revision — fetch the root + all siblings
        const rootId = doc.parentDocumentId;
        const [parent, siblings] = await Promise.all([
          prisma.cRMDocument.findUnique({
            where: { id: rootId },
            select: { id: true, revisionNumber: true, isCurrent: true, fileSize: true, createdAt: true, fileUrl: true },
          }),
          prisma.cRMDocument.findMany({
            where: { parentDocumentId: rootId, deletedAt: null, id: { not: doc.id } },
            select: { id: true, revisionNumber: true, isCurrent: true, fileSize: true, createdAt: true, fileUrl: true },
            orderBy: { revisionNumber: "asc" },
          }),
        ]);
        revisionFamily = [
          ...(parent ? [parent] : []),
          ...siblings,
        ].sort((a, b) => a.revisionNumber - b.revisionNumber);
      }

      // Include the current doc itself in the revision family for display
      const allRevisions = revisionFamily.some((r) => r.id === doc.id)
        ? revisionFamily
        : [...revisionFamily, { id: doc.id, revisionNumber: doc.revisionNumber, isCurrent: doc.isCurrent, fileSize: doc.fileSize, createdAt: doc.createdAt, fileUrl: doc.fileUrl }]
            .sort((a, b) => a.revisionNumber - b.revisionNumber);

      return { ...doc, relatedEntityName, revisions: allRevisions };
    })
  );

  // Compute KPI counts (always from full set, not filtered)
  const kpis = {
    total: allDocs.length,
    drawings: allDocs.filter((d) => d.documentType === "Drawing").length,
    ndas: allDocs.filter((d) => d.documentType === "NDA").length,
    quotations: allDocs.filter((d) => d.documentType === "Quotation").length,
    purchaseOrders: allDocs.filter((d) => d.documentType === "PurchaseOrder").length,
    agreements: allDocs.filter((d) => d.documentType === "Agreement").length,
    thisMonth: allDocs.filter((d) => new Date(d.createdAt) >= monthStart).length,
  };

  return NextResponse.json({
    success: true,
    data: enriched,
    company: {
      id: customer.id,
      name: customer.name,
      customerCode: customer.customerCode,
      industryType: customer.industryType || null,
      status: customer.status,
      assignedUserName: customer.assignedUser?.name || null,
      dealStage: customer.deals[0]?.status || null,
    },
    kpis,
  });
}
