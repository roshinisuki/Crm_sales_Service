import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const assignedUserId = searchParams.get("assignedUserId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (search) {
    where.OR = [
      { negotiationCode: { contains: search } },
      { customer: { name: { contains: search } } },
      { deal: { dealName: { contains: search } } },
      { quotation: { quotationCode: { contains: search } } },
    ];
  }

  const [negotiations, total] = await Promise.all([
    prisma.negotiation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
        deal: { select: { id: true, dealName: true } },
        assignedUser: { select: { id: true, name: true } },
        _count: { select: { revisions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.negotiation.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: negotiations, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  if (!body.customerId) {
    return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  }
  if (body.initialAmount === undefined || body.initialAmount === null || body.initialAmount === "") {
    return NextResponse.json({ success: false, message: "Initial amount is required" }, { status: 400 });
  }

  // Auto-generate negotiationCode
  const count = await prisma.negotiation.count({ where: { companyId: user.companyId } });
  const negotiationCode = `NEG-${String(count + 1).padStart(4, "0")}`;

  const negotiation = await prisma.negotiation.create({
    data: {
      negotiationCode,
      customerId: body.customerId,
      contactId: body.contactId || null,
      quotationId: body.quotationId || null,
      dealId: body.dealId || null,
      initialAmount: parseFloat(body.initialAmount),
      customerDemands: body.customerDemands || null,
      internalNotes: body.internalNotes || null,
      assignedUserId: body.assignedUserId || null,
      status: "Active",
      companyId: user.companyId,
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true, finalAmount: true } },
      deal: { select: { id: true, dealName: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  await logAudit(user.id, "Negotiation", "Create", `Created negotiation ${negotiationCode}`, {
    resourceId: negotiation.id,
    newState: { negotiationCode, customerId: body.customerId, initialAmount: parseFloat(body.initialAmount), status: "Active" },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: negotiation }, { status: 201 });
}
