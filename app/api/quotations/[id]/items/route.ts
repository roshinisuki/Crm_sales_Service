import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  // Delete all existing items and insert new ones
  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });

  const items = body.items || [];
  const totalAmount = items.reduce((sum: number, item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const finalAmount = totalAmount * (1 - existing.discountPercent / 100);

  await prisma.quotationItem.createMany({
    data: items.map((item: any) => ({
      quotationId: id,
      productId: item.productId || null,
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unitPrice: parseFloat(item.unitPrice) || 0,
      totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
      notes: item.notes || null,
    })),
  });

  const quotation = await prisma.quotation.update({
    where: { id },
    data: { totalAmount, finalAmount },
    include: {
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: quotation });
}
