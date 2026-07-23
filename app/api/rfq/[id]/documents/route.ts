import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/documents");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, customerId: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
  }

  // Save file to public/uploads/rfq/
  const fs = await import("fs/promises");
  const path = await import("path");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "rfq", id);
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, "_")}`;
  const filePath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  const fileUrl = `/uploads/rfq/${id}/${fileName}`;

  // Generate document code
  const docCount = await prisma.cRMDocument.count({ where: { companyId: user.companyId } });
  const documentCode = `DOC-${String(docCount + 1).padStart(5, "0")}`;

  // Insert into CRMDocument
  const document = await prisma.cRMDocument.create({
    data: {
      documentCode,
      name: file.name,
      documentType: formData.get("document_type") as string || "Drawing",
      entityType: "RFQ",
      entityId: id,
      fileUrl,
      fileSize: file.size,
      mimeType: file.type,
      description: formData.get("description") as string || null,
      uploadedById: user.id,
      customerId: rfq.customerId,
      companyId: user.companyId,
    },
  });

  await logAudit(user.id, "RFQ", "UploadDocument", `Uploaded document ${file.name} for RFQ ${rfq.rfqCode}`, {
    resourceId: id,
    newState: { documentId: document.id, fileName: file.name, documentType: document.documentType },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: document }, { status: 201 });
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/documents");
  if (guard) return guard;

  const { id } = await params;

  const documents = await prisma.cRMDocument.findMany({
    where: {
      entityType: "RFQ",
      entityId: id,
      deletedAt: null,
      companyId: user.companyId,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: documents });
}
