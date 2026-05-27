import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: { customers: [], visits: [], visitors: [] } });
    }

    const isExec = userPayload.role === "MarketingExecutive";
    const userId = userPayload.id;

    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          isExec ? { assignedUserId: userId } : {},
          {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { customerCode: { contains: q } },
            ]
          }
        ]
      },
      take: 5,
    });

    const visits = await prisma.marketingVisit.findMany({
      where: {
        AND: [
          isExec ? { executiveId: userId } : {},
          {
            OR: [
              { customer: { name: { contains: q } } },
              { executive: { name: { contains: q } } },
            ]
          }
        ]
      },
      include: { customer: { select: { name: true } }, executive: { select: { name: true } } },
      take: 5,
    });

    const visitors = await prisma.visitor.findMany({
      where: {
        AND: [
          isExec ? { hostUserId: userId } : {},
          {
            OR: [
              { visitorName: { contains: q } },
              { company: { contains: q } },
            ]
          }
        ]
      },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: { customers, visits, visitors }
    });

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ success: false, message: "Search failed" }, { status: 500 });
  }
}
