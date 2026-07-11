import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { buildScope } from "@/lib/scopes";
import { PIPELINE_OPEN_STAGES } from "@/lib/module-status-config";

// GET /api/opportunities — list opportunities (Deal records with opportunityCode)
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const search = searchParams.get("search") || "";
  const overdue = searchParams.get("overdue");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const scope = buildScope(user, "Deal");

  const where: any = {
    ...scope,
    ...(stage ? { status: stage } : {}),
    ...(search
      ? {
          OR: [
            { dealName: { contains: search } },
            { opportunityCode: { contains: search } },
            { customer: { name: { contains: search } } },
          ],
        }
      : {}),
  };

  // Dynamic overdue computation: close date passed OR stuck in any open stage > 15 days
  // Uses stageEnteredAt (when the deal entered the current stage) with fallback to createdAt
  if (overdue === "true") {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { expectedCloseDate: { lt: now } },
          {
            AND: [
              { status: { in: PIPELINE_OPEN_STAGES } },
              {
                OR: [
                  { stageEnteredAt: { lt: fifteenDaysAgo } },
                  { stageEnteredAt: null, createdAt: { lt: fifteenDaysAgo } },
                ]
              }
            ]
          }
        ]
      }
    ];
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, city: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        opportunityContacts: {
          include: {
            contact: { select: { id: true, name: true, designation: true, email: true, phone: true } },
          },
        },
        _count: { select: { quotations: true, tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.deal.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: deals,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// POST /api/opportunities — create a new opportunity
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const body = await request.json();

  // Validate required fields
  if (!body.dealName || !body.customerId) {
    return NextResponse.json(
      { success: false, message: "dealName and customerId are required" },
      { status: 400 }
    );
  }

  const initialStage = body.status || "Qualified";

  // Get probability from PipelineStageMaster
  let probabilityPercent = body.probabilityPercent ?? 20;
  const stageMaster = await prisma.pipelineStageMaster.findFirst({
    where: { stageName: initialStage, isActive: true },
  });
  if (stageMaster) {
    probabilityPercent = stageMaster.probabilityPercent;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Generate opportunity code: OPP-YYYY-NNNNN
    const year = new Date().getFullYear();
    const oppPrefix = `OPP-${year}-`;
    const oppCount = await tx.deal.count({
      where: { opportunityCode: { startsWith: oppPrefix } },
    });
    const opportunityCode = `${oppPrefix}${String(oppCount + 1).padStart(5, "0")}`;

    // Create the Deal (Opportunity)
    const deal = await tx.deal.create({
      data: {
        dealName: body.dealName,
        customerId: body.customerId,
        dealValue: parseFloat(body.dealValue || body.estimatedValue) || 0,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        assignedUserId: body.assignedUserId || user.id,
        notes: body.notes || null,
        status: initialStage,
        opportunityCode,
        probabilityPercent,
        companyId: user.companyId,
      },
    });

    // Insert initial stage history
    await tx.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: null,
        toStatus: initialStage,
        changedById: user.id,
        durationInPreviousStage: 0,
      },
    });

    // Auto-create stage-appropriate follow-up
    const followUpDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days
    await tx.followUp.create({
      data: {
        customerId: body.customerId,
        assignedUserId: body.assignedUserId || user.id,
        nextMeetingDate: followUpDate,
        dueDate: followUpDate,
        remarks: "Schedule discovery call",
        status: "Pending",
        priority: "High",
        sourceType: "OPPORTUNITY_CREATE",
        sourceId: deal.id,
        autoCreated: true,
        companyId: user.companyId,
        stageAtCreation: "Deal",
      },
    });

    return deal;
  });

  await logAudit(user.id, "Opportunity", "Create", `Created opportunity ${result.opportunityCode} (${body.dealName})`, {
    resourceId: result.id,
    newState: { opportunityCode: result.opportunityCode, stage: initialStage, dealValue: result.dealValue },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  // Notify assigned user if different from creator
  if (result.assignedUserId && result.assignedUserId !== user.id) {
    await dispatchNotification({
      userId: result.assignedUserId,
      title: "New Opportunity Assigned",
      message: `You have been assigned a new opportunity: "${body.dealName}" (${result.opportunityCode}).`,
      type: "deal",
      link: `/sales-pipeline/${result.id}`,
    });
  }

  return NextResponse.json({ success: true, data: result }, { status: 201 });
}
