"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function getAuditLogsAction(params?: {
  module?: string;
  action?: string;
  severity?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const moduleFilter   = params?.module;
    const actionFilter   = params?.action;
    const severityFilter = params?.severity;
    const resourceFilter = params?.resourceId;
    const limit          = params?.limit || 200;
    const startDate      = params?.startDate ? new Date(params.startDate) : null;
    const endDate        = params?.endDate   ? new Date(params.endDate)   : null;

    if (endDate) endDate.setHours(23, 59, 59, 999);

    const whereClause: any = { companyId: userPayload.companyId, AND: [] };

    if (moduleFilter)   whereClause.AND.push({ module:    { contains: moduleFilter, mode: "insensitive" } });
    if (actionFilter)   whereClause.AND.push({ action:    { contains: actionFilter, mode: "insensitive" } });
    if (severityFilter) whereClause.AND.push({ severity:  severityFilter });
    if (resourceFilter) whereClause.AND.push({ resourceId: resourceFilter });

    if (startDate || endDate) {
      const timestampFilter: any = {};
      if (startDate) timestampFilter.gte = startDate;
      if (endDate)   timestampFilter.lte = endDate;
      whereClause.AND.push({ timestamp: timestampFilter });
    }

    if (whereClause.AND.length === 0) delete whereClause.AND;

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const normalized = logs.map((log) => ({
      ...log,
      userEmail:    log.user?.email    || "",
      performedBy:  log.user?.name     || "System",
      performedRole: log.user?.role    || "System",
      createdAt:    log.timestamp.toISOString(),
      timestamp:    log.timestamp.toISOString(),
      // Stringify JSON for safe transport to client
      previousState: log.previousState ? JSON.stringify(log.previousState) : null,
      newState:      log.newState      ? JSON.stringify(log.newState)      : null,
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET Audit Logs Error:", error);
    return { success: false, message: "Failed to fetch audit logs" };
  }
}
