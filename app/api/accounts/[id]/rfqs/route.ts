import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

// GET /api/accounts/[id]/rfqs
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "/api/accounts/[id]/rfqs");
    if (guard) return guard;

    const { id } = await context.params;

    const rfqs = await prisma.rFQ.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: rfqs,
      count: rfqs.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
