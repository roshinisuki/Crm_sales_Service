import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const result = await prisma.task.updateMany({
      where: {
        deletedAt: null,
        status: "Open",
        dueDate: { lt: now },
      },
      data: { status: "Overdue" },
    });

    return NextResponse.json({ success: true, count: result.count, message: `${result.count} tasks marked as overdue` });
  } catch (error: any) {
    console.error("POST /api/cron/tasks-overdue error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
