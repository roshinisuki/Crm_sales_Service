import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { defectTypeId, categoryId, priorityId } = body;

    // Fetch the complaint
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        category: true,
        complaintType: true,
        priority: true,
        assignedTeam: true,
        assignedEngineer: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    // Find or create "Escalated to Defect" status for complaints
    let escalatedStatus = await prisma.serviceStatus.findFirst({
      where: { name: "Escalated to Defect", module: "complaint" },
    });
    if (!escalatedStatus) {
      escalatedStatus = await prisma.serviceStatus.findFirst({
        where: { name: "Escalated", module: "complaint" },
      });
    }

    // Find "New" status for defects
    const defectNewStatus = await prisma.serviceStatus.findFirst({
      where: { name: "New", module: "defect" },
    });

    if (!defectNewStatus) {
      return NextResponse.json({ error: "Defect 'New' status not found" }, { status: 500 });
    }

    // Resolve fields: use provided values, or fall back to complaint's values
    const finalDefectTypeId = defectTypeId || complaint.complaintTypeId;
    const finalCategoryId = categoryId || complaint.categoryId;
    const finalPriorityId = priorityId || complaint.priorityId;

    if (!finalDefectTypeId) {
      return NextResponse.json({ error: "A defect type is required to escalate. Please specify defectTypeId." }, { status: 400 });
    }

    // Create the defect and update the complaint in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the defect from the complaint
      const newDefect = await tx.defect.create({
        data: {
          title: `Escalated from Complaint: ${complaint.title}`,
          description: complaint.description || "",
          categoryId: finalCategoryId || null,
          defectTypeId: finalDefectTypeId,
          priorityId: finalPriorityId || null,
          statusId: defectNewStatus.id,
          customerId: complaint.customerId,
          customerAssetId: complaint.customerAssetId || null,
          assignedTeamId: complaint.assignedTeamId || null,
          assignedEngineerId: complaint.assignedEngineerId || null,
          createdById: user.id,
        },
        include: {
          customer: true,
          customerAsset: true,
          status: true,
          category: true,
          defectType: true,
          assignedTeam: true,
          assignedEngineer: { include: { user: true } },
        },
      });

      // Update complaint status to "Escalated to Defect"
      if (escalatedStatus) {
        await tx.complaint.update({
          where: { id },
          data: {
            statusId: escalatedStatus.id,
            description: `${complaint.description || ""}\n\n[Escalated to Defect: DEF-${newDefect.id.substring(0, 8).toUpperCase()}]`,
          },
        });
      }

      return newDefect;
    });

    await logAudit(user.id, "Complaint", "EscalateToDefect", `Escalated complaint ${id} to defect ${result.id}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error escalating complaint to defect:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
