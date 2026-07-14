import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { generateQuotationPdf } from "@/lib/generateQuotationPdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true, billingAddress: true, shippingAddress: true, gstNumber: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, productCode: true, unit: true, hsnCode: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  try {
    // Fetch company info from SystemConfig
    const [addrConfig, gstinConfig, phoneConfig, emailConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
      prisma.systemConfig.findUnique({ where: { key: "company_gstin" } }),
      prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
      prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
    ]);

    const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;

    const doc = generateQuotationPdf({
      quotationCode: quotation.quotationCode,
      revisionNumber: quotation.revisionNumber,
      status: quotation.status,
      validUntil: quotation.validUntil,
      createdAt: quotation.createdAt,
      subtotal: quotation.subtotal || quotation.totalAmount,
      discountPercent: quotation.discountPercent || 0,
      taxAmount: quotation.taxAmount || 0,
      finalAmount: quotation.finalAmount,
      totalAmount: quotation.totalAmount,
      termsAndConditions: quotation.termsAndConditions,
      paymentTerms: quotation.paymentTerms,
      deliveryTerms: quotation.deliveryTerms,
      freightTerms: quotation.freightTerms,
      leadTimeDays: quotation.leadTimeDays,
      customer: quotation.customer,
      contact: quotation.contact,
      deal: quotation.deal,
      company: quotation.company,
      items: quotation.items,
      createdBy: quotation.createdBy,
      companyAddress: addrConfig?.value || "",
      companyGstin: gstinConfig?.value || "",
      companyPhone: phoneConfig?.value || "",
      companyEmail: emailConfig?.value || "",
      generatedByName,
    });

    const pdfBase64 = doc.output("datauristring");
    const pdfBytes = doc.output("arraybuffer");
    const fileSize = pdfBytes.byteLength;

    const fileName = `${quotation.quotationCode}-R${quotation.revisionNumber}.pdf`;

    // Store in QuotationDocument
    const document = await prisma.quotationDocument.create({
      data: {
        quotationId: id,
        revisionNumber: quotation.revisionNumber,
        fileName,
        fileUrl: pdfBase64,
        fileSize,
        generatedById: user.id,
      },
    });

    await logAudit(user.id, "Quotation", "GeneratePDF", `Generated PDF for quotation ${quotation.quotationCode} R${quotation.revisionNumber}`, {
      resourceId: id,
      newState: { documentId: document.id, fileName },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: document });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to generate PDF: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const documents = await prisma.quotationDocument.findMany({
    where: { quotationId: id },
    include: { generatedBy: { select: { id: true, name: true } } },
    orderBy: { generatedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: documents });
}
