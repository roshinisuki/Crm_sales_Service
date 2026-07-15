import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export interface QuotationPdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  lineTotal?: number;
  totalPrice?: number;
  hsn?: string | null;
  unit?: string | null;
  product?: { name: string; productCode: string } | null;
}

export interface QuotationPdfData {
  quotationCode: string;
  revisionNumber: number;
  status: string;
  validUntil: Date | string | null;
  createdAt: Date | string;
  subtotal: number;
  discountPercent: number;
  taxAmount: number;
  finalAmount: number;
  totalAmount: number;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  freightTerms?: string | null;
  leadTimeDays?: number | null;
  customer?: {
    name: string;
    customerCode?: string | null;
    billingAddress?: string | null;
    city?: string | null;
    gstNumber?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  contact?: {
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  deal?: {
    dealName: string;
    opportunityCode?: string | null;
  } | null;
  company?: {
    name: string;
  } | null;
  items: QuotationPdfItem[];
  createdBy?: { name: string } | null;
  companyAddress?: string;
  companyGstin?: string;
  companyPhone?: string;
  companyEmail?: string;
  generatedByName?: string;
}

/**
 * Generate a properly-aligned quotation PDF using jsPDF.
 * Includes: company header, customer info, line items table with HSN,
 * totals section, terms, signature line, and footer on every page.
 * Handles multi-page automatically.
 */
export function generateQuotationPdf(data: QuotationPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - 2 * margin;

  const companyName = data.company?.name || "SUKI CRM";
  const companyAddress = data.companyAddress || "";
  const companyGstin = data.companyGstin || "";
  const companyPhone = data.companyPhone || "";
  const companyEmail = data.companyEmail || "";

  let y = margin;

  // ── Company Header ──
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175); // #1e40af
  doc.text(companyName, margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // #94a3b8
  if (companyAddress) {
    const addrLines = doc.splitTextToSize(companyAddress, contentW * 0.6);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 3.5;
  }
  const companyContactParts: string[] = [];
  if (companyGstin) companyContactParts.push(`GSTIN: ${companyGstin}`);
  if (companyPhone) companyContactParts.push(companyPhone);
  if (companyEmail) companyContactParts.push(companyEmail);
  if (companyContactParts.length > 0) {
    doc.text(companyContactParts.join("  |  "), margin, y);
    y += 3.5;
  }

  // ── Quotation badge (right-aligned) ──
  const badgeX = pageW - margin;
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(badgeX - 35, margin - 2, 35, 8, 1.5, 1.5, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("QUOTATION", badgeX - 17.5, margin + 3.5, { align: "center" });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.text(data.quotationCode, badgeX, margin + 10, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Revision: R${data.revisionNumber}`, badgeX, margin + 14, { align: "right" });
  doc.text(`Status: ${data.status}`, badgeX, margin + 18, { align: "right" });
  doc.text(`Valid Until: ${formatDate(data.validUntil)}`, badgeX, margin + 22, { align: "right" });

  // Reset y to the max of left/right header content
  y = Math.max(y, margin + 26);

  // ── Divider line ──
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Meta row: Date | Valid Until | Status ──
  const colW = contentW / 3;
  const metaLabels = ["Quotation Date", "Valid Until", "Status"];
  const metaValues = [formatDate(data.createdAt), formatDate(data.validUntil), data.status];

  for (let i = 0; i < 3; i++) {
    const cx = margin + i * colW;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(148, 163, 184);
    doc.text(metaLabels[i].toUpperCase(), cx, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(metaValues[i], cx, y + 4.5);
  }
  y += 12;

  // ── Bill To / Contact ──
  const halfW = contentW / 2 - 3;

  // Bill To (left)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("BILL TO", margin, y);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.customer?.name || "—", margin, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  let billY = y + 8;
  if (data.customer?.customerCode) {
    doc.text(`Code: ${data.customer.customerCode}`, margin, billY); billY += 3.5;
  }
  if (data.customer?.billingAddress) {
    const addrLines = doc.splitTextToSize(data.customer.billingAddress, halfW);
    doc.text(addrLines, margin, billY);
    billY += addrLines.length * 3.5;
  }
  if (data.customer?.city) {
    doc.text(data.customer.city, margin, billY); billY += 3.5;
  }
  if (data.customer?.gstNumber) {
    doc.text(`GSTIN: ${data.customer.gstNumber}`, margin, billY); billY += 3.5;
  }
  if (data.customer?.phone) {
    doc.text(`Phone: ${data.customer.phone}`, margin, billY); billY += 3.5;
  }
  if (data.customer?.email) {
    doc.text(`Email: ${data.customer.email}`, margin, billY); billY += 3.5;
  }

  // Contact (right)
  const contactX = margin + halfW + 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("CONTACT", contactX, y);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.contact?.name || "—", contactX, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  let conY = y + 8;
  if (data.contact?.email) {
    doc.text(data.contact.email, contactX, conY); conY += 3.5;
  }
  if (data.contact?.phone) {
    doc.text(data.contact.phone, contactX, conY); conY += 3.5;
  }

  y = Math.max(billY, conY) + 4;

  // Deal info if linked
  if (data.deal) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Opportunity: ${data.deal.dealName}`, margin, y);
    y += 5;
  }

  // ── Line items table ──
  const head = [["#", "Description", "HSN", "Qty", "UOM", "Unit Price", "Disc%", "Tax%", "Line Total"]];

  const body = data.items.map((it, idx) => [
    String(idx + 1),
    it.description || it.product?.name || "—",
    it.hsn || "-",
    String(it.quantity),
    it.unit || "Nos",
    formatCurrency(it.unitPrice),
    `${it.discountPercent || 0}%`,
    `${it.taxPercent || 0}%`,
    formatCurrency(it.lineTotal || it.totalPrice || 0),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin + 5, bottom: 20 },
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak", lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 12, halign: "right" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 11, halign: "center" },
      7: { cellWidth: 11, halign: "center" },
      8: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => {
      // Footer on every page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageW - margin, pageHeight - 12);
      const pageText = `Page ${doc.getNumberOfPages()}`;
      doc.text(`This is a computer-generated quotation and does not require a physical signature.`, margin, pageHeight - 7);
      doc.text(pageText, pageW - margin, pageHeight - 7, { align: "right" });
    },
  });

  // lastAutoTable is added by jspdf-autotable at runtime
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Totals section (right-aligned) ──
  // After applyNegotiationRevision, subtotal is ALREADY net of discount (sum of discounted
  // totalPrice values). Showing Subtotal - Discount + Tax doesn't add up to Grand Total.
  // Instead: compute gross from discountPercent, show Gross → Discount → Net Subtotal → Tax → Grand Total.
  const totalsW = 70;
  const totalsX = pageW - margin - totalsW;
  const labelX = totalsX;
  const valueX = pageW - margin;

  const netSubtotal = data.subtotal || data.totalAmount;
  const discountPct = data.discountPercent || 0;
  const grossSubtotal = discountPct > 0 ? netSubtotal / (1 - discountPct / 100) : netSubtotal;
  const discountAmount = grossSubtotal - netSubtotal;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Gross Total", labelX, y);
  doc.text(formatCurrency(grossSubtotal), valueX, y, { align: "right" });
  y += 5;

  doc.text(`Discount (${discountPct}%)`, labelX, y);
  doc.setTextColor(220, 38, 38);
  doc.text(`-${formatCurrency(discountAmount)}`, valueX, y, { align: "right" });
  y += 5;

  doc.setTextColor(71, 85, 105);
  doc.text("Net Subtotal", labelX, y);
  doc.text(formatCurrency(netSubtotal), valueX, y, { align: "right" });
  y += 5;

  doc.text("Tax (GST)", labelX, y);
  doc.text(formatCurrency(data.taxAmount || 0), valueX, y, { align: "right" });
  y += 5;

  // Grand total with border
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.8);
  doc.line(totalsX, y, valueX, y);
  y += 5;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Grand Total", labelX, y);
  doc.text(formatCurrency(data.finalAmount), valueX, y, { align: "right" });
  y += 8;

  // ── Terms section ──
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);

  const addTermsBlock = (label: string, content: string) => {
    if (!content) return;
    // Check if we need a new page
    if (y > pageH - 40) {
      doc.addPage();
      y = margin + 5;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(content, contentW);
    // Render line by line to handle page breaks
    for (const line of lines) {
      if (y > pageH - 15) {
        doc.addPage();
        y = margin + 5;
      }
      doc.text(line, margin, y);
      y += 3.5;
    }
    y += 3;
  };

  // Commercial terms in a grid
  if (data.paymentTerms || data.deliveryTerms || data.freightTerms || data.leadTimeDays) {
    if (y > pageH - 30) {
      doc.addPage();
      y = margin + 5;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("COMMERCIAL TERMS", margin, y);
    y += 5;

    const terms: Array<[string, string]> = [
      ["Payment:", data.paymentTerms || "As per standard terms"],
      ["Delivery:", data.deliveryTerms || "As per standard terms"],
      ["Freight:", data.freightTerms || "Extra at actuals"],
      ["Lead Time:", data.leadTimeDays ? `${data.leadTimeDays} days` : "As per standard"],
    ];

    const termColW = contentW / 2;
    for (let i = 0; i < terms.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = margin + col * termColW;
      const ty = y + row * 4;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(terms[i][0], tx, ty);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      const valLines = doc.splitTextToSize(terms[i][1], termColW - 22);
      doc.text(valLines[0] || "", tx + 20, ty);
    }
    y += Math.ceil(terms.length / 2) * 4 + 4;
  }

  addTermsBlock("TERMS & CONDITIONS", data.termsAndConditions || "");

  // ── Signature line ──
  if (y > pageH - 35) {
    doc.addPage();
    y = margin + 5;
  }
  y += 15;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(pageW - margin - 60, y, pageW - margin, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text(`For ${companyName}`, pageW - margin, y, { align: "right" });

  // ── Generation info ──
  y += 8;
  if (y > pageH - 15) {
    doc.addPage();
    y = margin + 5;
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  if (data.generatedByName) {
    doc.text(`Generated by ${data.generatedByName} on ${new Date().toLocaleString("en-IN")}`, margin, y);
    y += 3;
  }
  doc.text(`Created by ${data.createdBy?.name || "—"}`, margin, y);

  return doc;
}
