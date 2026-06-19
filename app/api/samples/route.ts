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
  const productId = searchParams.get("productId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (productId) where.productId = productId;

  const [samples, total] = await Promise.all([
    prisma.sampleRequest.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true, productCode: true, unit: true } },
        rfq: { select: { id: true, rfqCode: true } },
        assignedUser: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sampleRequest.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: samples, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  if (!body.customerId) {
    return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ success: false, message: "Product is required" }, { status: 400 });
  }

  // Auto-generate sampleCode
  const count = await prisma.sampleRequest.count({ where: { companyId: user.companyId } });
  const sampleCode = `SMP-${String(count + 1).padStart(4, "0")}`;

  const sample = await prisma.sampleRequest.create({
    data: {
      sampleCode,
      customerId: body.customerId,
      contactId: body.contactId || null,
      productId: body.productId,
      rfqId: body.rfqId || null,
      quantity: body.quantity ? parseFloat(body.quantity) : 1,
      specifications: body.specifications || null,
      assignedUserId: body.assignedUserId || null,
      status: "New",
      companyId: user.companyId,
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      product: { select: { id: true, name: true, productCode: true, unit: true } },
      rfq: { select: { id: true, rfqCode: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: sample }, { status: 201 });
}
