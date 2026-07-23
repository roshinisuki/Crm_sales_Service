import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// POST /api/visits/[id]/reschedule
// Body: { new_planned_date, new_planned_time, reason }
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/reschedule");
  if (guard) return guard;
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { new_planned_date, new_planned_time, reason } = body;

    if (!new_planned_date) {
      return NextResponse.json({ success: false, message: "new_planned_date is required" }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, message: "reschedule_reason is required" }, { status: 400 });
    }

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: { customer: { select: { name: true } } },
    });

    if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

    if (visit.status !== "PLANNED") {
      return NextResponse.json(
        { success: false, message: `Cannot reschedule — visit status is ${visit.status}` },
        { status: 400 }
      );
    }

    const newPlannedDateTime = new Date(`${new_planned_date}T${new_planned_time || visit.plannedTime || "09:00"}:00`);

    const updated = await prisma.customerVisit.update({
      where: { id },
      data: {
        plannedDate: newPlannedDateTime,
        plannedTime: new_planned_time || visit.plannedTime || "09:00",
        agenda: reason ? `${visit.agenda || ""}\n[Rescheduled: ${reason}]`.trim() : visit.agenda,
        rescheduleCount: { increment: 1 },
        rescheduleReason: reason.trim(),
      },
      include: {
        customer: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
      },
    });

    await logAudit(user.id, "CustomerVisit", "Reschedule", `Rescheduled visit to ${visit.customer?.name} for ${new_planned_date}`, {
      resourceId: id,
      previousState: { plannedDate: visit.plannedDate },
      newState: { plannedDate: newPlannedDateTime, reason },
      context: extractAuditContext(request),
      severity: "WARN",
    });

    // Notify assigned user
    await dispatchNotification({
      userId: visit.hostedBy,
      title: "Visit Rescheduled",
      message: `Visit to ${visit.customer?.name} rescheduled to ${new_planned_date}${new_planned_time ? ` at ${new_planned_time}` : ""}${reason ? `. Reason: ${reason}` : ""}`,
      type: "visit",
      link: `/visits/${id}`,
    });

    return NextResponse.json({ success: true, data: updated, message: "Visit rescheduled" });
  } catch (error: any) {
    console.error("[Visit Reschedule Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
