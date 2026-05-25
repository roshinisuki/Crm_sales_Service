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
    const customerId = searchParams.get("customerId");

    // Executives see only their own visits; Admins/Leads see all
    const isExecutive = userPayload.role === "MarketingExecutive";

    const visits = await prisma.marketingVisit.findMany({
      where: {
        ...(isExecutive ? { executiveId: userPayload.id } : {}),
        ...(customerId ? { customerId } : {}),
      },
      include: {
        executive: { select: { id: true, name: true, email: true } },
        customer:  { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { checkIn: "desc" },
    });

    // Normalize to frontend field names
    const normalized = visits.map((v) => ({
      ...v,
      checkInTime:  v.checkIn.toISOString(),
      checkOutTime: v.checkOut?.toISOString() ?? null,
      checkInLat:   v.checkInLat ?? 0,
      checkInLng:   v.checkInLng ?? 0,
      checkOutLat:  v.checkOutLat ?? null,
      checkOutLng:  v.checkOutLng ?? null,
      purpose:      v.remarks ?? null,
      notes:        v.remarks ?? null,
      userId:       v.executiveId,
      user:         v.executive,
    }));

    return apiSuccess(normalized);
  } catch (error) {
    console.error("GET MarketingVisit Error:", error);
    return apiError("Failed to fetch marketing visits", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["MarketingExecutive", "MarketingLead", "Admin"])) {
      return apiError("Unauthorized", 403);
    }

    const body = await request.json();
    const { customerId, purpose, remarks, notes } = body;

    if (!customerId) return apiError("Customer ID is required");

    const visit = await prisma.marketingVisit.create({
      data: {
        executiveId: userPayload!.id,
        customerId,
        remarks: purpose || remarks || notes || null,
        checkIn: new Date(),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload!.id,
      "marketing-log",
      "checkin",
      `Visit checked in for customer ${customerId}`
    );

    return apiSuccess(
      {
        ...visit,
        checkInTime:  visit.checkIn.toISOString(),
        checkOutTime: null,
        purpose:      visit.remarks,
        notes:        visit.remarks,
        userId:       visit.executiveId,
        user:         visit.executive,
      },
      "Visit checked in successfully",
      201
    );
  } catch (error) {
    console.error("POST MarketingVisit Error:", error);
    return apiError("Failed to record visit", 500);
  }
}
