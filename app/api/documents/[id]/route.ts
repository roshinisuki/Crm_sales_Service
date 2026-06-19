import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const document = await prisma.cRMDocument.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      Customer: { select: { id: true, name: true, customerCode: true } },
    },
  });

  if (!document) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: document });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.cRMDocument.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.documentType !== undefined) data.documentType = body.documentType;
  if (body.description !== undefined) data.description = body.description;
  if (body.tags !== undefined) data.tags = body.tags;

  const document = await prisma.cRMDocument.update({ where: { id }, data });

  return NextResponse.json({ success: true, data: document });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.cRMDocument.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });

  await prisma.cRMDocument.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Document deleted" });
}
