import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generateQuotationPdf } from "@/lib/generateQuotationPdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const revParam = searchParams.get("revision");
  const roundParam = searchParams.get("round");

  const dbQuotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, city: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      company: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!dbQuotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  let quotation: any = null;
  if (roundParam) {
    // Round-based lookup (negotiation round) — take the LATEST snapshot for that
    // round (the "after" snapshot reflects the negotiated state, see Bug #4).
    const roundNum = parseInt(roundParam);
    const snapshot = await prisma.quotationRevisionSnapshot.findFirst({
      where: { quotationId: id, roundNumber: roundNum },
      orderBy: { createdAt: "desc" },
    });
    if (snapshot) {
      try {
        const snapObj = JSON.parse(snapshot.snapshotJson);
        quotation = {
          ...dbQuotation,
          ...snapObj,
          createdAt: snapObj.createdAt ? new Date(snapObj.createdAt) : dbQuotation.createdAt,
          validUntil: snapObj.validUntil ? new Date(snapObj.validUntil) : dbQuotation.validUntil,
          items: snapObj.items.map((it: any) => ({
            ...it,
            product: dbQuotation.items.find(dbi => dbi.description === it.description)?.product || null,
          })),
        };
      } catch (err) {
        console.error("Failed to parse snapshot", err);
      }
    }
  } else if (revParam) {
    const revNum = parseInt(revParam);
    const snapshot = await prisma.quotationRevisionSnapshot.findFirst({
      where: { quotationId: id, revisionNumber: revNum },
      orderBy: { createdAt: "desc" },
    });
    if (snapshot) {
      try {
        const snapObj = JSON.parse(snapshot.snapshotJson);
        quotation = {
          ...dbQuotation,
          ...snapObj,
          createdAt: snapObj.createdAt ? new Date(snapObj.createdAt) : dbQuotation.createdAt,
          validUntil: snapObj.validUntil ? new Date(snapObj.validUntil) : dbQuotation.validUntil,
          items: snapObj.items.map((it: any) => ({
            ...it,
            product: dbQuotation.items.find(dbi => dbi.description === it.description)?.product || null,
          })),
        };
      } catch (err) {
        console.error("Failed to parse snapshot", err);
      }
    }
  }

  if (!quotation) {
    quotation = dbQuotation;
  }

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

  const pdfBytes = doc.output("arraybuffer");
  const fileName = `${quotation.quotationCode}-R${quotation.revisionNumber}.pdf`;

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
