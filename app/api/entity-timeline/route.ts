import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

/**
 * GET /api/entity-timeline?rootEntityId=xxx
 * GET /api/entity-timeline?entityType=Quotation&entityId=xxx
 *
 * Returns a unified timeline of ActivityEvents for a given entity or root entity.
 * Enriches with actor name.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rootEntityId = searchParams.get("rootEntityId");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!rootEntityId && !entityId) {
    return NextResponse.json({ success: false, message: "Either rootEntityId or entityId is required" }, { status: 400 });
  }

  const where: any = {};
  if (rootEntityId) {
    where.rootEntityId = rootEntityId;
  } else if (entityType && entityId) {
    where.entityType = entityType;
    where.entityId = entityId;
  }

  const events = await prisma.activityEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    skip: offset,
  });

  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const enriched = events.map((e) => ({
    ...e,
    metadata: e.metadata ? JSON.parse(e.metadata) : null,
    actor: e.actorId ? actorMap.get(e.actorId) : null,
  }));

  return NextResponse.json({ success: true, data: enriched, count: enriched.length });
}
