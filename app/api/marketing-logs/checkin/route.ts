import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["MarketingExecutive", "MarketingLead", "Admin"])) {
      return apiError("Unauthorized", 403);
    }

    const { customerId, purpose, remarks, notes, checkInLat, checkInLng, checkInPhoto } = await request.json();

    if (!customerId) return apiError("Customer ID is required for check-in");

    const visit = await prisma.marketingVisit.create({
      data: {
        executiveId: userPayload!.id,
        customerId,
        remarks:     purpose || remarks || notes || null,
        checkIn:     new Date(),
        checkInLat:  checkInLat ?? null,
        checkInLng:  checkInLng ?? null,
        checkInPhoto: checkInPhoto ?? null,
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload!.id,
      "marketing-log",
      "checkin",
      `Checked in to customer ${customerId}`
    );

    return apiSuccess(
      {
        ...visit,
        checkInTime:  visit.checkIn.toISOString(),
        checkOutTime: null,
        checkInLat:   visit.checkInLat ?? 0,
        checkInLng:   visit.checkInLng ?? 0,
        purpose:      visit.remarks,
        notes:        visit.remarks,
        userId:       visit.executiveId,
        user:         visit.executive,
      },
      "Checked in successfully",
      201
    );
  } catch (error) {
    console.error("POST Marketing Log Check-In Error:", error);
    return apiError("Failed to check in", 500);
  }
}
