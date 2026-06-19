import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const assignedUserId = searchParams.get("assignedUserId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const [rfqs, total] = await Promise.all([
    prisma.rFQ.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        product: { select: { id: true, name: true, productCode: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rFQ.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rfqs, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  // Auto-generate rfqCode
  const count = await prisma.rFQ.count({ where: { companyId: user.companyId } });
  const rfqCode = `RFQ-${String(count + 1).padStart(4, "0")}`;

  const rfq = await prisma.rFQ.create({
    data: {
      rfqCode,
      customerId: body.customerId,
      contactId: body.contactId || null,
      productId: body.productId || null,
      quantity: body.quantity ? parseFloat(body.quantity) : null,
      targetPrice: body.targetPrice ? parseFloat(body.targetPrice) : null,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
      requirementDetails: body.requirementDetails || null,
      assignedUserId: body.assignedUserId || null,
      notes: body.notes || null,
      status: "New",
      companyId: user.companyId,
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      product: { select: { id: true, name: true, productCode: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: rfq }, { status: 201 });
}
