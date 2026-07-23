import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TARGETS, "GET /api/targets");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const userId = searchParams.get("userId");
  const period = searchParams.get("period");
  const territoryId = searchParams.get("territoryId");

  const where: any = { companyId: user.companyId };
  if (targetType) where.targetType = targetType;
  if (userId) where.assignedUserId = userId;
  if (period) where.period = period;
  if (territoryId) where.territoryId = territoryId;

  const targets = await prisma.salesTarget.findMany({
    where,
    orderBy: { period: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true, region: true } },
    },
  });

  return NextResponse.json({ success: true, data: targets });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.TARGETS, "POST /api/targets");
  if (guard) return guard;

  const body = await request.json();
  if (!body.targetType) return NextResponse.json({ success: false, message: "Target type is required" }, { status: 400 });
  if (!body.period) return NextResponse.json({ success: false, message: "Period is required" }, { status: 400 });
  if (!body.targetAmount || body.targetAmount <= 0) return NextResponse.json({ success: false, message: "Target amount must be positive" }, { status: 400 });

  // Check for duplicate
  const existing = await prisma.salesTarget.findFirst({
    where: {
      targetType: body.targetType,
      period: body.period,
      assignedUserId: body.assignedUserId || null,
      territoryId: body.territoryId || null,
      companyId: user.companyId,
    },
  });
  if (existing) return NextResponse.json({ success: false, message: "Target already exists for this period/user/territory" }, { status: 400 });

  const target = await prisma.salesTarget.create({
    data: {
      targetType: body.targetType,
      period: body.period,
      targetAmount: parseFloat(body.targetAmount),
      achievedAmount: 0,
      assignedUserId: body.assignedUserId || null,
      territoryId: body.territoryId || null,
      notes: body.notes || null,
      companyId: user.companyId,
    },
  });

  await logAudit(user.id, "Target", "CREATE", `Created ${body.targetType} target for ${body.period}`, {
    resourceId: target.id,
    newState: target,
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: target });
}
