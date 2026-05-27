"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function getAuditLogsAction(params?: { module?: string; action?: string; startDate?: string; endDate?: string; limit?: number }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Only Admin can view audit logs" };
    }

    const moduleFilter = params?.module;
    const actionFilter = params?.action;
    const limit = params?.limit || 100;
    const startDate = params?.startDate ? new Date(params.startDate) : null;
    const endDate = params?.endDate ? new Date(params.endDate) : null;
    
    if (endDate) {
      // Set end date to end of day to include all logs on that day
      endDate.setHours(23, 59, 59, 999);
    }

    const whereClause: any = { AND: [] };
    
    if (moduleFilter) whereClause.AND.push({ module: moduleFilter });
    if (actionFilter) whereClause.AND.push({ action: actionFilter });
    
    if (startDate || endDate) {
      const timestampFilter: any = {};
      if (startDate) timestampFilter.gte = startDate;
      if (endDate) timestampFilter.lte = endDate;
      whereClause.AND.push({ timestamp: timestampFilter });
    }

    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const normalized = logs.map((log) => ({
      ...log,
      userEmail: log.user?.email || "",
      performedBy: log.user?.name || "System",
      createdAt: log.timestamp.toISOString(),
      timestamp: log.timestamp.toISOString(),
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET Audit Logs Error:", error);
    return { success: false, message: "Failed to fetch audit logs" };
  }
}
