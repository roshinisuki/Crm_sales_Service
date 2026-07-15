import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const recipientEmail = body.email || null;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  const email = recipientEmail || visit.customer?.email;
  if (!email) {
    return NextResponse.json({ success: false, message: "No email address available for this customer" }, { status: 400 });
  }

  // Find the generated report document
  const reportDoc = await prisma.cRMDocument.findFirst({
    where: { documentType: "ServiceReport", entityId: visit.id },
  });

  if (!reportDoc) {
    return NextResponse.json({ success: false, message: "No service report PDF found. Please generate the report first." }, { status: 404 });
  }

  // Read the PDF file
  const filePath = path.join(process.cwd(), "public", reportDoc.fileUrl);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ success: false, message: "Report PDF file not found on disk" }, { status: 404 });
  }
  const pdfBuffer = fs.readFileSync(filePath);

  const reportNumber = `SR-${visit.id.substring(0, 8).toUpperCase()}`;
  const visitCode = `VST-${visit.id.substring(0, 8).toUpperCase()}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Service Report — ${reportNumber}</h2>
      <p>Dear ${visit.customer?.name || "Customer"},</p>
      <p>Please find attached the service report for visit <strong>${visitCode}</strong>.</p>
      <p>If you have any questions regarding this report, please don't hesitate to contact us.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">This is an automated email from the CRM Service Module.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject: `Service Report ${reportNumber} — Visit ${visitCode}`,
      html: htmlBody,
      attachments: [
        {
          filename: reportDoc.name || `${reportNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    await logAudit(user.id, "ServiceVisit", "EmailReport", `Emailed service report ${reportNumber} to ${email}`);

    return NextResponse.json({ success: true, message: `Report emailed to ${email}` });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ success: false, message: `Failed to send email: ${error.message}` }, { status: 500 });
  }
}
