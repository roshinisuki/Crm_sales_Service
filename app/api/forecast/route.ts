import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

const VALID_TYPES = ["Revenue", "Opportunity", "Sales"];

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.FORECAST, "GET /api/forecast");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const forecastType = searchParams.get("forecastType") || "";
  const assignedUserId = searchParams.get("assignedUserId") || "";

  const where: any = { companyId: user.companyId, year };
  if (forecastType) where.forecastType = forecastType;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const entries = await prisma.forecastEntry.findMany({
    where,
    include: { assignedUser: { select: { id: true, name: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return NextResponse.json({ success: true, data: entries });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.FORECAST, "POST /api/forecast");
  if (guard) return guard;

  const body = await request.json();

  if (!body.month || body.month < 1 || body.month > 12) {
    return NextResponse.json({ success: false, message: "Month must be 1-12" }, { status: 400 });
  }
  if (!body.year || body.year < 2000 || body.year > 2100) {
    return NextResponse.json({ success: false, message: "Invalid year" }, { status: 400 });
  }
  if (!body.forecastType || !VALID_TYPES.includes(body.forecastType)) {
    return NextResponse.json({ success: false, message: "Invalid forecast type" }, { status: 400 });
  }
  if (!body.targetAmount || body.targetAmount <= 0) {
    return NextResponse.json({ success: false, message: "Target amount must be positive" }, { status: 400 });
  }

  const entry = await prisma.forecastEntry.create({
    data: {
      month: parseInt(body.month),
      year: parseInt(body.year),
      forecastType: body.forecastType,
      targetAmount: parseFloat(body.targetAmount),
      assignedUserId: body.assignedUserId || null,
      notes: body.notes || null,
      companyId: user.companyId,
    },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: entry }, { status: 201 });
}
