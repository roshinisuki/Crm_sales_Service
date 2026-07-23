import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Lightweight deals list endpoint (used by lost-deal analysis picker, etc.)
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.DEALS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/deals");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const where: any = { companyId: user.companyId, deletedAt: null };
  if (status) where.status = status;
  if (q) where.dealName = { contains: q };

  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const deals = await prisma.deal.findMany({
    where,
    select: {
      id: true,
      dealName: true,
      status: true,
      dealValue: true,
      customer: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: deals });
}
