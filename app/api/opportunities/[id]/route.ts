import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { checkRecordScope } from "@/lib/scopes";

// GET /api/opportunities/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    // SuperAdmin must use support/impersonation mode
    if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
      return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing opportunity ID" }, { status: 400 });
    }

    const deal = await prisma.deal.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true, status: true, industryType: true, convertedFromLead: true },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
        opportunityDetail: true,
        opportunityContacts: {
          include: {
            contact: { select: { id: true, name: true, designation: true, email: true, phone: true, company: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
        stageHistories: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
        quotations: {
          select: {
            id: true, quotationCode: true, status: true, finalAmount: true,
            validUntil: true, pdfUrl: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: "desc" },
        },
        lostReasonRef: { select: { id: true, name: true } },
        // Manufacturing pipeline: product requirement items with per-product feasibility notes
        requirementItems: {
          include: {
            technicalNote: {
              include: { engineer: { select: { id: true, name: true, role: true } } },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
        _count: { select: { quotations: true, tasks: true } },
      },
    });

    if (!deal) {
      // Diagnostic: check if the deal exists at all (without company filter)
      const rawDeal = await prisma.deal.findUnique({ where: { id }, select: { id: true, companyId: true, deletedAt: true, assignedUserId: true } });
      if (rawDeal?.deletedAt) {
        return NextResponse.json({ success: false, message: "Opportunity not found (deleted)" }, { status: 404 });
      }
      if (rawDeal && rawDeal.companyId !== user.companyId) {
        return NextResponse.json({ success: false, message: "Opportunity not found (belongs to a different company/tenant)" }, { status: 404 });
      }
      if (user.role === "SalesExecutive" && rawDeal && rawDeal.assignedUserId !== user.id) {
        return NextResponse.json({ success: false, message: "Opportunity not found (assigned to another sales executive)" }, { status: 403 });
      }
      console.error("[GET /api/opportunities/[id]] Deal not found. id:", id, "user.companyId:", user.companyId, "user.role:", user.role);
      return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });
    }

    // Row-level scope check
    if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    // Fetch linked RFQs (via quotations → rfqId, or direct customer RFQs)
    const rfqs = await prisma.rFQ.findMany({
      where: { customerId: deal.customerId, deletedAt: null },
      select: {
        id: true, rfqCode: true, status: true, priority: true,
        customerDueDate: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Fetch the originating lead (if deal was created from lead conversion)
    // so the frontend can auto-fill Qualified/RG fields from lead data
    let lead: any = null;
    if (deal.customer?.convertedFromLead) {
      lead = await prisma.lead.findUnique({
        where: { id: deal.customer.convertedFromLead },
        select: {
          id: true, name: true, companyName: true, email: true, phone: true,
          city: true, industryType: true, budgetAsked: true, timelineAsked: true,
          estimatedValue: true, leadSource: true, notes: true, designation: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: { ...deal, rfqs, lead } });
  } catch (error: any) {
    console.error("[GET /api/opportunities/[id]] error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load opportunity" },
      { status: 500 }
    );
  }
}

// PUT /api/opportunities/[id] — update opportunity fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && existing.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const updateData: any = {};
  if (body.dealName !== undefined) updateData.dealName = body.dealName;
  if (body.dealValue !== undefined) updateData.dealValue = parseFloat(body.dealValue) || 0;
  if (body.expectedCloseDate !== undefined) updateData.expectedCloseDate = new Date(body.expectedCloseDate);
  if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;
  if (body.probabilityPercent !== undefined) updateData.probabilityPercent = parseInt(body.probabilityPercent) || 0;

  const deal = await prisma.deal.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  await logAudit(user.id, "Opportunity", "Update", `Updated opportunity ${existing.opportunityCode || existing.dealName}`, {
    resourceId: id,
    previousState: { dealValue: existing.dealValue, probabilityPercent: existing.probabilityPercent },
    newState: updateData,
    context: extractAuditContext(request),
    severity: "WARN",
  });

  return NextResponse.json({ success: true, data: deal });
}
