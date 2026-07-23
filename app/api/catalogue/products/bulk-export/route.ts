import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/catalogue/products/bulk-export
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId") || "";
    const isActive = url.searchParams.get("isActive");

    const where: any = { deletedAt: null };
    
    if (user.companyId) {
      where.companyId = user.companyId;
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (isActive !== null) {
      where.isActive = isActive === "true";
    } else {
      where.isActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
        datasheets: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        brochures: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Convert to CSV format
    const headers = [
      "Product Code",
      "Name",
      "Category",
      "Description",
      "Unit",
      "Base Price",
      "Product Type",
      "Min Order Quantity",
      "Status",
      "Datasheets",
      "Brochures",
    ];

    const rows = products.map((p) => [
      p.productCode,
      p.name,
      p.category?.name || "",
      p.description || "",
      p.unit || "",
      p.basePrice?.toString() || "",
      p.productType || "",
      p.minOrderQuantity?.toString() || "",
      p.isActive ? "Active" : "Inactive",
      p.datasheets?.map((d: any) => d.fileName).join("; ") || "",
      p.brochures?.map((b: any) => b.fileName).join("; ") || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="products-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/bulk-export error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
