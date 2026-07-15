import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const asset = await prisma.customerAsset.findUnique({
      where: { id },
      include: {
        customer: true,
        purchaseOrder: true,
        product: true,
        deal: true,
        project: true,
        AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: asset });
  } catch (error: any) {
    console.error("Error fetching asset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.customerAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const allowedFields: Record<string, any> = {};
    const permitted = ["serialNumber", "productName", "customerId", "status", "purchaseDate", "warrantyExpiryDate", "amcExpiryDate"];
    for (const key of permitted) {
      if (body[key] !== undefined) {
        if ((key === "purchaseDate" || key === "warrantyExpiryDate" || key === "amcExpiryDate") && body[key]) {
          allowedFields[key] = new Date(body[key]);
        } else {
          allowedFields[key] = body[key];
        }
      }
    }

    const updated = await prisma.customerAsset.update({
      where: { id },
      data: allowedFields,
      include: {
        customer: true,
        purchaseOrder: true,
        product: true,
        deal: true,
        project: true,
        AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error updating asset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user || !["Admin", "SuperAdmin"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.customerAsset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting asset:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
