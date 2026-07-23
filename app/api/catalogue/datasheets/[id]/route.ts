import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// PUT /api/catalogue/datasheets/[id] — update a datasheet
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, fileUrl, description, mimeType, fileSize } = body;

    const doc = await prisma.cRMDocument.findUnique({ where: { id } });
    if (!doc || doc.deletedAt) {
      return NextResponse.json({ success: false, message: "Datasheet not found" }, { status: 404 });
    }
    if (doc.companyId && doc.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const updated = await prisma.cRMDocument.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(fileUrl !== undefined && { fileUrl, fileSize: fileSize || null, mimeType: mimeType || null }),
        ...(description !== undefined && { description }),
        version: { increment: 1 },
      },
    });

    // Datasheet URL is stored on the CRMDocument record, not on the Product model

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/catalogue/datasheets/[id] error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/catalogue/datasheets/[id] — soft delete a datasheet

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const doc = await prisma.cRMDocument.findUnique({ where: { id } });
    if (!doc || doc.deletedAt) {
      return NextResponse.json({ success: false, message: "Datasheet not found" }, { status: 404 });
    }
    if (doc.companyId && doc.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await prisma.cRMDocument.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    // Datasheet URL is stored on the CRMDocument record, not on the Product model

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/catalogue/datasheets/[id] error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
