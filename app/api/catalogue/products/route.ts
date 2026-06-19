import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// GET /api/catalogue/products
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const categoryId = url.searchParams.get("categoryId") || "";
    const isActive = url.searchParams.get("isActive");
    const view = url.searchParams.get("view") || "";
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

    // Special views for datasheets and brochures
    if (view === "datasheets") {
      where.datasheetUrl = { not: null };
    } else if (view === "brochures") {
      where.brochureUrl = { not: null };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { productCode: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
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
        datasheetUrl: body.datasheetUrl ?? null,
        brochureUrl: body.brochureUrl ?? null,
        companyId: user.companyId ?? null,
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/catalogue/products error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
