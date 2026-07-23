import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.TERRITORIES, "GET /api/territories");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const isActive = searchParams.get("isActive");

  const where: any = { companyId: user.companyId };
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;
  if (q) where.name = { contains: q };

  const territories = await prisma.territory.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      _count: { select: { accounts: true, targets: true } },
    },
  });

  return NextResponse.json({ success: true, data: territories });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.TERRITORIES, "POST /api/territories");
  if (guard) return guard;

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
  if (!body.region) return NextResponse.json({ success: false, message: "Region is required" }, { status: 400 });

  const territory = await prisma.territory.create({
    data: {
      name: body.name,
      region: body.region,
      states: body.states || null,
      assignedUserId: body.assignedUserId || null,
      isActive: body.isActive !== false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: territory });
}
