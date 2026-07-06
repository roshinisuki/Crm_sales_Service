import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      company: { select: { id: true, name: true } },
    },
  });

  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  // Build printable HTML
  const companyName = quotation.company?.name || "SUKI CRM";
  const companyAddress = "";
  const companyGstin = "";

  const formatDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const rowsHtml = quotation.items.map((item, idx) => {
    const lineTotal = item.lineTotal || item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    return `<tr style="background:${rowBg};">
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${idx + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:500;color:#1e293b;">${item.description}${item.product ? `<br/><span style="font-size:10px;color:#94a3b8;font-weight:400;">${item.product.productCode}</span>` : ""}</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.hsn || "-"}</td>
      <td style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#1e293b;">${item.quantity}</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.unit || "Nos"}</td>
      <td style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#1e293b;">₹${item.unitPrice.toFixed(2)}</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.discountPercent || 0}%</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.taxPercent || 18}%</td>
      <td style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e40af;">₹${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const discountAmount = quotation.subtotal * (quotation.discountPercent / 100);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quotation ${quotation.quotationCode}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; background: #f1f5f9; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .quotation-doc { max-width: 820px; margin: 0 auto; background: white; padding: 48px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 2px solid #1e40af; }
  .company-block { display: flex; align-items: center; gap: 12px; }
  .company-logo { width: 44px; height: 44px; border-radius: 8px; background: #1e40af; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 800; flex-shrink: 0; }
  .company-name { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.02em; }
  .company-info { font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.5; }
  .quo-badge { background: #1e40af; color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; }
  .quo-code { margin-top: 10px; font-size: 15px; font-weight: 700; color: #1e293b; text-align: right; }
  .revision-badge { display: inline-block; background: #f59e0b; color: white; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 6px; }
  
  /* Meta section */
  .meta-row { display: flex; gap: 48px; margin-bottom: 28px; }
  .meta-col { flex: 1; }
  .meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 5px; }
  .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; }
  .meta-sub { font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.5; }
  
  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { background: #1e293b; color: white; padding: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
  thead th:first-child { border-radius: 6px 0 0 0; }
  thead th:last-child { border-radius: 0 6px 0 0; text-align: right; }
  tbody tr:last-child td { border-bottom: none; }
  
  /* Totals */
  .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals-section { width: 320px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; }
  .total-row .label { font-weight: 500; }
  .total-row .value { font-weight: 600; color: #1e293b; }
  .grand-total { border-top: 2px solid #1e40af; padding-top: 12px; margin-top: 6px; font-size: 18px; font-weight: 800; color: #1e40af; }
  .grand-total .label { font-weight: 700; }
  .grand-total .value { font-weight: 800; }
  
  /* Terms */
  .terms-section { margin-top: 8px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .terms-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
  .terms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px; }
  .term-label { font-weight: 600; color: #475569; }
  .term-value { color: #64748b; }
  .tc-text { font-size: 11px; color: #94a3b8; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  
  /* Signature */
  .signature { margin-top: 48px; display: flex; justify-content: flex-end; }
  .sig-block { text-align: center; }
  .sig-line { border-top: 1.5px solid #cbd5e1; width: 220px; margin-top: 48px; padding-top: 10px; font-size: 12px; font-weight: 600; color: #475569; }
  
  /* Footer */
  .doc-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  
  @media print { 
    body { background: white; padding: 0; } 
    .quotation-doc { box-shadow: none; max-width: 100%; padding: 24px; border-radius: 0; } 
  }
</style>
</head>
<body>
<div class="quotation-doc">
  <div class="header">
    <div class="company-block">
      <div class="company-logo">${companyName.charAt(0)}</div>
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-info">${companyAddress || "Industrial Solutions Provider"}</div>
        ${companyGstin ? `<div class="company-info">GSTIN: ${companyGstin}</div>` : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div class="quo-badge">QUOTATION</div>
      <div class="quo-code">${quotation.quotationCode}</div>
      ${quotation.revisionNumber && quotation.revisionNumber > 0 ? `<div class="revision-badge">REVISION R${quotation.revisionNumber}</div>` : ""}
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-col">
      <div class="meta-label">Quotation Date</div>
      <div class="meta-value">${formatDate(quotation.createdAt)}</div>
    </div>
    <div class="meta-col">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value">${formatDate(quotation.validUntil)}</div>
    </div>
    <div class="meta-col">
      <div class="meta-label">Status</div>
      <div class="meta-value">${quotation.status}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-col">
      <div class="meta-label">Bill To</div>
      <div class="meta-value">${quotation.customer?.name || ""}</div>
      <div class="meta-sub">${quotation.customer?.billingAddress || ""}</div>
      ${quotation.customer?.gstNumber ? `<div class="meta-sub">GSTIN: ${quotation.customer.gstNumber}</div>` : ""}
    </div>
    <div class="meta-col">
      <div class="meta-label">Contact</div>
      <div class="meta-value">${quotation.contact?.name || "-"}</div>
      <div class="meta-sub">${quotation.contact?.email || ""}</div>
      <div class="meta-sub">${quotation.contact?.phone || ""}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th>Description</th>
        <th style="width:60px;">HSN</th>
        <th style="width:50px;text-align:right;">Qty</th>
        <th style="width:50px;text-align:center;">UOM</th>
        <th style="width:80px;text-align:right;">Unit Price</th>
        <th style="width:40px;text-align:center;">Disc%</th>
        <th style="width:40px;text-align:center;">Tax%</th>
        <th style="width:100px;text-align:right;">Line Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals-wrapper">
    <div class="totals-section">
      <div class="total-row"><span class="label">Subtotal</span><span class="value">₹${quotation.subtotal.toFixed(2)}</span></div>
      <div class="total-row"><span class="label">Discount (${quotation.discountPercent}%)</span><span class="value" style="color:#dc2626;">-₹${discountAmount.toFixed(2)}</span></div>
      <div class="total-row"><span class="label">Tax (GST)</span><span class="value">+₹${quotation.taxAmount.toFixed(2)}</span></div>
      <div class="total-row grand-total"><span class="label">Grand Total</span><span class="value">₹${quotation.finalAmount.toFixed(2)}</span></div>
    </div>
  </div>

  <div class="terms-section">
    <div class="terms-title">Commercial Terms</div>
    <div class="terms-grid">
      <div><span class="term-label">Payment:</span> <span class="term-value">${quotation.paymentTerms || "As per standard terms"}</span></div>
      <div><span class="term-label">Delivery:</span> <span class="term-value">${quotation.deliveryTerms || "As per standard terms"}</span></div>
      <div><span class="term-label">Freight:</span> <span class="term-value">${quotation.freightTerms || "Extra at actuals"}</span></div>
      <div><span class="term-label">Lead Time:</span> <span class="term-value">${quotation.leadTimeDays ? quotation.leadTimeDays + " days" : "As per standard"}</span></div>
    </div>
    ${quotation.termsAndConditions ? `<div class="tc-text"><strong>Terms &amp; Conditions:</strong><br/>${quotation.termsAndConditions}</div>` : ""}
  </div>

  <div class="signature">
    <div class="sig-block">
      <div class="sig-line">For ${companyName}</div>
    </div>
  </div>
  
  <div class="doc-footer">
    This is a computer-generated quotation and does not require a physical signature.<br/>
    Generated on ${formatDate(new Date())} · ${companyName}
  </div>
</div>
<script>window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
