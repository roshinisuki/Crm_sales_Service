import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) return apiError("Unauthorized", 401);
    if (userPayload.role === "Customer") return apiError("Unauthorized", 403);

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    // Execs see only their assigned follow-ups
    const isExecutive = userPayload.role === "MarketingExecutive";

    const followUps = await prisma.followUp.findMany({
      where: {
        ...(isExecutive ? { assignedUserId: userPayload.id } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
      },
      include: {
        customer:     { select: { id: true, name: true, customerCode: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { nextMeetingDate: "asc" },
    });

    // Normalize to frontend-expected field names
    const normalized = followUps.map((f) => ({
      ...f,
      scheduledTime: f.nextMeetingDate.toISOString(),
      notes:         f.remarks,
      userId:        f.assignedUserId,
      user:          f.assignedUser,
    }));

    return apiSuccess(normalized);
  } catch (error) {
    console.error("GET FollowUps Error:", error);
    return apiError("Failed to fetch follow-ups", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) return apiError("Unauthorized", 401);

    const { customerId, scheduledTime, notes, remarks } = await request.json();

    if (!customerId || !scheduledTime) {
      return apiError("Customer ID and Scheduled Time are required");
    }

    const followUp = await prisma.followUp.create({
      data: {
        customerId,
        assignedUserId:  userPayload.id,
        nextMeetingDate: new Date(scheduledTime),
        remarks:         notes || remarks || null,
        status:          "Pending",
      },
      include: {
        customer:     { select: { id: true, name: true, customerCode: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "follow-up",
      "create",
      `Follow-up scheduled for customer ${customerId} on ${scheduledTime}`
    );

    return apiSuccess(
      {
        ...followUp,
        scheduledTime: followUp.nextMeetingDate.toISOString(),
        notes:         followUp.remarks,
        userId:        followUp.assignedUserId,
        user:          followUp.assignedUser,
      },
      "Follow-up scheduled successfully",
      201
    );
  } catch (error) {
    console.error("POST FollowUp Error:", error);
    return apiError("Failed to schedule follow-up", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) return apiError("Unauthorized", 401);

    const { id, status } = await request.json();
    if (!id || !status) return apiError("ID and status are required");

    const followUp = await prisma.followUp.update({
      where: { id },
      data:  { status },
    });

    await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} marked as ${status}`);

    return apiSuccess(followUp, "Follow-up updated");
  } catch (error) {
    console.error("PUT FollowUp Error:", error);
    return apiError("Failed to update follow-up", 500);
  }
}
