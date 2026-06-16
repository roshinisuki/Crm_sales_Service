import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// GET /api/contacts
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const contactType = url.searchParams.get("contactType") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const where: any = { deletedAt: null, ownerId: user.id };
    if (status) where.status = status;
    if (contactType) where.contactType = contactType;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: contacts, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error: any) {
    console.error("GET /api/contacts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/contacts
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const count = await prisma.contact.count();
    const contactCode = `CON-${String(count + 1).padStart(4, "0")}`;

    const contact = await prisma.contact.create({
      data: {
        id: nanoid(),
        contactCode,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        company: body.company ?? null,
        title: body.title ?? null,
        designation: body.designation ?? null,
        status: body.status ?? "Active",
        contactType: body.contactType ?? "Technical",
        isPrimary: body.isPrimary ?? false,
        notes: body.notes ?? null,
        customerId: body.customerId ?? null,
        ownerId: user.id,
        companyId: user.companyId ?? null,
      },
    });

    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/contacts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
