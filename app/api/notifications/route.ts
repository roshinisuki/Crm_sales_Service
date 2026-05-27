import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: { userId: userPayload.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    console.error("Notifications GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    await prisma.notification.updateMany({
      where: { userId: userPayload.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "All marked as read" });
  } catch (error) {
    console.error("Notifications PATCH Error:", error);
    return NextResponse.json({ success: false, message: "Failed to mark as read" }, { status: 500 });
  }
}
