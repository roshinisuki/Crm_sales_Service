import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";
import { checkAndUpdateOverdueFollowUps } from "@/app/actions/followUps";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");
    const assignedUserId = url.searchParams.get("assignedUserId");

    // Refresh overdue statuses for the tenant
    await checkAndUpdateOverdueFollowUps(userPayload.companyId);

    // Build the standard base scope for the user (Tenant + RBAC)
    const scope = buildScope(userPayload, "FollowUp");

    // Build filtering conditions for the table query
    const where: any = {
      ...scope,
    };

    if (startDate || endDate) {
      where.nextMeetingDate = {};
      if (startDate) {
        where.nextMeetingDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.nextMeetingDate.lte = end;
      }
    }

    if (status && status !== "All") {
      where.status = status;
    }

    if (assignedUserId && assignedUserId !== "All") {
      where.assignedUserId = assignedUserId;
    }

    // Query Follow-ups matching filters
    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            customerCode: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            leadCode: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        nextMeetingDate: "asc",
      },
    });

    // Calculate Summary Metrics (always scoped to user/company scope, but ignoring table filters)
    const baseWhere = { ...scope };

    const totalFollowUps = await prisma.followUp.count({
      where: baseWhere,
    });

    const pendingCount = await prisma.followUp.count({
      where: {
        ...baseWhere,
        status: "Pending",
      },
    });

    const completedCount = await prisma.followUp.count({
      where: {
        ...baseWhere,
        status: "Completed",
      },
    });

    const overdueCount = await prisma.followUp.count({
      where: {
        ...baseWhere,
        status: "Overdue",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        followUps,
        summary: {
          totalFollowUps,
          pendingCount,
          completedCount,
          overdueCount,
        },
      },
    });
  } catch (error: any) {
    console.error("GET Follow-up Report Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
