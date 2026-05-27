import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id } = params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userPayload.id) {
      return NextResponse.json({ success: false, message: "Notification not found" }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "Marked as read" });
  } catch (error) {
    console.error("Notification ID PATCH Error:", error);
    return NextResponse.json({ success: false, message: "Failed to mark as read" }, { status: 500 });
  }
}
