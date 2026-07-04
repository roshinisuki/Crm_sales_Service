import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/visits/auto-checkout
// Automatically checks out visits that have been CHECKED_IN for more than 12 hours without manual checkout
// This should be called by a scheduled job (cron) periodically
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role !== "Admin" && user.role !== "Manager") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const AUTO_CHECKOUT_HOURS = 12; // Configurable window as per spec
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - AUTO_CHECKOUT_HOURS * 60 * 60 * 1000);

    // Find all CHECKED_IN visits that have been checked in for more than 12 hours
    const visitsToAutoCheckout = await prisma.customerVisit.findMany({
      where: {
        status: "CHECKED_IN",
        checkInTime: { lte: cutoffTime },
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true } },
        host: { select: { name: true } },
      },
    });

    if (visitsToAutoCheckout.length === 0) {
      return NextResponse.json({ success: true, message: "No visits to auto-checkout", autoCheckoutCount: 0 });
    }

    // Auto-checkout all visits
    const result = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        visitsToAutoCheckout.map((visit) => {
          const durationMinutes = visit.checkInTime 
            ? Math.round((now.getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))
            : null;

          return tx.customerVisit.update({
            where: { id: visit.id },
            data: {
              checkOutTime: now,
              status: "AUTO_CHECKED_OUT",
              autoCheckedOut: true,
              autoCheckoutReason: `Automatically checked out after ${AUTO_CHECKOUT_HOURS} hours of check-in with no manual checkout`,
              durationMinutes,
            },
          });
        })
      );
      return updates;
    });

    // Log status transitions
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        visitsToAutoCheckout.map((visit) =>
          tx.customerVisitStatusLog.create({
            data: {
              visitId: visit.id,
              fromStatus: "CHECKED_IN",
              toStatus: "AUTO_CHECKED_OUT",
              changedBy: user.id,
              changedAt: now,
              companyId: user.companyId,
              reason: `Automatic - No manual checkout within ${AUTO_CHECKOUT_HOURS}h window`,
            },
          })
        )
      );
    });

    // Log audit for each auto-checkout
    for (const visit of visitsToAutoCheckout) {
      await logAudit(user.id, "CustomerVisit", "AutoCheckout", `Automatically checked out visit to ${visit.customer?.name} after ${AUTO_CHECKOUT_HOURS}h`, {
        resourceId: visit.id,
        newState: { status: "AUTO_CHECKED_OUT", autoCheckedOut: true, reason: "No manual checkout within 12h window" },
        context: extractAuditContext(request),
        severity: "WARN",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Auto-checked out ${visitsToAutoCheckout.length} visits`,
      autoCheckoutCount: visitsToAutoCheckout.length,
    });
  } catch (error: any) {
    console.error("[Auto Checkout Visits Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
