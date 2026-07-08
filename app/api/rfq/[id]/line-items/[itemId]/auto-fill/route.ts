import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET: Auto-fill costing values from BOM, Routing, and ProductCategory defaults
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

  // Validate RFQ exists
  const rfq = await prisma.RFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Get line item with product and category
  const lineItem = await prisma.RFQLineItem.findFirst({
    where: { id: itemId, rfqId: id },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });
  if (!lineItem) return NextResponse.json({ success: false, message: "Line item not found" }, { status: 404 });

  let materialCost = 0;
  let labourCost = 0;
  let overheadPercent = 0;
  let marginPercent = 0;
  const sources: Record<string, string> = {
    material_cost: "manual",
    labour_cost: "manual",
    overhead_percent: "manual",
    margin_percent: "manual",
  };

  if (lineItem.productId && lineItem.product) {
    // Calculate material cost from BOM × MaterialRate
    const bomItems = await prisma.BOMItem.findMany({
      where: { productId: lineItem.productId, companyId: user.companyId },
    });
    if (bomItems.length > 0) {
      for (const bom of bomItems) {
        const rate = await prisma.MaterialRate.findFirst({
          where: { materialCode: bom.materialCode, companyId: user.companyId },
        });
        if (rate) {
          materialCost += bom.quantity * rate.unitRate * (1 + bom.scrapPercent / 100);
        }
      }
      sources.material_cost = "bom";
    }

    // Calculate labor cost from Routing × LaborRate
    const routingOps = await prisma.RoutingOperation.findMany({
      where: { productId: lineItem.productId, companyId: user.companyId },
      orderBy: { sequence: "asc" },
    });
    if (routingOps.length > 0) {
      for (const op of routingOps) {
        const rate = await prisma.LaborRate.findFirst({
          where: { workCenter: op.workCenter, companyId: user.companyId },
        });
        if (rate) {
          labourCost += op.cycleTimeMin * rate.hourlyRate / 60 + op.setupTimeMin * rate.setupRate / 60;
        }
      }
      sources.labour_cost = "routing";
    }

    // Use category defaults for overhead and margin
    if (lineItem.product.category) {
      overheadPercent = lineItem.product.category.defaultOverheadPercent || 0;
      marginPercent = lineItem.product.category.defaultMarginPercent || 0;
      sources.overhead_percent = "category";
      sources.margin_percent = "category";
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      material_cost: materialCost,
      labourCost: labourCost,
      overhead_percent: overheadPercent,
      margin_percent: marginPercent,
      sources,
    },
  });
}
