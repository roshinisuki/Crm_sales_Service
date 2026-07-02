import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Fetch all competitor products in a single query (avoids N+1 on the client)
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { competitor: { name: { contains: q } } },
    ];
  }

  const products = await prisma.competitorProduct.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      competitor: {
        select: { id: true, name: true, isActive: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: products });
}
