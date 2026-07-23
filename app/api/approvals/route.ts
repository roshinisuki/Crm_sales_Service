import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.APPROVAL_CENTER, "GET /api/approvals");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const approvalType = searchParams.get("approvalType") || searchParams.get("type");
  const entityType = searchParams.get("entityType");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 50;

  const where: any = {
    deletedAt: null,
  };
  if (status) where.status = status;
  if (approvalType) where.approvalType = approvalType;
  if (entityType) where.entityType = entityType;

  // Scope by company using companyId on the approval record itself (B3/B4 fix)
  where.companyId = user.companyId;

  const [approvals, total] = await Promise.all([
    prisma.approvalHistory.findMany({
      where,
      include: {
        deal: { select: { id: true, dealName: true, companyId: true, customer: { select: { id: true, name: true } } } },
        requestedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.approvalHistory.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: approvals, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.APPROVAL_CENTER, "POST /api/approvals");
  if (guard) return guard;

  const body = await request.json();

  if (!body.approvalType) return NextResponse.json({ success: false, message: "Approval type is required" }, { status: 400 });
  if (!body.entityType) return NextResponse.json({ success: false, message: "Entity type is required" }, { status: 400 });
  if (!body.entityId) return NextResponse.json({ success: false, message: "Entity ID is required" }, { status: 400 });

  // Verify entity belongs to user's company
  let entityCompanyId: string | undefined;
  let dealId: string | undefined;
  if (body.entityType === "Deal") {
    const deal = await prisma.deal.findFirst({ where: { id: body.entityId, companyId: user.companyId } });
    if (!deal) return NextResponse.json({ success: false, message: "Deal not found" }, { status: 404 });
    entityCompanyId = deal.companyId ?? undefined;
    dealId = deal.id;
  }

  const approval = await prisma.approvalHistory.create({
    data: {
      dealId: dealId || null,
      requestedById: user.id,
      discountPercent: body.discountPercent || 0,
      status: "Pending",
      remarks: body.remarks || null,
      approvalType: body.approvalType,
      entityType: body.entityType,
      entityId: body.entityId,
      companyId: user.companyId,
    },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { id: true, name: true } } } },
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // If discount approval, lock the deal
  if (body.approvalType === "Discount" && dealId) {
    await prisma.deal.update({
      where: { id: dealId },
      data: { isLocked: true, discountStatus: "Pending" },
    });
  }

  return NextResponse.json({ success: true, data: approval });
}
