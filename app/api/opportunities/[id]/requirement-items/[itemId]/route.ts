import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PATCH /api/opportunities/[id]/requirement-items/[itemId]
// Updates product name, qty, price, material, delivery, notes, attachment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

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

  const body = await request.json();
  const { productName, estimatedQuantity, targetPriceMin, targetPriceMax, material, requiredDelivery, specNotes, attachmentUrl, displayOrder } = body;

  if (productName !== undefined && !productName?.trim()) {
    return NextResponse.json({ success: false, message: "productName cannot be empty" }, { status: 400 });
  }
  const qty = estimatedQuantity !== undefined ? parseInt(estimatedQuantity) : undefined;
  if (qty !== undefined && (isNaN(qty) || qty < 1)) {
    return NextResponse.json({ success: false, message: "estimatedQuantity must be a positive integer" }, { status: 400 });
  }

  const updated = await prisma.opportunityRequirementItem.update({
    where: { id: itemId },
    data: {
      ...(productName !== undefined ? { productName: productName.trim() } : {}),
      ...(qty !== undefined ? { estimatedQuantity: qty } : {}),
      ...(targetPriceMin !== undefined ? { targetPriceMin: targetPriceMin !== "" && targetPriceMin != null ? parseFloat(targetPriceMin) : null } : {}),
      ...(targetPriceMax !== undefined ? { targetPriceMax: targetPriceMax !== "" && targetPriceMax != null ? parseFloat(targetPriceMax) : null } : {}),
      ...(material !== undefined ? { material: material?.trim() || null } : {}),
      ...(requiredDelivery !== undefined ? { requiredDelivery: requiredDelivery ? new Date(requiredDelivery) : null } : {}),
      ...(specNotes !== undefined ? { specNotes: specNotes?.trim() || null } : {}),
      ...(attachmentUrl !== undefined ? { attachmentUrl: attachmentUrl?.trim() || null } : {}),
      ...(displayOrder !== undefined ? { displayOrder: parseInt(displayOrder) } : {}),
    },
    include: { technicalNote: { include: { engineer: { select: { id: true, name: true } } } } },
  });

  await logAudit(user.id, "Opportunity", "RequirementItem.Update",
    `Updated product requirement: ${updated.productName} on opportunity ${id}`,
    { resourceId: id, severity: "INFO" }
  );

  return NextResponse.json({ success: true, data: updated });
}
