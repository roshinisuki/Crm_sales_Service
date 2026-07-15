import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateServiceReportPdf } from "@/lib/generateServiceReportPdf";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    include: {
      engineer: { include: { user: true } },
      status: true,
      customer: { select: { id: true, name: true, customerCode: true, email: true } },
      customerAsset: { select: { id: true, productName: true, serialNumber: true } },
      request: { select: { id: true } },
      complaint: { select: { id: true } },
      defect: { select: { id: true } },
      installation: { select: { id: true } },
      partsUsed: true,
      photos: true,
    },
  });

  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  const reportNumber = `SR-${visit.id.substring(0, 8).toUpperCase()}`;
  const reportDate = new Date().toLocaleString();

  // Determine source info
  let sourceType = "";
  let sourceCode = "";
  if (visit.request) { sourceType = "Request"; sourceCode = visit.request.id.substring(0, 8).toUpperCase(); }
  else if (visit.complaint) { sourceType = "Complaint"; sourceCode = visit.complaint.id.substring(0, 8).toUpperCase(); }
  else if (visit.defect) { sourceType = "Defect"; sourceCode = visit.defect.id.substring(0, 8).toUpperCase(); }
  else if (visit.installation) { sourceType = "Installation"; sourceCode = visit.installation.id.substring(0, 8).toUpperCase(); }

  // Parse outcome from outcomeNotes
  const outcomeMatch = visit.outcomeNotes?.match(/\[Outcome: (.+?)\]/);
  const outcome = outcomeMatch?.[1] || "Completed";
  const cleanOutcomeNotes = visit.outcomeNotes?.replace(/^\[Outcome: .+?\]\s*/, "").split("\nNext Steps:")[0] || "";

  const doc = generateServiceReportPdf({
    reportNumber,
    reportDate,
    visitCode: `VST-${visit.id.substring(0, 8).toUpperCase()}`,
    visitDate: visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleString() : "-",
    customerName: visit.customer?.name || "N/A",
    customerCode: visit.customer?.customerCode,
    assetName: visit.customerAsset?.productName || "N/A",
    serialNumber: visit.customerAsset?.serialNumber || "N/A",
    engineerName: visit.engineer?.user?.name || "Unassigned",
    outcome,
    outcomeNotes: cleanOutcomeNotes,
    reasonNextSteps: visit.outcomeNotes?.split("\nNext Steps:")[1]?.trim(),
    checkInTime: visit.checkInTime ? new Date(visit.checkInTime).toLocaleString() : undefined,
    checkOutTime: visit.checkOutTime ? new Date(visit.checkOutTime).toLocaleString() : undefined,
    durationMinutes: visit.checkInTime && visit.checkOutTime
      ? Math.round((new Date(visit.checkOutTime).getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))
      : undefined,
    partsUsed: visit.partsUsed.map((p) => ({
      partName: p.partName,
      quantity: p.quantity,
      unitCost: p.unitCost,
      totalCost: p.totalCost,
    })),
    signatureUrl: visit.signatureUrl,
    photos: visit.photos.map((p) => ({ photoUrl: p.photoUrl, caption: p.caption })),
    sourceType,
    sourceCode,
  });

  const pdfBytes = doc.output("arraybuffer");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "service-reports");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${reportNumber}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));
  const fileUrl = `/uploads/service-reports/${fileName}`;

  // Store as CRMDocument
  const existingDoc = await prisma.cRMDocument.findFirst({
    where: {
      documentType: "ServiceReport",
      entityId: visit.id,
    },
  });

  let document;
  if (existingDoc) {
    document = await prisma.cRMDocument.update({
      where: { id: existingDoc.id },
      data: { fileUrl, name: fileName, fileSize: pdfBytes.byteLength, updatedAt: new Date() },
    });
  } else {
    document = await prisma.cRMDocument.create({
      data: {
        documentType: "ServiceReport",
        entityType: "ServiceVisit",
        entityId: visit.id,
        customerId: visit.customerId || null,
        name: fileName,
        fileUrl,
        fileSize: pdfBytes.byteLength,
        mimeType: "application/pdf",
        documentCode: reportNumber,
        uploadedById: user.id,
      },
    });
  }

  await logAudit(user.id, "ServiceVisit", "GenerateReport", `Generated service report ${reportNumber} for visit VST-${visit.id.substring(0, 8).toUpperCase()}`);

  return NextResponse.json({ success: true, data: document, fileUrl });
}
