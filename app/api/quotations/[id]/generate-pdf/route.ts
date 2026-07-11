import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

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
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${quotation.quotationCode}`, margin, y);
    y += 5;
    doc.text(`Revision: R${quotation.revisionNumber}`, margin, y);
    y += 5;
    doc.text(`Status: ${quotation.status}`, margin, y);
    y += 5;
    doc.text(`Valid Until: ${formatDate(quotation.validUntil)}`, margin, y);
    y += 8;

    // Customer info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (quotation.customer) {
      doc.text(quotation.customer.name, margin, y); y += 4;
      if (quotation.customer.customerCode) { doc.text(`Code: ${quotation.customer.customerCode}`, margin, y); y += 4; }
      if (quotation.customer.billingAddress) { doc.text(quotation.customer.billingAddress, margin, y); y += 4; }
      if (quotation.customer.city) { doc.text(quotation.customer.city, margin, y); y += 4; }
      if (quotation.customer.gstNumber) { doc.text(`GST: ${quotation.customer.gstNumber}`, margin, y); y += 4; }
      if (quotation.customer.phone) { doc.text(`Phone: ${quotation.customer.phone}`, margin, y); y += 4; }
      if (quotation.customer.email) { doc.text(`Email: ${quotation.customer.email}`, margin, y); y += 4; }
    }
    y += 4;

    // Deal info if linked
    if (quotation.deal) {
      doc.setFont("helvetica", "bold");
      doc.text(`Opportunity: ${quotation.deal.dealName}`, margin, y); y += 5;
      doc.setFont("helvetica", "normal");
    }

    // Line items table
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Description", "Qty", "Unit Price", "Disc%", "Tax%", "Line Total"]],
      body: quotation.items.map((it, idx) => [
        String(idx + 1),
        it.description || it.product?.name || "—",
        String(it.quantity),
        formatCurrency(it.unitPrice),
        `${it.discountPercent || 0}%`,
        `${it.taxPercent || 0}%`,
        formatCurrency(it.lineTotal || it.totalPrice),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 15, halign: "right" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 25, halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Totals
    const totalsX = pageW - margin - 60;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, y); doc.text(formatCurrency(quotation.subtotal || quotation.totalAmount), pageW - margin, y, { align: "right" }); y += 5;
    doc.text(`Discount (${quotation.discountPercent || 0}%):`, totalsX, y); doc.text(`-${formatCurrency((quotation.subtotal || quotation.totalAmount) * (quotation.discountPercent || 0) / 100)}`, pageW - margin, y, { align: "right" }); y += 5;
    doc.text("Tax (GST):", totalsX, y); doc.text(formatCurrency(quotation.taxAmount || 0), pageW - margin, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grand Total:", totalsX, y); doc.text(formatCurrency(quotation.finalAmount), pageW - margin, y, { align: "right" }); y += 8;

    // Terms
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (quotation.termsAndConditions) {
      doc.setFont("helvetica", "bold");
      doc.text("Terms & Conditions:", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      const termsLines = doc.splitTextToSize(quotation.termsAndConditions, pageW - 2 * margin);
      doc.text(termsLines, margin, y);
      y += termsLines.length * 4 + 4;
    }
    if (quotation.paymentTerms) {
      doc.setFont("helvetica", "bold");
      doc.text("Payment Terms:", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      const payLines = doc.splitTextToSize(quotation.paymentTerms, pageW - 2 * margin);
      doc.text(payLines, margin, y);
      y += payLines.length * 4 + 4;
    }
    if (quotation.deliveryTerms) {
      doc.setFont("helvetica", "bold");
      doc.text("Delivery Terms:", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      const delLines = doc.splitTextToSize(quotation.deliveryTerms, pageW - 2 * margin);
      doc.text(delLines, margin, y);
      y += delLines.length * 4 + 4;
    }
    if (quotation.freightTerms) {
      doc.text(`Freight: ${quotation.freightTerms}`, margin, y); y += 4;
    }
    if (quotation.leadTimeDays) {
      doc.text(`Lead Time: ${quotation.leadTimeDays} days`, margin, y); y += 4;
    }

    // Footer
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;
    doc.text(`Generated by ${generatedByName} on ${new Date().toLocaleString("en-IN")}`, margin, y);
    y += 4;
    doc.text(`Created by ${quotation.createdBy?.name || "—"}`, margin, y);

    // Output as base64 data URL
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
