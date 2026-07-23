import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/rfq/bulk
// Body: { action: "assign" | "delete" | "status", rfq_ids: string[], value?: string }
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/bulk");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { action, rfq_ids, value } = body;

  if (!action || !rfq_ids || !Array.isArray(rfq_ids) || rfq_ids.length === 0) {
    return NextResponse.json({ success: false, message: "Action and rfq_ids are required" }, { status: 400 });
  }

  // Validate all RFQs belong to user's company
  const rfqs = await prisma.rFQ.findMany({
    where: { id: { in: rfq_ids }, deletedAt: null, companyId: user.companyId },
    select: { id: true, rfqCode: true, status: true },
  });

  if (rfqs.length !== rfq_ids.length) {
    return NextResponse.json({ success: false, message: "Some RFQs not found" }, { status: 404 });
  }

  let affectedCount = 0;

  try {
    if (action === "assign") {
      if (!value) return NextResponse.json({ success: false, message: "User ID is required for assign action" }, { status: 400 });
      const result = await prisma.rFQ.updateMany({
        where: { id: { in: rfq_ids }, deletedAt: null },
        data: { assignedUserId: value },
      });
      affectedCount = result.count;
    } else if (action === "delete") {
      const result = await prisma.rFQ.updateMany({
        where: { id: { in: rfq_ids }, deletedAt: null },
        data: { deletedAt: new Date(), deletedById: user.id },
      });
      affectedCount = result.count;
    } else if (action === "status") {
      if (!value) return NextResponse.json({ success: false, message: "Status value is required" }, { status: 400 });
      const validStatuses = ["New", "UnderReview", "CostingPending", "CostingCompleted", "Closed"];
      if (!validStatuses.includes(value)) {
        return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
      }
      const targetIdx = validStatuses.indexOf(value);
      const skipped: string[] = [];
      const eligible: string[] = [];

      for (const rfq of rfqs) {
        const currentIdx = validStatuses.indexOf(rfq.status);
        if (targetIdx > currentIdx + 1) {
          skipped.push(`${rfq.rfqCode} (${rfq.status} → ${value})`);
        } else {
          eligible.push(rfq.id);
        }
      }

      if (eligible.length === 0) {
        return NextResponse.json({
          success: false,
          message: `All selected RFQs would skip statuses. Skipped: ${skipped.join(", ")}`,
        }, { status: 400 });
      }

      const result = await prisma.rFQ.updateMany({
        where: { id: { in: eligible }, deletedAt: null },
        data: { status: value },
      });
      // Create status history entries
      for (const rfq of rfqs) {
        if (eligible.includes(rfq.id) && rfq.status !== value) {
          await prisma.rFQStatusHistory.create({
            data: {
              rfqId: rfq.id,
              fromStatus: rfq.status,
              toStatus: value,
              changedById: user.id,
              notes: "Bulk status change",
            },
          });
        }
      }
      affectedCount = result.count;
    } else {
      return NextResponse.json({ success: false, message: "Invalid action. Use: assign, delete, or status" }, { status: 400 });
    }

    await logAudit(user.id, "RFQ", "BulkAction", `Bulk ${action} on ${affectedCount} RFQ(s)`, {
      newState: { action, rfqIds: rfq_ids, value },
      context: extractAuditContext(request),
      severity: "WARN",
    });

    return NextResponse.json({ success: true, data: { affectedCount } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Bulk action failed: ${error.message}` },
      { status: 500 }
    );
  }
}
