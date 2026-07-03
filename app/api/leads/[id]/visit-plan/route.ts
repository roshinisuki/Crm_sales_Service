import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

/**
 * POST /api/leads/[id]/visit-plan
 *
 * Saves a lead visit plan after lead creation (Step 2 of the guided workflow).
 * Stored as a CommunicationLog with channel = "VisitPlan" so no schema migration
 * is required. Fields mapped as:
 *   - mode     → visitType  ("CustomerVisit" | "OfficeVisit")
 *   - location → purpose    (e.g. "Demo", "Commercial Meeting", …)
 *   - meetingDate → planned date+time
 *   - agenda   → optional notes
 *   - content  → human-readable summary (for timeline display)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "Customer") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const leadId = params.id;
  if (!leadId) {
    return NextResponse.json({ success: false, message: "Lead ID is required" }, { status: 400 });
  }

  // Verify lead exists and belongs to the same company
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: user.companyId },
  });
  if (!lead) {
    return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
  }

  const body = await request.json();
  const { visitType, purpose, plannedDate, plannedTime, agenda } = body;

  if (!visitType || !purpose || !plannedDate) {
    return NextResponse.json(
      { success: false, message: "visitType, purpose, and plannedDate are required" },
      { status: 400 }
    );
  }

  // Build a planned datetime by combining date + time
  const dateTimeStr = plannedTime
    ? `${plannedDate}T${plannedTime}:00`
    : `${plannedDate}T09:00:00`;
  const plannedDateTime = new Date(dateTimeStr);
  if (isNaN(plannedDateTime.getTime())) {
    return NextResponse.json({ success: false, message: "Invalid planned date/time" }, { status: 400 });
  }

  const visitLabel = visitType === "OfficeVisit" ? "Office Visit" : "Customer Visit";
  const summary = `${visitLabel} planned for "${purpose}" on ${plannedDate}${plannedTime ? " at " + plannedTime : ""}`;

  const log = await prisma.communicationLog.create({
    data: {
      id: nanoid(),
      leadId,
      channel: "VisitPlan",
      direction: "Outbound",
      status: "Planned",
      content: summary,
      agenda: agenda || null,
      meetingDate: plannedDateTime,
      // Reuse `mode` field to store visitType
      mode: visitType,
      // Reuse `location` field to store the purpose/reason for visit
      location: purpose,
      sentByUserId: user.id,
      sentAt: new Date(),
      companyId: user.companyId ?? null,
    },
  });

  return NextResponse.json({ success: true, data: log }, { status: 201 });
}

/**
 * GET /api/leads/[id]/visit-plan
 * Returns all visit plans for a specific lead (for display on the lead detail page).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const leadId = params.id;
  const plans = await prisma.communicationLog.findMany({
    where: {
      leadId,
      channel: "VisitPlan",
      deletedAt: null,
      companyId: user.companyId,
    },
    include: {
      sentByUser: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ success: true, data: plans });
}
