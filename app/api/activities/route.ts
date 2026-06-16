import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { nanoid } from "nanoid";

// GET /api/activities
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") || "";
    const leadId = url.searchParams.get("leadId") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const search = url.searchParams.get("search") || "";

    const where: any = { deletedAt: null };
    if (channel) where.channel = channel;
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { outcome: { contains: search } },
        { agenda: { contains: search } },
      ];
    }

    const logs = await prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    console.error("GET /api/activities error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/activities
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const channel = body.channel; // "Call" | "Meeting" | "Note"

    if (channel === "Call") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Call",
          customerId: body.customerId ?? null,
          leadId: body.leadId ?? null,
          direction: body.direction ?? "Outbound",
          duration: body.duration ?? null,
          content: body.content ?? "",
          status: body.status ?? "Completed",
          sentByUserId: user.id,
          sentAt: new Date(),
          companyId: user.companyId ?? null,
        },
      });
      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "Meeting") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Meeting",
          customerId: body.customerId ?? null,
          leadId: body.leadId ?? null,
          direction: "Outbound",
          meetingDate: body.meetingDate ? new Date(body.meetingDate) : null,
          location: body.location ?? null,
          mode: body.mode ?? null,
          agenda: body.agenda ?? null,
          outcome: body.outcome ?? null,
          content: body.content ?? "",
          status: body.status ?? "Scheduled",
          sentByUserId: user.id,
          sentAt: new Date(),
          companyId: user.companyId ?? null,
        },
      });
      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "Note") {
      const note = await prisma.note.create({
        data: {
          id: nanoid(),
          content: body.content ?? "",
          entityType: body.entityType ?? "LEAD",
          entityId: body.entityId ?? "",
          createdById: user.id,
          companyId: user.companyId ?? null,
        },
      });
      return NextResponse.json({ success: true, data: note }, { status: 201 });
    }

    return NextResponse.json({ success: false, message: "Invalid channel" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/activities error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
