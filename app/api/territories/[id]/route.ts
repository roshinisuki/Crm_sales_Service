import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const territory = await prisma.territory.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      accounts: {
        include: {
          customer: {
            select: {
              id: true, customerCode: true, name: true, city: true,
              assignedUser: { select: { id: true, name: true } },
              deals: { where: { status: "Won" }, select: { dealValue: true } },
            },
          },
        },
      },
      targets: { orderBy: { period: "desc" } },
      _count: { select: { accounts: true } },
    },
  });

  if (!territory) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: territory });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.territory.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const territory = await prisma.territory.update({
    where: { id },
    data: {
      name: body.name,
      region: body.region,
      states: body.states,
      assignedUserId: body.assignedUserId || null,
      isActive: body.isActive,
    },
  });

  return NextResponse.json({ success: true, data: territory });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.territory.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.territory.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });
  return NextResponse.json({ success: true });
}
