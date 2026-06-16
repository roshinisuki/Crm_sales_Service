import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/contacts/[id]
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const contact = await prisma.contact.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

    if (!contact || contact.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: contact });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/contacts/[id]
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.company !== undefined && { company: body.company }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.designation !== undefined && { designation: body.designation }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.contactType !== undefined && { contactType: body.contactType }),
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.customerId !== undefined && { customerId: body.customerId }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/contacts/[id]
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
