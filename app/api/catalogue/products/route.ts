import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

// GET /api/catalogue/products
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "GET /api/catalogue/products");
    if (guard) return guard;

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const categoryId = url.searchParams.get("categoryId") || "";
    const isActive = url.searchParams.get("isActive");
    const view = url.searchParams.get("view") || "";
    const productType = url.searchParams.get("productType") || "";
    const minPrice = url.searchParams.get("minPrice") || "";
    const maxPrice = url.searchParams.get("maxPrice") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

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
      where.isActive = true; // Default to active only
    }

    if (productType) {
      where.productType = productType;
    }

    if (minPrice) {
      where.basePrice = { gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.basePrice = { lte: parseFloat(maxPrice) }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { productCode: { contains: search } },
      ];
    }

    const orderBy: any = {};
    if (sortBy === "basePrice") {
      orderBy.basePrice = sortOrder === "asc" ? "asc" : "desc";
    } else if (sortBy === "productCode") {
      orderBy.productCode = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
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
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where } ),
    ]);

    return NextResponse.json({ 
      success: true, 
      data: products, 
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } 
    });
  } catch (error: any) {
    console.error("GET /api/catalogue/products error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/catalogue/products
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "POST /api/catalogue/products");
    if (guard) return guard;

    const body = await request.json();

    // Auto-generate productCode per company
    const prefix = "PRD";
    const count = await prisma.product.count({
      where: { companyId: user.companyId },
    });
    const productCode = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    const product = await prisma.product.create({
      data: {
        id: nanoid(),
        productCode,
        name: body.name,
        categoryId: body.categoryId ?? null,
        description: body.description ?? null,
        unit: body.unit ?? null,
        basePrice: body.basePrice ?? null,
        isActive: body.isActive ?? true,
        productType: body.productType ?? null,
        minOrderQuantity: body.minOrderQuantity ? parseFloat(body.minOrderQuantity) : null,
        companyId: user.companyId ?? null,
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/catalogue/products error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
