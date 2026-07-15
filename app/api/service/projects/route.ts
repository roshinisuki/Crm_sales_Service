import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const dealId = searchParams.get("dealId");
  const search = searchParams.get("search");

  const where: any = {};
  if (status && status !== "All") where.status = status;
  if (customerId) where.customerId = customerId;
  if (dealId) where.dealId = dealId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { projectCode: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      _count: { select: { assets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: projects });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, projectCode, customerId, dealId, status, startDate, endDate, notes } = body;

  if (!name?.trim() || !projectCode?.trim() || !customerId) {
    return NextResponse.json({ success: false, message: "Name, project code, and customer are required" }, { status: 400 });
  }

  const existing = await prisma.project.findUnique({ where: { projectCode } });
  if (existing) {
    return NextResponse.json({ success: false, message: "Project code already exists" }, { status: 409 });
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      projectCode: projectCode.trim(),
      customerId,
      dealId: dealId || null,
      status: status || "Active",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
      createdById: user.id,
    },
  });

  await logAudit(user.id, "Project", "Create", `Created project ${project.projectCode} (${project.name})`);

  return NextResponse.json({ success: true, data: project }, { status: 201 });
}
