import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const hostedBy = searchParams.get("hostedBy");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (hostedBy) where.hostedBy = hostedBy;

  // SalesExecutive sees only own visits
  if (user.role === "SalesExecutive") where.hostedBy = user.id;

  const [visits, total] = await Promise.all([
    prisma.customerVisit.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        host: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerVisit.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: visits, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  const visit = await prisma.customerVisit.create({
    data: {
      customerId: body.customerId,
      purpose: body.purpose,
      priority: body.priority || "Normal",
      meetingType: body.meetingType || null,
      source: body.source || null,
      agenda: body.agenda || null,
      department: body.department || null,
      hostedBy: user.id,
      status: "PLANNED",
      checkInTime: new Date(), // Will be updated on check-in; default to now
      companyId: user.companyId,
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      host: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: visit }, { status: 201 });
}
