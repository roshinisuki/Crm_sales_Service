import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// POST /api/rfq/[id]/reopen
// Reopens a Closed RFQ — transitions to UnderReview with mandatory reason
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/reopen");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Reason is mandatory
  if (!body.reason || !body.reason.trim()) {
    return NextResponse.json({ success: false, message: "A reason is required to reopen an RFQ" }, { status: 400 });
  }

  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, status: true, costingOwnerId: true, assignedUserId: true },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Only Closed RFQs can be reopened
  if (rfq.status !== "Closed") {
    return NextResponse.json({ success: false, message: `Cannot reopen RFQ in ${rfq.status} status — only Closed RFQs can be reopened` }, { status: 400 });
  }

  // Guard: check for linked accepted quotations or purchase orders
  const linkedQuotes = await prisma.quotation.findMany({
    where: { rfqId: id, deletedAt: null, status: { in: ["Accepted", "Sent", "UnderReview"] } },
    select: { id: true, quotationCode: true, status: true },
  });
  if (linkedQuotes.length > 0) {
    return NextResponse.json(
      { success: false, message: `Cannot reopen RFQ: ${linkedQuotes.length} quotation(s) are in active or accepted state (${linkedQuotes.map((q) => q.quotationCode).join(", ")}). Cancel or reject them first.` },
      { status: 409 }
    );
  }

  const linkedPOs = await prisma.purchaseOrder.findMany({
    where: { quotation: { rfqId: id }, deletedAt: null, status: { in: ["New", "UnderValidation", "Approved"] } },
    select: { id: true, poCode: true, status: true },
  });
  if (linkedPOs.length > 0) {
    return NextResponse.json(
      { success: false, message: `Cannot reopen RFQ: ${linkedPOs.length} purchase order(s) are in active state (${linkedPOs.map((p) => p.poCode).join(", ")}). Close or reject them first.` },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rFQ.update({
        where: { id },
        data: { status: "UnderReview" },
      });

      await tx.rFQStatusHistory.create({
        data: {
          rfqId: id,
          fromStatus: "Closed",
          toStatus: "UnderReview",
          changedById: user.id,
          notes: `Reopened: ${body.reason}`,
        },
      });
    });

    // Notify assigned user and costing owner
    const notifyUserIds = [rfq.assignedUserId, rfq.costingOwnerId].filter(Boolean) as string[];
    for (const uid of notifyUserIds) {
      await dispatchNotification({
        userId: uid,
        title: "RFQ Reopened",
        message: `RFQ ${rfq.rfqCode} was reopened. Reason: ${body.reason}`,
        type: "rfq",
        link: `/rfq/${id}`,
      }).catch(() => undefined);
    }

    await logAudit(user.id, "RFQ", "Reopen", `Reopened RFQ ${rfq.rfqCode}: ${body.reason}`, {
      resourceId: id,
      previousState: { status: "Closed" },
      newState: { status: "UnderReview" },
      context: extractAuditContext(request),
      severity: "WARN",
    });

    return NextResponse.json({ success: true, message: "RFQ reopened successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to reopen RFQ: ${error.message}` },
      { status: 500 }
    );
  }
}
