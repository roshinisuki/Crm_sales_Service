import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { lat, lng, contactPresent, preVisitNotes, gpsCaptured } = body;

    // 1. Fetch visit
    const visit = await prisma.serviceVisit.findUnique({
      where: { id },
      include: {
        status: true,
        engineer: true,
      }
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // 2. Validate user identity (Assigned Engineer or Admin/SuperAdmin)
    const isAssignedEngineer = visit.engineer?.userId === user.id;
    const isAdmin = ["Admin", "SuperAdmin"].includes(user.role);
    if (!isAssignedEngineer && !isAdmin) {
      return NextResponse.json({ error: "Only the assigned Service Engineer or an Administrator can check in." }, { status: 403 });
    }

    // 3. Precondition: Visit must not already be completed, closed, or in-progress
    const blockedStatuses = ["Completed", "Closed", "In Progress"];
    if (blockedStatuses.includes(visit.status?.name || "")) {
      return NextResponse.json({ error: `Cannot check in. Visit is already '${visit.status?.name}'.` }, { status: 400 });
    }

    // 4. Precondition: No other active visit in progress for this engineer
    const activeVisit = await prisma.serviceVisit.findFirst({
      where: {
        engineerId: visit.engineerId,
        status: { name: "In Progress" },
        id: { not: id }
      },
      include: {
        customer: true,
      }
    });

    if (activeVisit) {
      return NextResponse.json({ 
        error: `You have another active visit in progress at ${activeVisit.customer?.name || "another client"}. Please check out before starting a new visit.` 
      }, { status: 400 });
    }


    // 6. Find "In Progress" status ID
    const inProgressStatus = await prisma.serviceStatus.findFirst({
      where: { name: "In Progress", module: "visit" },
    });

    if (!inProgressStatus) {
      return NextResponse.json({ error: "In Progress status not found in ServiceStatus database table." }, { status: 500 });
    }

    // 7. Format metadata/notes with check-in details
    const checkInTime = new Date();
    const checkInPayload = {
      timestamp: checkInTime.toISOString(),
      gpsCaptured: !!gpsCaptured,
      lat: lat || null,
      lng: lng || null,
      contactPresent: contactPresent || null,
      preVisitNotes: preVisitNotes || null,
      performedBy: user.id,
      byAdminOverride: !isAssignedEngineer && isAdmin
    };

    const formattedCheckInNotes = `[Check-In Info: ${JSON.stringify(checkInPayload)}]` + 
      (preVisitNotes ? `\nPre-visit Notes: ${preVisitNotes}` : "") +
      (contactPresent ? `\nContact Present: ${contactPresent}` : "") +
      `\nLocation Captured: ${gpsCaptured ? `${lat}, ${lng}` : "NO (Blocked/Unavailable)"}`;

    const newNotes = visit.notes ? `${visit.notes}\n\n${formattedCheckInNotes}` : formattedCheckInNotes;

    // 8. Update visit and parent ticket status in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.serviceVisit.update({
        where: { id },
        data: {
          statusId: inProgressStatus.id,
          checkInTime,
          notes: newNotes,
        },
        include: {
          engineer: { include: { user: true } },
          status: true,
          createdBy: true,
          customer: { select: { id: true, name: true } },
          customerAsset: { select: { id: true, productName: true, serialNumber: true } },
        }
      });

      // Update parent ticket status to corresponding "In Progress" / "Investigating"
      const nowTime = new Date();
      if (updatedVisit.requestId) {
        const statusObj = await tx.serviceStatus.findFirst({ where: { name: "In Progress", module: "request" } });
        if (statusObj) await tx.serviceRequest.update({ where: { id: updatedVisit.requestId }, data: { statusId: statusObj.id } });
      }
      if (updatedVisit.complaintId) {
        const statusObj = await tx.serviceStatus.findFirst({ where: { name: "Investigating", module: "complaint" } });
        if (statusObj) await tx.complaint.update({ where: { id: updatedVisit.complaintId }, data: { statusId: statusObj.id } });
      }
      if (updatedVisit.defectId) {
        const statusObj = await tx.serviceStatus.findFirst({ where: { name: "Under Investigation", module: "defect" } });
        if (statusObj) await tx.defect.update({ where: { id: updatedVisit.defectId }, data: { statusId: statusObj.id } });
      }
      if (updatedVisit.installationId) {
        const statusObj = await tx.serviceStatus.findFirst({ where: { name: "In Progress", module: "installation" } });
        if (statusObj) await tx.installation.update({ where: { id: updatedVisit.installationId }, data: { statusId: statusObj.id } });
      }

      return updatedVisit;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error during check-in PATCH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
