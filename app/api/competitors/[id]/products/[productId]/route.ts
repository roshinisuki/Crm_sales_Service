import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]/products/[productId]");
  if (guard) return guard;
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id, productId } = await params;
  const product = await prisma.competitorProduct.findFirst({
    where: { id: productId, competitorId: id, competitor: { companyId: user.companyId } },
  });
  if (!product) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.competitorProduct.update({
    where: { id: productId },
    data: {
      name: body.name,
      description: body.description,
      priceRange: body.priceRange,
      ourAdvantage: body.ourAdvantage,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}


export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.COMPETITORS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/competitors/[id]/products/[productId]");
  if (guard) return guard;
  if (!["Admin"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const { id, productId } = await params;
  const product = await prisma.competitorProduct.findFirst({
    where: { id: productId, competitorId: id, competitor: { companyId: user.companyId } },
  });
  if (!product) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  await prisma.competitorProduct.delete({ where: { id: productId } });
  return NextResponse.json({ success: true });
}
