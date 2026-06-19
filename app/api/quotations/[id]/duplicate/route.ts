import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  // Auto-generate new quotationCode
  const count = await prisma.quotation.count({ where: { companyId: user.companyId } });
  const quotationCode = `QUO-${String(count + 1).padStart(4, "0")}`;

  const newQuotation = await prisma.quotation.create({
    data: {
      quotationCode,
      rfqId: existing.rfqId,
      customerId: existing.customerId,
      contactId: existing.contactId,
      dealId: existing.dealId,
      validUntil: existing.validUntil,
      totalAmount: existing.totalAmount,
      discountPercent: existing.discountPercent,
      finalAmount: existing.finalAmount,
      termsAndConditions: existing.termsAndConditions,
      status: "Draft",
      createdById: user.id,
      companyId: user.companyId,
      items: {
        create: existing.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
        })),
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json({ success: true, data: newQuotation }, { status: 201 });
}
