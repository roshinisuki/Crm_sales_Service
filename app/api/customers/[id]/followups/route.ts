import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: customerId } = await context.params;

    const followUps = await prisma.followUp.findMany({
      where: {
        customerId,
        ...(userPayload.role === "SalesExecutive" ? { assignedUserId: userPayload.id } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true } },
      },
      orderBy: { nextMeetingDate: "desc" },
    });

    const normalized = followUps.map((f) => ({
      ...f,
      scheduledTime: f.nextMeetingDate.toISOString(),
      nextMeetingDate: f.nextMeetingDate.toISOString(),
      notes: f.remarks || f.notes,
      userId: f.assignedUserId,
      user: f.assignedUser,
    }));

    return NextResponse.json({ success: true, data: normalized });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
