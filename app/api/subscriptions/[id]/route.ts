import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const { id } = await params;
    const { status, endDate } = await request.json();

    const existingSub = await prisma.subscription.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!existingSub) {
      return apiError("Subscription not found", 404);
    }

    const updatedSub = await prisma.subscription.update({
      where: { id },
      data: {
        status: status !== undefined ? status : existingSub.status,
        endDate: endDate ? new Date(endDate) : existingSub.endDate,
      },
    });

    await logAudit(
      userPayload?.id || null,
      "Subscription",
      "Update",
      `Updated subscription status/endDate for customer ${existingSub.customer.customerCode}`
    );

    return apiSuccess(updatedSub, "Subscription updated successfully");
  } catch (error) {
    console.error("PUT Subscription Error:", error);
    return apiError("Failed to update subscription", 500);
  }
}
