import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]/products");
  if (guard) return guard;

  const { id } = await params;
  const competitor = await prisma.competitor.findFirst({ where: { id, companyId: user.companyId } });
  if (!competitor) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const products = await prisma.competitorProduct.findMany({
    where: { competitorId: id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: products });
}


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]/products");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const competitor = await prisma.competitor.findFirst({ where: { id, companyId: user.companyId } });
  if (!competitor) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });

  const product = await prisma.competitorProduct.create({
    data: {
      competitorId: id,
      name: body.name,
      description: body.description || null,
      priceRange: body.priceRange || null,
      ourAdvantage: body.ourAdvantage || null,
    },
  });

  return NextResponse.json({ success: true, data: product });
}
