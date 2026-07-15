import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ServiceReportPdfData {
  reportNumber: string;
  reportDate: string;
  visitCode: string;
  visitDate: string;
  customerName: string;
  customerCode?: string;
  assetName: string;
  serialNumber: string;
  engineerName: string;
  outcome: string;
  outcomeNotes: string;
  reasonNextSteps?: string;
  checkInTime?: string;
  checkOutTime?: string;
  durationMinutes?: number;
  partsUsed?: { partName: string; quantity: number; unitCost: number; totalCost: number }[];
  signatureUrl?: string | null;
  photos?: { photoUrl: string; caption?: string | null }[];
  sourceType?: string;
  sourceCode?: string;
  companyName?: string;
}

export function generateServiceReportPdf(data: ServiceReportPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.companyName || "Service Report", margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Report: ${data.reportNumber}`, margin, y);
  doc.text(`Generated: ${data.reportDate}`, pageWidth - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Visit Info ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Visit Information", margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: margin, right: margin },
    body: [
      ["Visit Code", data.visitCode, "Source", data.sourceType ? `${data.sourceType}: ${data.sourceCode || ""}` : "Standalone"],
      ["Visit Date", data.visitDate, "Engineer", data.engineerName],
      ["Check In", data.checkInTime || "-", "Check Out", data.checkOutTime || "-"],
      ["Duration", data.durationMinutes ? `${data.durationMinutes} min` : "-", "Outcome", data.outcome],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Customer & Asset ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Customer & Asset Details", margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: margin, right: margin },
    body: [
      ["Customer", data.customerName, "Customer Code", data.customerCode || "-"],
      ["Asset", data.assetName, "Serial Number", data.serialNumber],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Work Performed ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Work Performed", margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const notesLines = doc.splitTextToSize(data.outcomeNotes || "N/A", pageWidth - 2 * margin);
  doc.text(notesLines, margin, y);
  y += notesLines.length * 4 + 4;

  if (data.reasonNextSteps) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Reason & Next Steps:", margin, y);
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const nextStepsLines = doc.splitTextToSize(data.reasonNextSteps, pageWidth - 2 * margin);
    doc.text(nextStepsLines, margin, y);
    y += nextStepsLines.length * 4 + 4;
  }

  // ── Spare Parts Used ──
  if (data.partsUsed && data.partsUsed.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Spare Parts Used", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      head: [["Part Name", "Qty", "Unit Cost", "Total"]],
      body: data.partsUsed.map((p) => [
        p.partName,
        String(p.quantity),
        `Rs. ${p.unitCost.toFixed(2)}`,
        `Rs. ${p.totalCost.toFixed(2)}`,
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Signature ──
  if (data.signatureUrl) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Customer Signature", margin, y);
    y += 4;
    try {
      doc.addImage(data.signatureUrl, "PNG", margin, y, 60, 25);
      y += 28;
    } catch {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("[Signature captured but could not be rendered]", margin, y);
      y += 6;
    }
  }

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${data.reportNumber} — Generated by CRM Service Module on ${data.reportDate}`,
    margin,
    pageHeight - 10,
  );

  return doc;
}
