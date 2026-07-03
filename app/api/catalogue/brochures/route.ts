import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/catalogue/brochures — list all product brochures (CRMDocument with tags="brochure")
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const productId = searchParams.get("productId") || "";

    const where: any = {
      entityType: "Product",
      tags: { contains: "brochure" },
      deletedAt: null,
    };
    if (user.companyId) where.companyId = user.companyId;
    if (productId) where.entityId = productId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const docs = await prisma.cRMDocument.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const productIds = [...new Set(docs.map((d) => d.entityId))];
    const products = productIds.length > 0
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, productCode: true } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const data = docs.map((d) => ({
      ...d,
      product: productMap.get(d.entityId) || null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/catalogue/brochures error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/catalogue/brochures — create a new brochure
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, name, fileUrl, description, mimeType, fileSize } = body;

    if (!productId || !name || !fileUrl) {
      return NextResponse.json(
        { success: false, message: "Product, name, and file URL are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }
    if (product.companyId && product.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const count = await prisma.cRMDocument.count({ where: { companyId: user.companyId } });
    const documentCode = `DOC-${String(count + 1).padStart(5, "0")}`;

    const doc = await prisma.cRMDocument.create({
      data: {
        documentCode,
        name,
        documentType: "Product",
        entityType: "Product",
        entityId: productId,
        fileUrl,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        description: description || null,
        tags: "brochure",
        uploadedById: user.id,
        companyId: user.companyId,
      },
    });

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("POST /api/catalogue/brochures error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
