import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// POST /api/accounts/[id]/documents
// Multipart upload: file + documentType + description
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const guard = enforceModuleGuard(user, MODULE_KEYS.DOCUMENTS, "/api/accounts/[id]/documents");
    if (guard) return guard;

    const { id } = await context.params;

    // Verify account exists
    const account = await prisma.customer.findUnique({ where: { id, deletedAt: null } });
    if (!account) {
      return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string) || "Customer";
    const description = (formData.get("description") as string) || null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File size exceeds 10MB limit" }, { status: 400 });
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

    // Generate document code
    const docCount = await prisma.cRMDocument.count();
    const documentCode = `DOC-${String(docCount + 1).padStart(5, "0")}`;

    const doc = await prisma.cRMDocument.create({
      data: {
        documentCode,
        name: file.name,
        documentType,
        entityType: "Customer",
        entityId: id,
        customerId: id,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        description,
        uploadedById: user.id,
        companyId: user.companyId,
      },
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// GET /api/accounts/[id]/documents
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const guard = enforceModuleGuard(user, MODULE_KEYS.DOCUMENTS, "/api/accounts/[id]/documents");
    if (guard) return guard;

    const { id } = await context.params;

    const documents = await prisma.cRMDocument.findMany({
      where: {
        entityType: "Customer",
        entityId: id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
