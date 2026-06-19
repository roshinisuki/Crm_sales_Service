import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const activityType = searchParams.get("activityType");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "30");

  const isExecutive = user.role === "SalesExecutive";
  const filterUserId = isExecutive ? user.id : userId || undefined;

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

  const items: any[] = [];

  // 1. CommunicationLog (Call, Meeting, Email, WhatsApp)
  if (!activityType || ["Call", "Meeting", "Email", "WhatsApp"].includes(activityType)) {
    const channelFilter: any = {};
    if (activityType) channelFilter.channel = activityType;
    else channelFilter.channel = { in: ["Call", "Meeting", "Email", "WhatsApp"] };

    const logs = await prisma.communicationLog.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        ...(filterUserId ? { sentByUserId: filterUserId } : {}),
        ...channelFilter,
        ...(Object.keys(dateFilter).length > 0 ? { sentAt: dateFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    for (const log of logs) {
      const entity = log.customer
        ? { type: "Customer", id: log.customer.id, name: log.customer.name, code: log.customer.customerCode }
        : log.lead
        ? { type: "Lead", id: log.lead.id, name: log.lead.name, code: log.lead.leadCode }
        : null;

      if (entityType && entity?.type !== entityType) continue;

      items.push({
        id: `log-${log.id}`,
        type: log.channel,
        actor: { id: log.sentByUser?.id || "", name: log.sentByUser?.name || "System" },
        entity,
        description: `${log.channel} ${log.customer?.name || log.lead?.name || "Unknown"} — ${log.outcome || log.status}`,
        timestamp: log.sentAt,
      });
    }
  }

  // 2. Note (CommunicationLog with channel = "Note")
  if (!activityType || activityType === "Note") {
    const notes = await prisma.communicationLog.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        channel: "Note",
        ...(filterUserId ? { sentByUserId: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { sentAt: dateFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    for (const note of notes) {
      const entity = note.customer
        ? { type: "Customer", id: note.customer.id, name: note.customer.name, code: note.customer.customerCode }
        : note.lead
        ? { type: "Lead", id: note.lead.id, name: note.lead.name, code: note.lead.leadCode }
        : null;

      if (entityType && entity?.type !== entityType) continue;

      items.push({
        id: `note-${note.id}`,
        type: "Note",
        actor: { id: note.sentByUser?.id || "", name: note.sentByUser?.name || "System" },
        entity,
        description: `Added note on ${note.customer?.name || note.lead?.name || "Unknown"}`,
        timestamp: note.sentAt,
      });
    }
  }

  // 3. CustomerVisit (status = COMPLETED)
  if (!activityType || activityType === "Visit") {
    const visits = await prisma.customerVisit.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        status: "COMPLETED",
        ...(filterUserId ? { hostedBy: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { checkOutTime: dateFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        host: { select: { id: true, name: true } },
      },
      orderBy: { checkOutTime: "desc" },
      take: 100,
    });

    for (const v of visits) {
      const entity = { type: "Customer", id: v.customer?.id, name: v.customer?.name, code: v.customer?.customerCode };
      if (entityType && entity.type !== entityType) continue;
      items.push({
        id: `visit-${v.id}`,
        type: "Visit",
        actor: { id: v.host?.id || "", name: v.host?.name || "System" },
        entity,
        description: `Visited ${v.customer?.name} — ${v.outcome || "Completed"}`,
        timestamp: v.checkOutTime || v.createdAt,
      });
    }
  }

  // 4. FollowUp (status = Completed)
  if (!activityType || activityType === "FollowUp") {
    const followUps = await prisma.followUp.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        status: "Completed",
        ...(filterUserId ? { assignedUserId: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 100,
    });

    for (const f of followUps) {
      const entity = f.customer
        ? { type: "Customer", id: f.customer.id, name: f.customer.name, code: f.customer.customerCode }
        : f.lead
        ? { type: "Lead", id: f.lead.id, name: f.lead.name, code: f.lead.leadCode }
        : null;
      if (entityType && entity?.type !== entityType) continue;
      items.push({
        id: `followup-${f.id}`,
        type: "FollowUp",
        actor: { id: f.assignedUser?.id || "", name: f.assignedUser?.name || "System" },
        entity,
        description: `Completed follow-up with ${f.customer?.name || f.lead?.name || "Unknown"}`,
        timestamp: f.completedAt || f.updatedAt,
      });
    }
  }

  // 5. Task (status = Completed)
  if (!activityType || activityType === "Task") {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        status: "Completed",
        ...(filterUserId ? { assignedTo: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { updatedAt: dateFilter } : {}),
      },
      include: { User: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    for (const t of tasks) {
      if (entityType && entityType !== "Customer") continue;
      items.push({
        id: `task-${t.id}`,
        type: "Task",
        actor: { id: t.User?.id || "", name: t.User?.name || "System" },
        entity: null,
        description: `Completed task: ${t.title}`,
        timestamp: t.updatedAt,
      });
    }
  }

  // 6. DealStageHistory
  if (!activityType || activityType === "StageChange") {
    const stageHistories = await prisma.dealStageHistory.findMany({
      where: {
        ...(filterUserId ? { changedById: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { changedAt: dateFilter } : {}),
        deal: { companyId: user.companyId },
      },
      include: {
        deal: { select: { id: true, dealName: true, companyId: true } },
        changedBy: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
      take: 100,
    });

    for (const s of stageHistories) {
      if (entityType && entityType !== "Deal") continue;
      items.push({
        id: `stage-${s.id}`,
        type: "StageChange",
        actor: { id: s.changedBy?.id || "", name: s.changedBy?.name || "System" },
        entity: { type: "Deal", id: s.deal?.id, name: s.deal?.dealName, code: "" },
        description: `Deal ${s.deal?.dealName} moved from ${s.fromStatus || "—"} to ${s.toStatus}`,
        timestamp: s.changedAt,
      });
    }
  }

  // 7. LeadOwnerHistory
  if (!activityType || activityType === "Reassignment") {
    const ownerHistories = await prisma.leadOwnerHistory.findMany({
      where: {
        lead: { companyId: user.companyId },
        ...(filterUserId ? { changedById: filterUserId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, leadCode: true, companyId: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    for (const o of ownerHistories) {
      if (entityType && entityType !== "Lead") continue;
      items.push({
        id: `reassign-${o.id}`,
        type: "Reassignment",
        actor: { id: o.changedByUser?.id || "", name: o.changedByUser?.name || "System" },
        entity: { type: "Lead", id: o.lead?.id, name: o.lead?.name, code: o.lead?.leadCode },
        description: `Lead ${o.lead?.name} reassigned to ${o.toUser?.name || "Unassigned"}`,
        timestamp: o.timestamp,
      });
    }
  }

  // Sort all items by timestamp desc
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = items.length;
  const startIdx = (page - 1) * limit;
  const pagedItems = items.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < total;

  return NextResponse.json({ success: true, items: pagedItems, total, page, hasMore });
}
