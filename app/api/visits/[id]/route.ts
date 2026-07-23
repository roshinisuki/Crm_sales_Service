import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]");
  if (guard) return guard;

  const { id } = await params;

  const visit = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true } },
      host: { select: { id: true, name: true, email: true } },
      plantLocation: { select: { id: true, locationName: true, address: true, city: true, state: true, gpsLat: true, gpsLng: true } },
      visitAttendees: {
        include: { contact: { select: { id: true, name: true, designation: true, email: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
      linkedOpportunity: { select: { id: true, dealName: true, opportunityCode: true, status: true } },
      parentVisit: { select: { id: true, plannedDate: true } },
      childVisits: {
        where: { deletedAt: null },
        select: { id: true, plannedDate: true, plannedTime: true, status: true, purpose: true },
        orderBy: { plannedDate: "asc" },
      },
    },
  });

  if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: visit });
}


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  // Regular update (does not allow direct status changes — use the dedicated workflow endpoints)
  const updateData: any = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.purpose !== undefined) updateData.purpose = body.purpose;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.meetingType !== undefined) updateData.meetingType = body.meetingType;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.agenda !== undefined) updateData.agenda = body.agenda;
  if (body.department !== undefined) updateData.department = body.department;

  const visit = await prisma.customerVisit.update({
    where: { id },
    data: updateData,
    include: { customer: { select: { id: true, name: true } }, host: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: visit });
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]");
  if (guard) return guard;

  const { id } = await params;

  const existing = await prisma.customerVisit.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

  await prisma.customerVisit.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  return NextResponse.json({ success: true, message: "Visit deleted" });
}
