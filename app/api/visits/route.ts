import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const visitType = searchParams.get("visitType");
  const customerId = searchParams.get("customerId");
  const hostedBy = searchParams.get("hostedBy");
  const assignedUserId = searchParams.get("assignedUserId");
  const autoCheckedOut = searchParams.get("autoCheckedOut") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 50;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (visitType) where.visitType = visitType;
  if (customerId) where.customerId = customerId;
  if (hostedBy) where.hostedBy = hostedBy;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (autoCheckedOut) where.autoCheckedOut = true;

  // SalesExecutive sees only own visits
  if (user.role === "SalesExecutive") where.hostedBy = user.id;

  const [visits, total] = await Promise.all([
    prisma.customerVisit.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, city: true } },
        host: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
        plantLocation: { select: { id: true, locationName: true, city: true, gpsLat: true, gpsLng: true } },
        visitHosts: { include: { user: { select: { id: true, name: true } } } },
        visitors: true,
        _count: { select: { visitAttendees: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerVisit.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: visits, total, page, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/visits — Plan a new visit
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const {
    visitType,
    customerId,
    location,
    purpose,
    plannedDate,
    plannedTime,
    assignedTo,
    attendeeContactIds,
    linkedOpportunityId,
    agenda,
    priority,
    visitorNames,
    meetingRoom,
    // New unified fields
    hostedByUserIds,
    visitors,
    entityType,
    entityId,
    travelMode,
    distanceTraveledKm,
    expenseAmount,
    documentsExchanged,
  } = body;

  // Validate required fields
  if (!customerId || !purpose || !plannedDate || !visitType) {
    return NextResponse.json(
      { success: false, message: "customerId, purpose, plannedDate, and visitType are required" },
      { status: 400 }
    );
  }

  // Validate visit-specific required fields
  if (visitType === "field_visit" && !location) {
    return NextResponse.json(
      { success: false, message: "Location is required for field visits" },
      { status: 400 }
    );
  }
  if (visitType === "office_visit" && !visitorNames && !(visitors && visitors.length > 0)) {
    return NextResponse.json(
      { success: false, message: "visitorNames or visitors list is required for office visits" },
      { status: 400 }
    );
  }

  // Validate account exists
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null, companyId: user.companyId },
    select: { id: true, name: true },
  });
  if (!customer) {
    return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
  }

  // Validate planned datetime > NOW()
  const plannedDateTime = new Date(`${plannedDate}T${plannedTime || "09:00"}:00`);
  if (plannedDateTime.getTime() <= Date.now()) {
    return NextResponse.json(
      { success: false, message: "Planned datetime must be in the future" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create the visit
    const visit = await tx.customerVisit.create({
      data: {
        visitType: visitType || "field_visit",
        customerId,
        manualLocationNote: visitType === "field_visit" ? location : null,
        purpose,
        plannedDate: plannedDateTime,
        plannedTime: plannedTime || "09:00",
        agenda: agenda || null,
        priority: priority || "Normal",
        hostedBy: assignedTo || user.id,
        assignedUserId: assignedTo || user.id,
        status: "PLANNED",
        linkedOpportunityId: linkedOpportunityId || null,
        companyId: user.companyId,
        visitorNames: visitType === "office_visit" ? visitorNames : null,
        meetingRoom: visitType === "office_visit" ? meetingRoom : null,
        documentsExchanged: visitType === "office_visit" ? documentsExchanged : null,
        // Field visit optional fields
        travelMode: visitType === "field_visit" ? travelMode : null,
        distanceTraveledKm: visitType === "field_visit" ? distanceTraveledKm : null,
        expenseAmount: visitType === "field_visit" ? expenseAmount : null,
        // Entity linking
        entityType: entityType || null,
        entityId: entityId || null,
      },
    });

    // Insert visit_attendee rows
    if (attendeeContactIds && Array.isArray(attendeeContactIds) && attendeeContactIds.length > 0) {
      await tx.customerVisitAttendee.createMany({
        data: attendeeContactIds.map((contactId: string) => ({
          visitId: visit.id,
          contactId,
        })),
      });
    }

    // Insert visit_host rows (office visit multi-host)
    if (hostedByUserIds && Array.isArray(hostedByUserIds) && hostedByUserIds.length > 0) {
      await tx.visitHost.createMany({
        data: hostedByUserIds.map((userId: string) => ({
          visitId: visit.id,
          userId,
        })),
      });
    }

    // Insert visit_visitor rows (office visit dynamic visitor list)
    if (visitors && Array.isArray(visitors) && visitors.length > 0) {
      await tx.visitVisitor.createMany({
        data: visitors.map((v: { name: string; designation?: string }) => ({
          visitId: visit.id,
          name: v.name,
          designation: v.designation || null,
        })),
      });
    }

    return visit;
  });

  // Fetch with relations for response
  const visit = await prisma.customerVisit.findUnique({
    where: { id: result.id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      host: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
      plantLocation: { select: { id: true, locationName: true, address: true } },
      visitAttendees: { include: { contact: { select: { id: true, name: true, designation: true } } } },
      visitHosts: { include: { user: { select: { id: true, name: true } } } },
      visitors: true,
    },
  });

  await logAudit(user.id, "CustomerVisit", "Create", `Planned visit for ${customer.name} on ${plannedDate}`, {
    resourceId: result.id,
    newState: { customerId, purpose, plannedDate, status: "PLANNED" },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  // Notify assigned user
  const assignedUserId = assignedTo || user.id;
  if (assignedUserId !== user.id) {
    await dispatchNotification({
      userId: assignedUserId,
      title: "Visit Planned",
      message: `Visit planned for ${customer.name} on ${plannedDate}${plannedTime ? ` at ${plannedTime}` : ""}`,
      type: "visit",
      link: `/visits/${result.id}`,
    });
  }

  return NextResponse.json({ success: true, data: visit }, { status: 201 });
}
