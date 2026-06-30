import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// POST /api/catalogue/products/bulk-import
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid products array" }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const product of products) {
      try {
        // Auto-generate productCode per company
        const prefix = "PRD";
        const count = await prisma.product.count({
          where: { companyId: user.companyId },
        });
        const productCode = `${prefix}-${String(count + 1).padStart(4, "0")}`;

        await prisma.product.create({
          data: {
            id: nanoid(),
            productCode,
            name: product.name,
            categoryId: product.categoryId ?? null,
            description: product.description ?? null,
            unit: product.unit ?? null,
            basePrice: product.basePrice ? parseFloat(product.basePrice) : null,
            isActive: product.isActive ?? true,
            productImageUrl: product.productImageUrl ?? null,
            productType: product.productType ?? null,
            minOrderQuantity: product.minOrderQuantity ? parseFloat(product.minOrderQuantity) : null,
            companyId: user.companyId ?? null,
          },
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Failed to import ${product.name}: ${error.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: results,
      message: `Imported ${results.success} products successfully. ${results.failed} failed.`
    });
  } catch (error: any) {
    console.error("POST /api/catalogue/products/bulk-import error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
