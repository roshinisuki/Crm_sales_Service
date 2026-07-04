import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/visits/[id]/checkin
// Body: { gps_lat, gps_lng }
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
    const { gps_lat, gps_lng, checkedInBy, manualLocationNote, locationVerified } = body;

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: { plantLocation: true, customer: { select: { name: true } } },
    });

    if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

    // Validate visit type and required fields
    // Field visit: GPS is preferred but not blocking — allow manual location note if GPS denied
    if (visit.visitType === "office_visit") {
      if (!checkedInBy) {
        return NextResponse.json({ success: false, message: "Receptionist/host name is required for office visits" }, { status: 400 });
      }
    }

    // Validate visit status = PLANNED
    if (visit.status !== "PLANNED") {
      return NextResponse.json(
        { success: false, message: `Cannot check in — visit status is ${visit.status}` },
        { status: 400 }
      );
    }

    // Validate planned_date is today (cannot check in more than 1 day before the planned date)
    if (visit.plannedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const plannedDay = new Date(visit.plannedDate);
      plannedDay.setHours(0, 0, 0, 0);
      const diffDays = (plannedDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 1) {
        return NextResponse.json(
          { success: false, message: "Cannot check in more than 1 day before the planned date" },
          { status: 400 }
        );
      }
    }

    // Validate check-in time window (planned datetime ± window, default timezone IST)
    if (visit.plannedDate) {
      const timezone = (user as any).timezone || "Asia/Kolkata";
      // Use the UTC date part stored for plannedDate so it matches the date the user selected,
      // then combine with plannedTime in the target timezone.
      const d = new Date(visit.plannedDate);
      const plannedDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const plannedTime = visit.plannedTime || "00:00";
      const tzOffset = timezone === "Asia/Kolkata" ? "+05:30" : getTimezoneOffset(timezone);
      const plannedDateTime = new Date(`${plannedDateStr}T${plannedTime}:00${tzOffset}`);

      const now = new Date();
      const windowStart = new Date(plannedDateTime.getTime() - 15 * 60 * 1000);
      const windowEnd = new Date(plannedDateTime.getTime() + 30 * 60 * 1000);

      if (now < windowStart) {
        return NextResponse.json(
          {
            success: false,
            error: "TOO_EARLY",
            message: `Check-in is not allowed yet. Your visit is scheduled at ${formatDateTime(plannedDateTime, timezone)}. You can check in from ${formatDateTime(windowStart, timezone)}.`,
          },
          { status: 400 }
        );
      }

      if (now > windowEnd) {
        return NextResponse.json(
          {
            success: false,
            error: "TOO_LATE",
            message: "Check-in window has passed. This visit will be marked as Missed.",
          },
          { status: 400 }
        );
      }
    }

    // Calculate distance from plant location if coordinates exist (field visits only)
    let warning: string | null = null;
    let gpsAnomaly = false;
    let gpsDistanceFromSite: number | null = null;
    const hasGps = gps_lat != null && gps_lng != null;
    const isLocationVerified = locationVerified !== false && hasGps;

    if (visit.visitType === "field_visit" && hasGps && visit.plantLocation?.gpsLat && visit.plantLocation?.gpsLng) {
      const distance = haversineDistance(gps_lat, gps_lng, visit.plantLocation.gpsLat, visit.plantLocation.gpsLng);
      gpsDistanceFromSite = distance;
      if (distance > 0.5) { // 500m tolerance as per spec
        warning = `Check-in location is ${distance.toFixed(2)} km from registered plant address (tolerance: 500m)`;
        gpsAnomaly = true;
      }
    }

    if (visit.visitType === "field_visit" && !hasGps && !manualLocationNote) {
      return NextResponse.json({ success: false, message: "Either GPS coordinates or a manual location note is required for field visit check-in" }, { status: 400 });
    }

    // Update visit based on visit type
    const updateData: any = {
      checkInTime: new Date(),
      status: "CHECKED_IN",
    };

    if (visit.visitType === "field_visit") {
      if (hasGps) {
        updateData.gpsLat = parseFloat(gps_lat);
        updateData.gpsLng = parseFloat(gps_lng);
        updateData.gpsAnomaly = gpsAnomaly;
        updateData.gpsDistanceFromSite = gpsDistanceFromSite;
        updateData.locationVerified = true;
      } else {
        updateData.locationVerified = false;
        updateData.manualLocationNote = manualLocationNote || null;
        warning = "Check-in recorded without GPS — location unverified.";
      }
    } else if (visit.visitType === "office_visit") {
      // Store receptionist/host confirmation
      updateData.checkInBy = checkedInBy;
      updateData.signInTime = new Date();
    }

    const updated = await prisma.customerVisit.update({
      where: { id },
      data: updateData,
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
        fromStatus: "PLANNED",
        toStatus: "CHECKED_IN",
        changedBy: user.id,
        changedAt: new Date(),
        companyId: user.companyId,
        reason: visit.visitType === "field_visit" ? "Check-in with GPS validation" : "Check-in with reception confirmation",
      },
    });

    await logAudit(user.id, "CustomerVisit", "CheckIn", `Checked in for ${visit.visitType} visit to ${visit.customer?.name}`, {
      resourceId: id,
      newState: { status: "CHECKED_IN", visitType: visit.visitType, ...updateData },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({
      success: true,
      data: updated,
      ...(warning ? { warning } : {}),
    });
  } catch (error: any) {
    console.error("[Visit CheckIn Error]", error);
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

function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const tzDateStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
    const tzDate = new Date(tzDateStr);
    const utcDate = new Date(now.toISOString().slice(0, 19));
    const offsetMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / (60 * 1000));
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  } catch {
    return "+05:30";
  }
}

function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
