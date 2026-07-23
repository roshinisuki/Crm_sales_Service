import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// POST /api/visits/[id]/customer-unavailable
// Body: { reason }
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.CUSTOMER_VISITS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/visits/[id]/customer-unavailable");
  if (guard) return guard;
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, message: "reason is required" }, { status: 400 });
    }

    const visit = await prisma.customerVisit.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: { customer: { select: { name: true } } },
    });

    if (!visit) return NextResponse.json({ success: false, message: "Visit not found" }, { status: 404 });

    if (visit.status !== "CHECKED_IN") {
      return NextResponse.json(
        { success: false, message: `Cannot mark unavailable — visit status is ${visit.status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.customerVisit.update({
      where: { id },
      data: {
        status: "CUSTOMER_UNAVAILABLE",
        customerUnavailableReason: reason.trim(),
        checkOutTime: new Date(),
      },
      include: {
        customer: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
      },
    });

    await logAudit(user.id, "CustomerVisit", "CustomerUnavailable", `Customer unavailable for visit to ${visit.customer?.name}: ${reason}`, {
      resourceId: id,
      newState: { status: "CUSTOMER_UNAVAILABLE", customerUnavailableReason: reason },
      context: extractAuditContext(request),
      severity: "WARN",
    });

    return NextResponse.json({ success: true, data: updated, message: "Visit marked as customer unavailable" });
  } catch (error: any) {
    console.error("[Visit CustomerUnavailable Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
