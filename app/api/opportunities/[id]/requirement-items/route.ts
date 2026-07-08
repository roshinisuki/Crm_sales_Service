import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET /api/opportunities/[id]/requirement-items
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  const items = await prisma.opportunityRequirementItem.findMany({
    where: { dealId: id },
    include: {
      technicalNote: {
        include: {
          engineer: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ success: true, data: items });
}

// POST /api/opportunities/[id]/requirement-items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, assignedUserId: true },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { productName, estimatedQuantity, targetPriceMin, targetPriceMax, material, requiredDelivery, specNotes, attachmentUrl } = body;

  if (!productName?.trim()) {
    return NextResponse.json({ success: false, message: "productName is required" }, { status: 400 });
  }
  const qty = parseInt(estimatedQuantity);
  if (!estimatedQuantity || isNaN(qty) || qty < 1) {
    return NextResponse.json({ success: false, message: "estimatedQuantity must be a positive integer" }, { status: 400 });
  }

  const maxOrder = await prisma.opportunityRequirementItem.aggregate({
    where: { dealId: id },
    _max: { displayOrder: true },
  });

  const item = await prisma.opportunityRequirementItem.create({
    data: {
      dealId: id,
      productName: productName.trim(),
      estimatedQuantity: qty,
      targetPriceMin: targetPriceMin != null && targetPriceMin !== "" ? parseFloat(targetPriceMin) : null,
      targetPriceMax: targetPriceMax != null && targetPriceMax !== "" ? parseFloat(targetPriceMax) : null,
      material: material?.trim() || null,
      requiredDelivery: requiredDelivery ? new Date(requiredDelivery) : null,
      specNotes: specNotes?.trim() || null,
      attachmentUrl: attachmentUrl?.trim() || null,
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
    },
    include: { technicalNote: true },
  });

  await logAudit(user.id, "Opportunity", "RequirementItem.Create",
    `Added product requirement: ${productName} x${qty} to opportunity ${id}`,
    { resourceId: id, newState: { productName, estimatedQuantity: qty }, severity: "INFO" }
  );

  return NextResponse.json({ success: true, data: item }, { status: 201 });
}

// DELETE /api/opportunities/[id]/requirement-items?itemId=
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) return NextResponse.json({ success: false, message: "itemId is required" }, { status: 400 });

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, assignedUserId: true },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const item = await prisma.opportunityRequirementItem.findFirst({ where: { id: itemId, dealId: id } });
  if (!item) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });

  await prisma.opportunityRequirementItem.delete({ where: { id: itemId } });

  await logAudit(user.id, "Opportunity", "RequirementItem.Delete",
    `Removed product requirement: ${item.productName} from opportunity ${id}`,
    { resourceId: id, previousState: { productName: item.productName }, severity: "WARN" }
  );

  return NextResponse.json({ success: true, message: "Item deleted" });
}
