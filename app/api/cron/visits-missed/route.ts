import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.customerVisit.updateMany({
    where: {
      status: "PLANNED",
      checkInTime: { equals: null } as any,
      createdAt: { lt: oneDayAgo },
      deletedAt: null,
    },
    data: { status: "MISSED" },
  });

  return NextResponse.json({ success: true, updated: result.count });
}
