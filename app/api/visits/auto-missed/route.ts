import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/visits/auto-missed
// Auto-status transitions:
// 1. MISSED — PLANNED visits whose planned date/time has passed without check-in (end of day)
// 2. NEEDS_REVIEW — CHECKED_IN visits that have been active > 12 hours without checkout
// 3. NO_SHOW — office_visit PLANNED visits where customer didn't arrive within 1h grace after planned time
// This should be called by a scheduled job (cron) at end of each day
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role !== "Admin" && user.role !== "Manager" && user.role !== "SuperAdmin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const oneHourGrace = new Date(now.getTime() - 60 * 60 * 1000);

    // 1. Find all PLANNED visits whose planned date/time has passed
    const visitsToMarkMissed = await prisma.customerVisit.findMany({
      where: {
        status: "PLANNED",
        plannedDate: { lte: endOfDay },
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true } },
        host: { select: { name: true } },
      },
    });

    // 2. Find CHECKED_IN visits active > 12h (needs review)
    const visitsNeedingReview = await prisma.customerVisit.findMany({
      where: {
        status: "CHECKED_IN",
        checkInTime: { lte: twelveHoursAgo },
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true } },
        host: { select: { name: true } },
      },
    });

    // 3. Find office_visit PLANNED visits where customer didn't arrive within 1h grace
    const officeNoShows = await prisma.customerVisit.findMany({
      where: {
        status: "PLANNED",
        visitType: "office_visit",
        plannedDate: { lte: oneHourGrace },
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true } },
        host: { select: { name: true } },
      },
    });

    const totalAuto = visitsToMarkMissed.length + visitsNeedingReview.length + officeNoShows.length;
    if (totalAuto === 0) {
      return NextResponse.json({ success: true, message: "No visits to auto-update", markedCount: 0 });
    }

    // Mark all as MISSED
    const result = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        visitsToMarkMissed.map((visit) =>
          tx.customerVisit.update({
            where: { id: visit.id },
            data: {
              status: "MISSED",
              customerUnavailableReason: "No check-in recorded",
            },
          })
        )
      );
      // Mark needs review
      await Promise.all(
        visitsNeedingReview.map((visit) =>
          tx.customerVisit.update({
            where: { id: visit.id },
            data: {
              status: "NEEDS_REVIEW",
              autoCheckoutReason: "Visit active > 12 hours without checkout",
            },
          })
        )
      );
      // Mark no-show for office visits
      await Promise.all(
        officeNoShows.map((visit) =>
          tx.customerVisit.update({
            where: { id: visit.id },
            data: {
              status: "NO_SHOW",
              customerUnavailableReason: "Customer did not arrive within 1 hour of scheduled time",
            },
          })
        )
      );
      return updates;
    });

    // Log status transitions
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        visitsToMarkMissed.map((visit) =>
          tx.customerVisitStatusLog.create({
            data: {
            visitId: visit.id,
            fromStatus: "PLANNED",
            toStatus: "MISSED",
            changedBy: user.id,
            changedAt: new Date(),
            companyId: user.companyId,
            reason: "Automatic - No check-in recorded by end of day",
          },
        })
        )
      );
      await Promise.all(
        visitsNeedingReview.map((visit) =>
          tx.customerVisitStatusLog.create({
            data: {
              visitId: visit.id,
              fromStatus: "CHECKED_IN",
              toStatus: "NEEDS_REVIEW",
              changedBy: user.id,
              changedAt: new Date(),
              companyId: user.companyId,
              reason: "Automatic - Visit active > 12 hours without checkout",
            },
          })
        )
      );
      await Promise.all(
        officeNoShows.map((visit) =>
          tx.customerVisitStatusLog.create({
            data: {
              visitId: visit.id,
              fromStatus: "PLANNED",
              toStatus: "NO_SHOW",
              changedBy: user.id,
              changedAt: new Date(),
              companyId: user.companyId,
              reason: "Automatic - Customer did not arrive within 1 hour grace",
            },
          })
        )
      );
    });

    // Log audit for each marked visit
    for (const visit of visitsToMarkMissed) {
      await logAudit(user.id, "CustomerVisit", "AutoMissed", `Automatically marked visit to ${visit.customer?.name} as MISSED (no check-in)`, {
        resourceId: visit.id,
        newState: { status: "MISSED", reason: "No check-in recorded" },
        context: extractAuditContext(request),
        severity: "INFO",
      });
    }
    for (const visit of visitsNeedingReview) {
      await logAudit(user.id, "CustomerVisit", "AutoNeedsReview", `Automatically marked visit to ${visit.customer?.name} as NEEDS_REVIEW (active > 12h)`, {
        resourceId: visit.id,
        newState: { status: "NEEDS_REVIEW", reason: "Active > 12 hours without checkout" },
        context: extractAuditContext(request),
        severity: "WARN",
      });
    }
    for (const visit of officeNoShows) {
      await logAudit(user.id, "CustomerVisit", "AutoNoShow", `Automatically marked office visit to ${visit.customer?.name} as NO_SHOW (customer did not arrive)`, {
        resourceId: visit.id,
        newState: { status: "NO_SHOW", reason: "Customer did not arrive within 1h grace" },
        context: extractAuditContext(request),
        severity: "INFO",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Auto-updated ${totalAuto} visits: ${visitsToMarkMissed.length} missed, ${visitsNeedingReview.length} needs-review, ${officeNoShows.length} no-show`,
      markedCount: totalAuto,
      missedCount: visitsToMarkMissed.length,
      needsReviewCount: visitsNeedingReview.length,
      noShowCount: officeNoShows.length,
    });
  } catch (error: any) {
    console.error("[Auto Missed Visits Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
