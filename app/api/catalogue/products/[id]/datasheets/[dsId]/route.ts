import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// DELETE /api/catalogue/products/[id]/datasheets/[dsId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; dsId: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id, dsId } = await params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (product.companyId && product.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await prisma.productDatasheet.delete({
      where: { id: dsId },
    });

    return NextResponse.json({ success: true, message: "Datasheet deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/catalogue/products/[id]/datasheets/[dsId] error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
