import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.emailTemplate.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!template) return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: template });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.emailTemplate.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.body !== undefined) data.body = body.body;
  if (body.module !== undefined) data.module = body.module;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const template = await prisma.emailTemplate.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: template });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.emailTemplate.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 });

  await prisma.emailTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true, message: "Template deleted" });
}
