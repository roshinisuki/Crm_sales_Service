"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function getAuditLogsAction(params?: { module?: string; action?: string; limit?: number }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Only Admin can view audit logs" };
    }

    const moduleFilter = params?.module;
    const actionFilter = params?.action;
    const limit = params?.limit || 100;

    const logs = await prisma.auditLog.findMany({
      where: {
        AND: [
          moduleFilter ? { module: moduleFilter } : {},
          actionFilter ? { action: actionFilter } : {},
        ],
      },
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
