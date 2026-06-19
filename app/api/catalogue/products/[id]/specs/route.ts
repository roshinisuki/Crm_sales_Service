import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// GET /api/catalogue/products/[id]/specs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if product exists and belongs to user's company
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (product.companyId && product.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const specs = await prisma.productSpecification.findMany({
      where: { productId: id },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: specs });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/[id]/specs error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/catalogue/products/[id]/specs
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = await params;

    // Check if product exists and belongs to user's company
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (product.companyId && product.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const spec = await prisma.productSpecification.create({
      data: {
        id: nanoid(),
        productId: id,
        specKey: body.specKey,
        specValue: body.specValue,
        unit: body.unit ?? null,
        displayOrder: body.displayOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: spec }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/catalogue/products/[id]/specs error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
