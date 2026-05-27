"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getFollowUpsAction(params?: { status?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const statusFilter = params?.status;
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

    const normalized = followUps.map((f) => ({
      ...f,
      scheduledTime: f.nextMeetingDate.toISOString(),
      nextMeetingDate: f.nextMeetingDate.toISOString(),
      notes:         f.remarks,
      userId:        f.assignedUserId,
      user:          f.assignedUser,
      createdAt:     f.createdAt.toISOString(),
      updatedAt:     f.updatedAt.toISOString(),
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET FollowUps Error:", error);
    return { success: false, message: "Failed to fetch follow-ups" };
  }
}

export async function createFollowUpAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const { customerId, scheduledTime, notes, remarks } = data;

    if (!customerId || !scheduledTime) {
      return { success: false, message: "Customer ID and Scheduled Time are required" };
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

    return {
      success: true,
      message: "Follow-up scheduled successfully",
      data: {
        ...followUp,
        scheduledTime: followUp.nextMeetingDate.toISOString(),
        notes:         followUp.remarks,
        userId:        followUp.assignedUserId,
        user:          followUp.assignedUser,
      }
    };
  } catch (error) {
    console.error("POST FollowUp Error:", error);
    return { success: false, message: "Failed to schedule follow-up" };
  }
}

export async function updateFollowUpStatusAction(data: { id: string; status: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const { id, status } = data;
    if (!id || !status) return { success: false, message: "ID and status are required" };

    const followUp = await prisma.followUp.update({
      where: { id },
      data:  { status: status as any },
    });

    await logAudit(userPayload.id, "follow-up", "update", `Follow-up ${id} marked as ${status}`);

    return { success: true, message: "Follow-up updated", data: followUp };
  } catch (error) {
    console.error("PUT FollowUp Error:", error);
    return { success: false, message: "Failed to update follow-up" };
  }
}
