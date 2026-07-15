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
    const { outcome, outcomeNotes, sparePartsUsed, structuredPartsUsed, returnedParts, reasonNextSteps, followUpVisitNeeded, followUpDate, signatureUrl, photoUrls } = body;

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

    // 2. Validate user identity
    const isAssignedEngineer = visit.engineer?.userId === user.id;
    const isAdmin = ["Admin", "SuperAdmin"].includes(user.role);
    if (!isAssignedEngineer && !isAdmin) {
      return NextResponse.json({ error: "Only the assigned Service Engineer or an Administrator can check out." }, { status: 403 });
    }

    // 3. Precondition: Visit status must currently be In Progress
    if (visit.status?.name !== "In Progress") {
      return NextResponse.json({ error: `Cannot check out. Visit is currently in '${visit.status?.name || "Unknown"}' status, but must be 'In Progress'.` }, { status: 400 });
    }

    // 4. Validate outcomeNotes (Work Performed)
    if (!outcomeNotes || outcomeNotes.trim().length < 20) {
      return NextResponse.json({ error: "Work performed notes are required and must be at least 20 characters long." }, { status: 400 });
    }

    // 5. Validate outcome
    const validOutcomes = ["Resolved", "Partially Resolved", "Escalated", "Follow-up Required", "Parts Pending"];
    if (!outcome || !validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: `A valid Outcome is required. Choose from: ${validOutcomes.join(", ")}` }, { status: 400 });
    }

    // 6. Conditionally validate reason / next steps
    const requiresNextSteps = ["Escalated", "Follow-up Required", "Parts Pending"].includes(outcome);
    if (requiresNextSteps && (!reasonNextSteps || reasonNextSteps.trim().length < 10)) {
      return NextResponse.json({ error: `Reason / next steps details (at least 10 characters) are required for outcome '${outcome}'.` }, { status: 400 });
    }

    // 7. Validate spare parts if outcome involves parts pending
    if (outcome === "Parts Pending" && (!sparePartsUsed || sparePartsUsed.length === 0)) {
      return NextResponse.json({ error: "At least one spare part item must be listed when the outcome is 'Parts Pending'." }, { status: 400 });
    }

    // 8. Find the "Completed" status for the visit module
    const completedStatus = await prisma.serviceStatus.findFirst({
      where: { name: "Completed", module: "visit" },
    });

    if (!completedStatus) {
      return NextResponse.json({ error: "Completed status not found in ServiceStatus database table." }, { status: 500 });
    }

    // 9. Compute durations
    const checkOutTime = new Date();
    const checkInTime = visit.checkInTime || visit.createdAt;
    const durationMin = Math.round((checkOutTime.getTime() - new Date(checkInTime).getTime()) / (1000 * 60));

    // Warn if visit is suspiciously short (e.g. < 5 mins) - note: UI displays confirmation warning, server allows it if submitted
    const isSuspiciouslyShort = durationMin < 5;

    // 10. Update visit and parent ticket status in transaction
    const checkOutPayload = {
      outcome,
      outcomeNotes: outcomeNotes.trim(),
      reasonNextSteps: reasonNextSteps || null,
      sparePartsUsed: sparePartsUsed || [],
      durationMinutes: durationMin,
      checkedOutBy: user.id,
      isSuspiciouslyShort,
    };

    const formattedNotes = visit.notes ? `${visit.notes}\n\n[Check-Out Info: ${JSON.stringify(checkOutPayload)}]` : `[Check-Out Info: ${JSON.stringify(checkOutPayload)}]`;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.serviceVisit.update({
        where: { id },
        data: {
          statusId: completedStatus.id,
          outcomeNotes: `[Outcome: ${outcome}] ${outcomeNotes.trim()}${reasonNextSteps ? `\nNext Steps: ${reasonNextSteps}` : ""}`,
          notes: formattedNotes,
          completedAt: checkOutTime,
          checkOutTime,
          ...(signatureUrl ? { signatureUrl } : {}),
        },
        include: {
          engineer: { include: { user: true } },
          status: true,
          createdBy: true,
          customer: { select: { id: true, name: true } },
          customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        }
      });

      // Save structured spare parts (Feature 2) + PartMovement ledger entries (Inventory v1)
      if (structuredPartsUsed && Array.isArray(structuredPartsUsed) && structuredPartsUsed.length > 0) {
        for (const part of structuredPartsUsed) {
          const qty = parseInt(part.quantity) || 1;
          const unitCost = parseFloat(part.unitCost) || 0;
          const totalCost = qty * unitCost;
          await tx.servicePartUsed.create({
            data: {
              serviceVisitId: id,
              sparePartId: part.sparePartId || null,
              partName: part.partName || "Unknown Part",
              quantity: qty,
              unitCost,
              totalCost,
            },
          });
          // Create PartMovement "Used" entry and deduct stock
          if (part.sparePartId) {
            await tx.partMovement.create({
              data: {
                sparePartId: part.sparePartId,
                type: "Used",
                quantity: qty,
                engineerId: updatedVisit.engineerId || null,
                serviceVisitId: id,
                customerAssetId: updatedVisit.customerAssetId || null,
                createdById: user.id,
              },
            });
            await tx.sparePart.update({
              where: { id: part.sparePartId },
              data: { currentStock: { decrement: qty } },
            });
          }
        }
      }

      // Process returned unused parts (Inventory v1)
      if (returnedParts && Array.isArray(returnedParts) && returnedParts.length > 0) {
        for (const part of returnedParts) {
          if (!part.sparePartId || !part.quantity || part.quantity < 1) continue;
          await tx.partMovement.create({
            data: {
              sparePartId: part.sparePartId,
              type: "Returned",
              quantity: part.quantity,
              engineerId: updatedVisit.engineerId || null,
              serviceVisitId: id,
              createdById: user.id,
              notes: part.notes || "Returned unused parts at visit completion",
            },
          });
          await tx.sparePart.update({
            where: { id: part.sparePartId },
            data: { currentStock: { increment: part.quantity } },
          });
        }
      }

      // Save site photos (Feature 3)
      if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
        for (const url of photoUrls) {
          await tx.serviceVisitPhoto.create({
            data: {
              serviceVisitId: id,
              photoUrl: url.url || url,
              caption: url.caption || null,
            },
          });
        }
      }

      // Increment AMC entitlement usage (Feature 4)
      if (updatedVisit.customerAssetId) {
        const activeAmc = await tx.aMCContract.findFirst({
          where: {
            customerAssetId: updatedVisit.customerAssetId,
            startDate: { lte: checkOutTime },
            endDate: { gte: checkOutTime },
          },
        });
        if (activeAmc) {
          // Determine if this is a preventive or breakdown visit based on source
          const isBreakdown = !!(updatedVisit.complaintId || updatedVisit.defectId);
          const isPreventive = !isBreakdown && (!!updatedVisit.requestId || !!updatedVisit.installationId);

          if (isPreventive && activeAmc.preventiveVisitsIncluded > 0) {
            await tx.aMCContract.update({
              where: { id: activeAmc.id },
              data: { preventiveVisitsUsed: { increment: 1 } },
            });
          } else if (isBreakdown && !activeAmc.breakdownCallsUnlimited && activeAmc.breakdownCallsIncluded > 0) {
            await tx.aMCContract.update({
              where: { id: activeAmc.id },
              data: { breakdownCallsUsed: { increment: 1 } },
            });
          }
        }
      }

      // Update parent ticket status based on outcome
      const parentClosedAt = outcome === "Resolved" ? checkOutTime : null;
      
      let targetStatusName = "In Progress";
      if (outcome === "Resolved") {
        targetStatusName = "Closed";
      } else if (outcome === "Escalated") {
        targetStatusName = "Escalated"; // Falls back to open/in progress if "Escalated" status doesn't exist
      }

      const updateTicketStatus = async (model: any, ticketId: string, moduleName: string) => {
        let ticketStatus = await tx.serviceStatus.findFirst({
          where: { name: targetStatusName, module: moduleName }
        });
        // Fallback to Closed if Escalated not found, or vice-versa
        if (!ticketStatus && targetStatusName === "Escalated") {
          ticketStatus = await tx.serviceStatus.findFirst({
            where: { name: "In Progress", module: moduleName }
          });
        }
        if (ticketStatus) {
          await model.update({
            where: { id: ticketId },
            data: { 
              statusId: ticketStatus.id,
              closedAt: parentClosedAt
            }
          });
        }
      };

      if (updatedVisit.requestId) {
        await updateTicketStatus(tx.serviceRequest, updatedVisit.requestId, "request");
      }
      if (updatedVisit.complaintId) {
        await updateTicketStatus(tx.complaint, updatedVisit.complaintId, "complaint");
      }
      if (updatedVisit.defectId) {
        await updateTicketStatus(tx.defect, updatedVisit.defectId, "defect");
      }
      if (updatedVisit.installationId) {
        // Installation status maps Completed instead of Closed
        const targetInstallStatusName = outcome === "Resolved" ? "Completed" : "In Progress";
        const installStatus = await tx.serviceStatus.findFirst({
          where: { name: targetInstallStatusName, module: "installation" }
        });
        if (installStatus) {
          await tx.installation.update({
            where: { id: updatedVisit.installationId },
            data: { statusId: installStatus.id, closedAt: parentClosedAt }
          });
        }
        // Activate Asset if installation is resolved
        if (outcome === "Resolved" && updatedVisit.customerAssetId) {
          await tx.customerAsset.update({
            where: { id: updatedVisit.customerAssetId },
            data: { status: "Active" }
          });
        }
      }

      // 11. Optionally auto-create a follow-up visit if requested
      if (followUpVisitNeeded && followUpDate) {
        // Find default "Scheduled" status ID for follow-up visit
        const scheduledStatus = await tx.serviceStatus.findFirst({
          where: { name: "Scheduled" }
        });
        if (scheduledStatus) {
          await tx.serviceVisit.create({
            data: {
              title: `Follow-up: ${updatedVisit.title}`,
              notes: `Auto-created follow-up visit from completed VST-${id.substring(0, 8).toUpperCase()}`,
              statusId: scheduledStatus.id,
              engineerId: updatedVisit.engineerId,
              scheduledDate: new Date(followUpDate),
              customerId: updatedVisit.customerId,
              customerAssetId: updatedVisit.customerAssetId,
              requestId: updatedVisit.requestId,
              complaintId: updatedVisit.complaintId,
              defectId: updatedVisit.defectId,
              installationId: updatedVisit.installationId,
              createdById: user.id,
            }
          });
        }
      }

      return updatedVisit;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error during check-out PATCH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
