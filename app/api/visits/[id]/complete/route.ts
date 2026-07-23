import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

const OUTCOME_TYPES = ["POSITIVE", "NEUTRAL", "NEEDS_FOLLOWUP", "LOST"];

// POST /api/visits/[id]/complete
// Body: { visit_summary, next_action, outcome_type, create_followup, followup_type, followup_datetime }
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/complete");
  if (guard) return guard;
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { visit_summary, next_action, outcome_type, create_followup, followup_type, followup_datetime, outcomeNotes, nextActionDate, nextActionNotes } = body;

    // Require visit_summary or outcomeNotes
    if ((!visit_summary || !visit_summary.trim()) && (!outcomeNotes || !outcomeNotes.trim())) {
      return NextResponse.json(
        { success: false, message: "Visit summary / outcome notes are required to complete a visit" },
        { status: 400 }
      );
    }

    // Require outcome_type
    if (!outcome_type || !OUTCOME_TYPES.includes(outcome_type)) {
      return NextResponse.json(
        { success: false, message: `outcome_type is required and must be one of: ${OUTCOME_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: { customer: { select: { name: true } } },
    });

    if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

    // Completion is gated behind checkout
    if (visit.status !== "CHECKED_OUT") {
      return NextResponse.json(
        { success: false, message: `Cannot complete — visit must be checked out first (current: ${visit.status})` },
        { status: 400 }
      );
    }

    // Long visits require justification before completion
    if (visit.longVisit) {
      const justification = body.long_visit_justification;
      if (!justification || !justification.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "JUSTIFICATION_REQUIRED",
            message: "This visit exceeded 9 hours. Please provide a justification for the extended duration before completing the visit.",
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.customerVisit.update({
        where: { id },
        data: {
          status: "COMPLETED",
          visitSummary: visit_summary || outcomeNotes,
          outcomeNotes: outcomeNotes || visit_summary,
          nextAction: next_action || null,
          nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
          nextActionNotes: nextActionNotes || null,
          outcomeType: outcome_type,
          ...(visit.longVisit && body.long_visit_justification
            ? { longVisitJustification: body.long_visit_justification.trim() }
            : {}),
        },
      });

      // Create follow-up if nextActionDate is provided (unified follow-ups integration)
      if (nextActionDate) {
        await tx.followUp.create({
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
            companyId: visit.companyId,
          },
        });
      }

      // Create follow-up visit if requested
      if (create_followup && followup_datetime) {
        const followUpDate = new Date(followup_datetime);
        if (isNaN(followUpDate.getTime())) {
          throw new Error("Invalid followup_datetime");
        }
        await tx.customerVisit.create({
          data: {
            customerId: visit.customerId,
            hostedBy: visit.hostedBy,
            purpose: followup_type || "Follow-up Visit",
            plannedDate: followUpDate,
            plannedTime: `${String(followUpDate.getHours()).padStart(2, "0")}:${String(followUpDate.getMinutes()).padStart(2, "0")}`,
            status: "PLANNED",
            parentVisitId: visit.id,
            agenda: `Follow-up visit created from completed visit. Type: ${followup_type || "N/A"}`,
            companyId: visit.companyId,
            plantLocationId: visit.plantLocationId,
          },
        });
      }

      return updated;
    });

    await logAudit(user.id, "CustomerVisit", "Complete", `Completed visit to ${visit.customer?.name}`, {
      resourceId: id,
      newState: { status: "COMPLETED", visitSummary: visit_summary, outcomeType: outcome_type },
      context: extractAuditContext(request),
      severity: "WARN",
    });

    return NextResponse.json({ success: true, data: result, message: "Visit completed" });
  } catch (error: any) {
    console.error("[Visit Complete Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
