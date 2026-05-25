import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead"])) {
      return apiError("Unauthorized: Insufficient permissions to view audit logs", 403);
    }

    const { searchParams } = new URL(request.url);
    const limit   = parseInt(searchParams.get("limit")  || "200", 10);
    const skip    = parseInt(searchParams.get("skip")   || "0",   10);
    const module  = searchParams.get("module")  || undefined;
    const search  = searchParams.get("search")  || undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(module ? { module } : {}),
        ...(search ? {
          OR: [
            { action:  { contains: search } },
            { details: { contains: search } },
            { module:  { contains: search } },
          ],
        } : {}),
      },
      take: limit,
      skip,
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // Normalize: expose userEmail and createdAt aliases for frontend
    const normalized = logs.map((l) => ({
      ...l,
      userEmail:    l.user?.email ?? null,
      performedBy:  l.user?.name ?? l.user?.email ?? null,
      createdAt:    l.timestamp.toISOString(),
    }));

    return apiSuccess(normalized);
  } catch (error) {
    console.error("GET Audit Logs Error:", error);
    return apiError("Failed to fetch audit logs", 500);
  }
}
