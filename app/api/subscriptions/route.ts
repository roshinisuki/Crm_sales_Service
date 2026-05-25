import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");

    let rbacFilter = {};
    if (userPayload.role === "MarketingExecutive") {
      rbacFilter = { customer: { assignedUserId: userPayload.id } };
    } else if (userPayload.role === "Customer") {
      rbacFilter = { customer: { email: userPayload.email } };
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        AND: [
          rbacFilter,
          customerId ? { customerId } : {},
          status ? { status: status as any } : {},
        ],
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(subscriptions);
  } catch (error) {
    console.error("GET Subscriptions Error:", error);
    return apiError("Failed to fetch subscriptions", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const { customerId, planName, startDate, endDate, price, status, notes } = await request.json();

    if (!customerId || !planName || !startDate || !endDate) {
      return apiError("customerId, planName, startDate and endDate are required");
    }

    const subscription = await prisma.subscription.create({
      data: {
        customerId,
        planName,
        startDate:  new Date(startDate),
        endDate:    new Date(endDate),
        status:     status || "Active",
        notes:      notes || null,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });

    await logAudit(
      userPayload!.id,
      "subscription",
      "create",
      `Subscription created for customer ${customerId}: ${planName}`
    );

    return apiSuccess(subscription, "Subscription created successfully", 201);
  } catch (error) {
    console.error("POST Subscription Error:", error);
    return apiError("Failed to create subscription", 500);
  }
}
