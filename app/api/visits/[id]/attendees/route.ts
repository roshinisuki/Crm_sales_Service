import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/visits/[id]/attendees — list attendees for a visit
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/attendees");
  if (guard) return guard;

  const { id } = await params;

  const visit = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  const attendees = await prisma.customerVisitAttendee.findMany({
    where: { visitId: id },
    include: {
      contact: { select: { id: true, name: true, designation: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: attendees });
}

// POST /api/visits/[id]/attendees — add an attendee
// Body: { contact_id }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/attendees");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { contact_id } = body;

  if (!contact_id) {
    return NextResponse.json({ success: false, message: "contact_id is required" }, { status: 400 });
  }

  const visit = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true },
  });
  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  // Check if already added
  const existing = await prisma.customerVisitAttendee.findFirst({
    where: { visitId: id, contactId: contact_id },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "Contact is already an attendee" }, { status: 409 });
  }

  const attendee = await prisma.customerVisitAttendee.create({
    data: { visitId: id, contactId: contact_id },
    include: { contact: { select: { id: true, name: true, designation: true, email: true, phone: true } } },
  });

  return NextResponse.json({ success: true, data: attendee }, { status: 201 });
}

// DELETE /api/visits/[id]/attendees?attendeeId=xxx — remove an attendee

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/attendees");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const attendeeId = searchParams.get("attendeeId");

  if (!attendeeId) {
    return NextResponse.json({ success: false, message: "attendeeId query param is required" }, { status: 400 });
  }

  await prisma.customerVisitAttendee.delete({
    where: { id: attendeeId },
  });

  return NextResponse.json({ success: true, message: "Attendee removed" });
}
