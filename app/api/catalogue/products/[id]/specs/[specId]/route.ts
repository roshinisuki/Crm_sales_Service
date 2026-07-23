import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// PUT /api/catalogue/products/[id]/specs/[specId]
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; specId: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, specId } = await params;

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

    const spec = await prisma.productSpecification.update({
      where: { id: specId },
      data: {
        specKey: body.specKey,
        specValue: body.specValue,
        unit: body.unit,
        displayOrder: body.displayOrder,
      },
    });

    return NextResponse.json({ success: true, data: spec });
  } catch (error: any) {
    console.error("PUT /api/catalogue/products/[id]/specs/[specId] error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/catalogue/products/[id]/specs/[specId]

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; specId: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id, specId } = await params;

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

    await prisma.productSpecification.delete({
      where: { id: specId },
    });

    return NextResponse.json({ success: true, message: "Specification deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/catalogue/products/[id]/specs/[specId] error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
