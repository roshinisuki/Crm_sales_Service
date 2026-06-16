import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");
    const leadSource = url.searchParams.get("leadSource");
    const assignedUserId = url.searchParams.get("assignedUserId");

    // Build the standard base scope for the user (Tenant + RBAC)
    const scope = buildScope(userPayload, "Lead");

    // Build filtering conditions for the table query
    const where: any = {
      ...scope,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (status && status !== "All") {
      where.status = status;
    }

    if (leadSource && leadSource !== "All") {
      where.leadSource = leadSource;
    }

    if (assignedUserId && assignedUserId !== "All") {
      where.assignedUserId = assignedUserId;
    }

    // Query Leads matching the filters
    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate Summary Metrics (always scoped to user/company scope, but ignoring table-specific status/source/date filters for baseline metrics)
    const baseWhere = { ...scope };

    const totalLeads = await prisma.lead.count({
      where: baseWhere,
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newLeadsThisMonth = await prisma.lead.count({
      where: {
        ...baseWhere,
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    const sqlCount = await prisma.lead.count({
      where: {
        ...baseWhere,
        status: {
          in: ["Qualified", "SQL"],
        },
      },
    });

    const lostLeadsCount = await prisma.lead.count({
      where: {
        ...baseWhere,
        status: "Lost",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        leads,
        summary: {
          totalLeads,
          newLeadsThisMonth,
          sqlCount,
          lostLeadsCount,
        },
      },
    });
  } catch (error: any) {
    console.error("GET Lead Report Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
