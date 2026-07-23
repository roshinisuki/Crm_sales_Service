import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/catalogue/categories
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive");
    const search = url.searchParams.get("search") || "";

    const where: any = {};
    if (isActive !== null) {
      where.isActive = isActive === "true";
    } else {
      where.isActive = true; // Default to active only
    }

    if (user.companyId) {
      where.companyId = user.companyId;
    }

    if (search) {
      where.name = { contains: search };
    }

    const categories = await prisma.productCategory.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
        parentCategory: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const categoriesWithCount = categories.map(cat => ({
      ...cat,
      productCount: cat._count.products,
    }));

    return NextResponse.json({ success: true, data: categoriesWithCount });
  } catch (error: any) {
    console.error("GET /api/catalogue/categories error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/catalogue/categories

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const category = await prisma.productCategory.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        defaultSpecifications: body.defaultSpecifications ?? null,
        parentCategoryId: body.parentCategoryId ?? null,
        companyId: user.companyId ?? null,
      },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/catalogue/categories error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
