import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/opportunities/[id]/requirement-items/bulk
// Body: { items: Array<{ id?: string, productName, estimatedQuantity, targetPriceMin?, targetPriceMax?, material?, requiredDelivery?, specNotes?, attachmentUrl? }> }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, message: "items must be an array" }, { status: 400 });
    }

    // Validate all items first
    for (const item of items) {
      if (!item.productName?.trim()) {
        return NextResponse.json({ success: false, message: "productName is required for all items" }, { status: 400 });
      }
      const qty = parseInt(item.estimatedQuantity);
      if (item.estimatedQuantity === undefined || isNaN(qty) || qty < 1) {
        return NextResponse.json({ success: false, message: `estimatedQuantity must be a positive integer for ${item.productName}` }, { status: 400 });
      }
    }

    const savedItems = await prisma.$transaction(async (tx) => {
      const results = [];
      let index = 0;

      for (const item of items) {
        const qty = parseInt(item.estimatedQuantity);
        const data = {
          productName: item.productName.trim(),
          estimatedQuantity: qty,
          targetPriceMin: item.targetPriceMin != null && item.targetPriceMin !== "" ? parseFloat(item.targetPriceMin) : null,
          targetPriceMax: item.targetPriceMax != null && item.targetPriceMax !== "" ? parseFloat(item.targetPriceMax) : null,
          material: item.material?.trim() || null,
          requiredDelivery: item.requiredDelivery ? new Date(item.requiredDelivery) : null,
          specNotes: item.specNotes?.trim() || null,
          attachmentUrl: item.attachmentUrl?.trim() || null,
          displayOrder: index++,
        };

        if (item.id) {
          // Update
          const updated = await tx.opportunityRequirementItem.update({
            where: { id: item.id },
            data,
            include: { technicalNote: true },
          });
          results.push(updated);
        } else {
          // Create
          const created = await tx.opportunityRequirementItem.create({
            data: {
              dealId: id,
              ...data,
            },
            include: { technicalNote: true },
          });
          results.push(created);
        }
      }
      return results;
    });

    await logAudit(user.id, "Opportunity", "RequirementItem.BulkSave",
      `Bulk saved ${savedItems.length} product requirements to opportunity ${id}`,
      { resourceId: id, severity: "INFO" }
    );

    return NextResponse.json({ success: true, data: savedItems });
  } catch (error: any) {
    console.error("POST /api/opportunities/[id]/requirement-items/bulk error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to bulk save product requirements" }, { status: 500 });
  }
}
