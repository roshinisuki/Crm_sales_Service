import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await prisma.quotation.updateMany({
    where: {
      validUntil: { lt: new Date() },
      status: { in: ["Sent", "UnderReview"] },
      deletedAt: null,
    },
    data: { status: "Expired" },
  });

  return NextResponse.json({ success: true, updated: result.count });
}
