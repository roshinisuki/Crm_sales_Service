import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("documentType") || searchParams.get("type");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 50;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (documentType) where.documentType = documentType;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

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

  return NextResponse.json({ success: true, data: documents, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
  if (!body.documentType) return NextResponse.json({ success: false, message: "Document type is required" }, { status: 400 });
  if (!body.fileUrl) return NextResponse.json({ success: false, message: "File URL is required" }, { status: 400 });
  if (!body.entityType) return NextResponse.json({ success: false, message: "Entity type is required" }, { status: 400 });
  if (!body.entityId) return NextResponse.json({ success: false, message: "Entity ID is required" }, { status: 400 });

  // Auto-generate documentCode
  const count = await prisma.cRMDocument.count({ where: { companyId: user.companyId } });
  const documentCode = `DOC-${String(count + 1).padStart(4, "0")}`;

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
      customerId: body.customerId || null,
      companyId: user.companyId,
    },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      Customer: { select: { id: true, name: true, customerCode: true } },
    },
  });

  return NextResponse.json({ success: true, data: document });
}
