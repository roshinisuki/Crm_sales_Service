import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/visits/[id]/checkout
// Body: { gps_lat, gps_lng, outcomeNotes, materialsShared }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { gps_lat, gps_lng, outcomeNotes, materialsShared, nextActionDate, nextActionNotes, documentsExchanged } = body;

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: { customer: { select: { name: true } } },
    });

    if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

    if (visit.status !== "CHECKED_IN") {
      return NextResponse.json(
        { success: false, message: `Cannot check out — visit status is ${visit.status}` },
        { status: 400 }
      );
    }

    const checkOutTime = new Date();
    let durationMinutes: number | null = null;
    if (visit.checkInTime) {
      durationMinutes = Math.round((checkOutTime.getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60));
    }

    let checkOutGpsLocation: string | null = null;
    let checkOutGpsAnomaly = false;
    let warning: string | null = null;

    // GPS validation only for field visits
    if (visit.visitType === "field_visit" && gps_lat != null && gps_lng != null) {
      const lat = parseFloat(gps_lat);
      const lng = parseFloat(gps_lng);
      checkOutGpsLocation = `${lat},${lng}`;

      // Distance from check-in GPS
      if (visit.gpsLat != null && visit.gpsLng != null) {
        const distance = haversineDistance(lat, lng, visit.gpsLat, visit.gpsLng);
        if (distance > 1) {
          checkOutGpsAnomaly = true;
          warning = `Check-out location is ${distance.toFixed(2)} km from check-in location`;
        }
      }
    }

    const updated = await prisma.customerVisit.update({
      where: { id },
      data: {
        checkOutTime,
        status: "CHECKED_OUT",
        checkOutGpsLocation,
        checkOutGpsAnomaly,
        durationMinutes,
        visitSummary: outcomeNotes || null,
        outcomeNotes: outcomeNotes || null,
        outcomeType: materialsShared || null,
        nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
        nextActionNotes: nextActionNotes || null,
        ...(visit.visitType === "office_visit" ? { signOutTime: checkOutTime, documentsExchanged: documentsExchanged || null } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
        plantLocation: { select: { id: true, locationName: true } },
      },
    });

    // Log status transition
    await prisma.customerVisitStatusLog.create({
      data: {
        visitId: id,
        fromStatus: "CHECKED_IN",
        toStatus: "CHECKED_OUT",
        changedBy: user.id,
        changedAt: new Date(),
        companyId: user.companyId,
        reason: "Manual checkout with outcome notes",
      },
    });

    // Create follow-up if nextActionDate is provided (unified follow-ups integration)
    if (nextActionDate) {
      await prisma.followUp.create({
        data: {
          customerId: visit.customerId,
          assignedUserId: visit.hostedBy,
          nextMeetingDate: new Date(nextActionDate),
          dueDate: new Date(nextActionDate),
          remarks: nextActionNotes || `Follow-up after visit to ${visit.customer?.name}`,
          notes: nextActionNotes || null,
          status: "Pending",
          visitId: visit.id,
          visitType: visit.visitType === "field_visit" ? "FIELD" : "OFFICE",
          sourceType: "VISIT",
          sourceId: visit.id,
          entityType: "visit",
          entityId: visit.id,
          priority: "Medium",
          companyId: user.companyId,
          stageAtCreation: "Deal",
        },
      });
    }

    await logAudit(user.id, "CustomerVisit", "CheckOut", `Checked out from ${visit.visitType} visit to ${visit.customer?.name}`, {
      resourceId: id,
      newState: { status: "CHECKED_OUT", visitType: visit.visitType, checkOutGpsLocation, durationMinutes, checkOutGpsAnomaly, outcomeNotes },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: updated, ...(warning ? { warning } : {}) });
  } catch (error: any) {
    console.error("[Visit CheckOut Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Haversine distance in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
