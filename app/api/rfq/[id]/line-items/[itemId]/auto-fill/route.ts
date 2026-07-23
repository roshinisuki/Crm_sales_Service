import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET: Auto-fill costing values from BOM, Routing, and ProductCategory defaults
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/line-items/[itemId]/auto-fill");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

  // Validate RFQ exists
  const rfq = await prisma.rFQ.findUnique({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Get line item with product and category
  const lineItem = await prisma.rFQLineItem.findUnique({
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
    const boms = await prisma.bOMItem.findMany({
      where: { productId: lineItem.productId, companyId: user.companyId },
    });
    if (boms.length > 0) {
      const now = new Date();
      for (const bom of boms) {
        const materials = await prisma.materialRate.findMany({
          where: { 
            materialCode: bom.materialCode, 
            companyId: user.companyId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          orderBy: { validFrom: "desc" },
          take: 1,
        });
        const rate = materials[0];
        if (rate) {
          materialCost += bom.quantity.toNumber() * rate.unitRate.toNumber() * (1 + bom.scrapPercent.toNumber() / 100);
        }
      }
      sources.material_cost = "bom";
    }

    // Calculate labor cost from Routing × LaborRate
    const ops = await prisma.routingOperation.findMany({
      where: { productId: lineItem.productId, companyId: user.companyId },
      orderBy: { sequence: "asc" },
    });
    if (ops.length > 0) {
      const now = new Date();
      for (const op of ops) {
        const rates = await prisma.laborRate.findMany({
          where: { 
            workCenter: op.workCenter, 
            companyId: user.companyId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          orderBy: { validFrom: "desc" },
          take: 1,
        });
        const rate = rates[0];
        if (rate) {
          labourCost += op.cycleTimeMin.toNumber() * rate.hourlyRate.toNumber() / 60 + op.setupTimeMin.toNumber() * rate.setupRate.toNumber() / 60;
        }
      }
      sources.labour_cost = "routing";
    }

    // Use category defaults for overhead and margin
    if (lineItem.product.category) {
      overheadPercent = lineItem.product.category.defaultOverheadPercent?.toNumber() || 0;
      marginPercent = lineItem.product.category.defaultMarginPercent?.toNumber() || 0;
      sources.overhead_percent = "category";
      sources.margin_percent = "category";
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      material_cost: materialCost,
      labour_cost: labourCost,
      overhead_percent: overheadPercent,
      margin_percent: marginPercent,
      sources,
    },
  });
}
