import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: {
            defaultOverheadPercent: true,
            defaultMarginPercent: true,
          },
        },
        bomItems: true,
        routingOperations: true,
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    const now = new Date();

    // 1. Calculate BOM material cost
    let materialCost = 0;
    const bomFound = product.bomItems.length > 0;

    for (const bomItem of product.bomItems) {
      // Find active material rate
      const rate = await prisma.materialRate.findFirst({
        where: {
          materialCode: bomItem.materialCode,
          validFrom: { lte: now },
          OR: [
            { validTo: null },
            { validTo: { gte: now } },
          ],
        },
        orderBy: { validFrom: "desc" },
      });

      if (rate) {
        const qty = Number(bomItem.quantity);
        const unitRate = Number(rate.unitRate);
        const scrap = Number(bomItem.scrapPercent);
        materialCost += qty * unitRate * (1 + scrap / 100);
      }
    }

    // 2. Calculate Routing labor cost
    let labourCost = 0;
    const routingFound = product.routingOperations.length > 0;

    for (const op of product.routingOperations) {
      // Find active labor rate
      const rate = await prisma.laborRate.findFirst({
        where: {
          workCenter: op.workCenter,
          validFrom: { lte: now },
          OR: [
            { validTo: null },
            { validTo: { gte: now } },
          ],
        },
        orderBy: { validFrom: "desc" },
      });

      if (rate) {
        const cycleMin = Number(op.cycleTimeMin);
        const setupMin = Number(op.setupTimeMin);
        const hrRate = Number(rate.hourlyRate);
        const suRate = Number(rate.setupRate);
        labourCost += (cycleMin / 60) * hrRate + (setupMin / 60) * suRate;
      }
    }

    // 3. Category defaults
    const overheadPercent = product.category ? Number(product.category.defaultOverheadPercent) : 0;
    const marginPercent = product.category ? Number(product.category.defaultMarginPercent) : 0;

    return NextResponse.json({
      success: true,
      data: {
        materialCost: Number(materialCost.toFixed(2)),
        labourCost: Number(labourCost.toFixed(2)),
        overheadPercent,
        marginPercent,
        bomFound,
        routingFound,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to calculate costing defaults: ${error.message}` },
      { status: 500 }
    );
  }
}
