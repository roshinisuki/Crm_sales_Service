import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get("isActive");
  const q = searchParams.get("q");

  const where: any = { companyId: user.companyId };
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;
  if (q) where.name = { contains: q };

  const competitors = await prisma.competitor.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { products: true, lostDeals: true } } },
  });

  return NextResponse.json({ success: true, data: competitors });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });

  const competitor = await prisma.competitor.create({
    data: {
      name: body.name,
      website: body.website || null,
      description: body.description || null,
      strengths: body.strengths || null,
      weaknesses: body.weaknesses || null,
      isActive: body.isActive !== false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: competitor });
}
