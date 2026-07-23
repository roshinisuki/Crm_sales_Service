import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

async function resolveCustomerId(entityType: string, entityId: string): Promise<string | null> {
  try {
    switch (entityType) {
      case "Customer":
        return entityId;
      case "Deal": {
        const deal = await prisma.deal.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return deal?.customerId ?? null;
      }
      case "RFQ": {
        const rfq = await prisma.rFQ.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return rfq?.customerId ?? null;
      }
      case "Quotation": {
        const quot = await prisma.quotation.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return quot?.customerId ?? null;
      }
      case "PurchaseOrder": {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return po?.customerId ?? null;
      }
      case "Negotiation": {
        const neg = await prisma.negotiation.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return neg?.customerId ?? null;
      }
      case "SampleRequest": {
        const sample = await prisma.sampleRequest.findUnique({ where: { id: entityId }, select: { customerId: true } });
        return sample?.customerId ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

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

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.DOCUMENTS, "GET /api/documents");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("documentType") || searchParams.get("type");
  const entityType = searchParams.get("entityType") || searchParams.get("relatedToType");
  const entityId = searchParams.get("entityId") || searchParams.get("relatedToId");
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const pageSize = Math.min(limit, 200);
  const includeRevisions = searchParams.get("includeRevisions") === "true";

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (!includeRevisions) where.isCurrent = true;
  if (documentType && documentType !== "ALL") where.documentType = documentType;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { documentCode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.cRMDocument.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        Customer: { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cRMDocument.count({ where }),
  ]);

  // Enrich with entity names
  const enriched = await Promise.all(
    documents.map(async (doc) => {
      const relatedEntityName = doc.entityType && doc.entityId
        ? await resolveEntityName(doc.entityType, doc.entityId)
        : null;
      return { ...doc, relatedEntityName };
    })
  );

  return NextResponse.json({ success: true, data: enriched, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.DOCUMENTS, "POST /api/documents");
  if (guard) return guard;

  const contentType = request.headers.get("content-type") || "";

  // Handle multipart/form-data (file upload)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "";
    const documentType = (formData.get("documentType") as string) || "Drawing";
    const entityType = (formData.get("entityType") as string) || "";
    const entityId = (formData.get("entityId") as string) || "";
    const description = (formData.get("description") as string) || null;
    const tags = (formData.get("tags") as string) || null;
    const explicitCustomerId = (formData.get("customerId") as string) || null;

    if (!file) return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    if (!name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
    if (!entityType) return NextResponse.json({ success: false, message: "Entity type is required" }, { status: 400 });
    if (!entityId) return NextResponse.json({ success: false, message: "Entity ID is required" }, { status: 400 });

    // Auto-derive customerId from the parent record unless explicitly provided
    const customerId = explicitCustomerId || (await resolveCustomerId(entityType, entityId));

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File size exceeds 20MB limit" }, { status: 400 });
    }

    // Save file to /public/uploads/documents/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    const fileUrl = `/uploads/documents/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    // Generate document code: DOC-YYYY-NNNNN
    const year = new Date().getFullYear();
    const lastDoc = await prisma.cRMDocument.findFirst({
      where: { companyId: user.companyId, documentCode: { startsWith: `DOC-${year}-` } },
      orderBy: { createdAt: "desc" },
      select: { documentCode: true },
    });
    const nextNum = lastDoc?.documentCode
      ? parseInt(lastDoc.documentCode.split("-")[2] ?? "0") + 1
      : 1;
    const documentCode = `DOC-${year}-${String(nextNum).padStart(5, "0")}`;

    const document = await prisma.cRMDocument.create({
      data: {
        documentCode,
        name,
        documentType,
        entityType,
        entityId,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        description,
        tags,
        uploadedById: user.id,
        customerId: customerId || null,
        companyId: user.companyId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        Customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  }

  // Handle JSON body (backward compatibility — base64 data URL)
  const body = await request.json();

  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
  if (!body.documentType) return NextResponse.json({ success: false, message: "Document type is required" }, { status: 400 });
  if (!body.fileUrl) return NextResponse.json({ success: false, message: "File URL is required" }, { status: 400 });
  if (!body.entityType) return NextResponse.json({ success: false, message: "Entity type is required" }, { status: 400 });
  if (!body.entityId) return NextResponse.json({ success: false, message: "Entity ID is required" }, { status: 400 });

  // Auto-derive customerId from the parent record unless explicitly provided
  const customerId = body.customerId || (await resolveCustomerId(body.entityType, body.entityId)) || null;

  // Generate document code: DOC-YYYY-NNNNN
  const year = new Date().getFullYear();
  const lastDoc = await prisma.cRMDocument.findFirst({
    where: { companyId: user.companyId, documentCode: { startsWith: `DOC-${year}-` } },
    orderBy: { createdAt: "desc" },
    select: { documentCode: true },
  });
  const nextNum = lastDoc?.documentCode
    ? parseInt(lastDoc.documentCode.split("-")[2] ?? "0") + 1
    : 1;
  const documentCode = `DOC-${year}-${String(nextNum).padStart(5, "0")}`;

  const document = await prisma.cRMDocument.create({
    data: {
      documentCode,
      name: body.name,
      documentType: body.documentType,
      entityType: body.entityType,
      entityId: body.entityId,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize || null,
      mimeType: body.mimeType || null,
      description: body.description || null,
      tags: body.tags || null,
      uploadedById: user.id,
      customerId,
      companyId: user.companyId,
    },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      Customer: { select: { id: true, name: true, customerCode: true } },
    },
  });

  return NextResponse.json({ success: true, data: document });
}
