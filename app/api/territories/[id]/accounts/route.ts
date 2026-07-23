import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TERRITORIES, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/territories/[id]/accounts");
  if (guard) return guard;

  const { id } = await params;
  const territory = await prisma.territory.findFirst({ where: { id, companyId: user.companyId } });
  if (!territory) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const accounts = await prisma.territoryAccount.findMany({
    where: { territoryId: id },
    include: {
      customer: {
        select: {
          id: true, customerCode: true, name: true, city: true,
          assignedUser: { select: { id: true, name: true } },
          deals: { where: { status: "Won" }, select: { dealValue: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: accounts });
}


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TERRITORIES, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/territories/[id]/accounts");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  if (!body.customerId) return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });

  const territory = await prisma.territory.findFirst({ where: { id, companyId: user.companyId } });
  if (!territory) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Check if already assigned
  const existing = await prisma.territoryAccount.findFirst({
    where: { territoryId: id, customerId: body.customerId },
  });
  if (existing) return NextResponse.json({ success: false, message: "Customer already in this territory" }, { status: 400 });

  const account = await prisma.territoryAccount.create({
    data: { territoryId: id, customerId: body.customerId },
  });

  return NextResponse.json({ success: true, data: account });
}


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TERRITORIES, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/territories/[id]/accounts");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const accountRecordId = searchParams.get("accountRecordId");
  const customerId = searchParams.get("customerId");

  const territory = await prisma.territory.findFirst({ where: { id, companyId: user.companyId } });
  if (!territory) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  if (accountRecordId) {
    await prisma.territoryAccount.delete({ where: { id: accountRecordId } });
  } else if (customerId) {
    await prisma.territoryAccount.deleteMany({ where: { territoryId: id, customerId } });
  } else {
    return NextResponse.json({ success: false, message: "accountRecordId or customerId required" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
