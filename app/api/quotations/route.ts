import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quotation.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: quotations, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  // Calculate totals
  const items = body.items || [];
  const totalAmount = items.reduce((sum: number, item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const discountPercent = parseFloat(body.discountPercent) || 0;
  const finalAmount = totalAmount * (1 - discountPercent / 100);

  // Auto-generate quotationCode
  const count = await prisma.quotation.count({ where: { companyId: user.companyId } });
  const quotationCode = `QUO-${String(count + 1).padStart(4, "0")}`;

  const quotation = await prisma.quotation.create({
    data: {
      quotationCode,
      rfqId: body.rfqId || null,
      customerId: body.customerId,
      contactId: body.contactId || null,
      dealId: body.dealId || null,
      validUntil: new Date(body.validUntil),
      discountPercent,
      totalAmount,
      finalAmount,
      termsAndConditions: body.termsAndConditions || null,
      status: "Draft",
      createdById: user.id,
      companyId: user.companyId,
      items: {
        create: items.map((item: any) => ({
          productId: item.productId || null,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
          notes: item.notes || null,
        })),
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: quotation }, { status: 201 });
}
