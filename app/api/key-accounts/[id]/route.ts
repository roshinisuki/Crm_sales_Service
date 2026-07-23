import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/key-accounts/[id]");
  if (guard) return guard;

  const { id } = await params;
  const keyAccount = await prisma.keyAccount.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: {
        select: {
          id: true, name: true, city: true, phone: true, email: true, customerCode: true,
          assignedUser: { select: { id: true, name: true } },
          deals: { orderBy: { createdAt: "desc" }, select: { id: true, dealName: true, dealValue: true, status: true, expectedCloseDate: true, createdAt: true } },
          quotations: { orderBy: { createdAt: "desc" }, select: { id: true, quotationCode: true, status: true, totalAmount: true, finalAmount: true, validUntil: true, createdAt: true } },
          customerVisits: { orderBy: { checkInTime: "desc" }, select: { id: true, purpose: true, outcome: true, checkInTime: true, status: true, host: { select: { name: true } } } },
          communicationLogs: { orderBy: { sentAt: "desc" }, select: { id: true, channel: true, direction: true, status: true, content: true, sentAt: true, sentByUser: { select: { name: true } } } },
          documents: { where: { entityType: "Customer" }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, documentType: true, fileUrl: true, createdAt: true } },
          contacts: { select: { id: true, name: true, email: true, phone: true, contactType: true, designation: true, isPrimary: true } },
        },
      },
      accountManager: { select: { id: true, name: true, email: true } },
    },
  });

  if (!keyAccount) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: keyAccount });
}


export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/key-accounts/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.keyAccount.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const keyAccount = await prisma.keyAccount.update({
    where: { id },
    data: {
      accountManagerId: body.accountManagerId,
      revenuePotential: body.revenuePotential ? parseFloat(body.revenuePotential) : null,
      strategicImportance: body.strategicImportance,
      relationshipStatus: body.relationshipStatus,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      notes: body.notes,
    },
  });

  return NextResponse.json({ success: true, data: keyAccount });
}


export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.KEY_ACCOUNTS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/key-accounts/[id]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.keyAccount.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.keyAccount.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });
  return NextResponse.json({ success: true });
}
