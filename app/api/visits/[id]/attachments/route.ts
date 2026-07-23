import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// POST /api/visits/[id]/attachments — multipart upload
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      select: { id: true, customerId: true },
    });
    if (!visit) {
      return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = (formData.get("description") as string) || null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "visits", id);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    const fileUrl = `/uploads/visits/${id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const docCount = await prisma.cRMDocument.count({ where: { companyId: user.companyId } });
    const documentCode = `DOC-${String(docCount + 1).padStart(5, "0")}`;

    const doc = await prisma.cRMDocument.create({
      data: {
        documentCode,
        name: file.name,
        documentType: "VisitAttachment",
        entityType: "Visit",
        entityId: id,
        customerId: visit.customerId,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        description,
        uploadedById: user.id,
        companyId: user.companyId,
      },
    });

    await logAudit(user.id, "CustomerVisit", "UploadAttachment", `Uploaded attachment ${file.name} for visit ${id}`, {
      resourceId: id,
      newState: { documentId: doc.id, fileName: file.name },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// GET /api/visits/[id]/attachments

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const documents = await prisma.cRMDocument.findMany({
      where: {
        entityType: "Visit",
        entityId: id,
        deletedAt: null,
        companyId: user.companyId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: documents, count: documents.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/visits/[id]/attachments?docId=xxx

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ success: false, message: "docId is required" }, { status: 400 });
    }

    const doc = await prisma.cRMDocument.findFirst({
      where: { id: docId, entityType: "Visit", entityId: id, deletedAt: null, companyId: user.companyId },
    });

    if (!doc) {
      return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
    }

    await prisma.cRMDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await logAudit(user.id, "CustomerVisit", "DeleteAttachment", `Deleted attachment ${doc.name} for visit ${id}`, {
      resourceId: id,
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, message: "Attachment deleted" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
