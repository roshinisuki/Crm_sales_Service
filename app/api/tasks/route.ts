import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// GET /api/tasks
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const priority = url.searchParams.get("priority") || "";
    const assignedUserId = url.searchParams.get("assignedUserId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const where: any = { deletedAt: null };

    if (user.role === "SalesExecutive") {
      where.assignedTo = user.id;
    } else if (user.companyId) {
      where.companyId = user.companyId;
    }

    if (assignedUserId) where.assignedTo = assignedUserId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          Contact: { select: { id: true, name: true, company: true } },
          User: { select: { id: true, name: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: tasks, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const count = await prisma.task.count();
    const taskCode = `TSK-${String(count + 1).padStart(4, "0")}`;

    const task = await prisma.task.create({
      data: {
        id: nanoid(),
        taskCode,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "Open",
        priority: body.priority ?? "Medium",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        contactId: body.contactId ?? null,
        assignedTo: user.id,
        companyId: user.companyId ?? null,
      },
    });

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
