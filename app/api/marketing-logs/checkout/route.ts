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

    const { id, checkOutLat, checkOutLng, notes } = await request.json();

    if (!id) return apiError("Visit ID is required for check-out");

    // Verify the visit exists
    const existing = await prisma.marketingVisit.findUnique({ where: { id } });
    if (!existing) return apiError("Visit record not found", 404);
    if (existing.checkOut) return apiError("This visit has already been checked out", 400);

    const updated = await prisma.marketingVisit.update({
      where: { id },
      data: {
        checkOut: new Date(),
        checkOutLat: checkOutLat ?? null,
        checkOutLng: checkOutLng ?? null,
        remarks:  notes
          ? existing.remarks
            ? `${existing.remarks}\n\nCheck-out notes: ${notes}`
            : notes
          : existing.remarks,
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload!.id,
      "marketing-log",
      "checkout",
      `Checked out from visit ${id}`
    );

    return apiSuccess(
      {
        ...updated,
        checkInTime:  updated.checkIn.toISOString(),
        checkOutTime: updated.checkOut?.toISOString() ?? null,
        checkOutLat:  updated.checkOutLat ?? 0,
        checkOutLng:  updated.checkOutLng ?? 0,
        purpose:      updated.remarks,
        notes:        updated.remarks,
        userId:       updated.executiveId,
        user:         updated.executive,
      },
      "Checked out successfully"
    );
  } catch (error) {
    console.error("POST Marketing Log Check-Out Error:", error);
    return apiError("Failed to check out", 500);
  }
}
