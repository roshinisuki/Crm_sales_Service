import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

/**
 * GET /api/rfq/[id]/requirement-report
 *
 * Returns requirement gathering report data for a given RFQ.
 * Includes ALL product requirement items (not filtered by feasibility),
 * customer/opportunity summary, demo notes, stage history, and RFQ metadata.
 * The calling client (RFQ detail page) uses jspdf + jspdf-autotable to generate
 * and download the PDF in the browser.
 *
 * Auth: identical guard to GET /api/rfq/[id].
 * Read-only: no DB writes. No report versioning or storage.
 * Empty-state: returns a valid payload with empty arrays when no opportunity is linked.
 */
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role === "Customer")
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId))
      return NextResponse.json(
        { success: false, message: "SuperAdmin must access via support/impersonation mode." },
        { status: 403 }
      );

    const { id } = await params;

    // Fetch the RFQ with its line items (used for cross-reference)
    const rfq = await prisma.rFQ.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      select: {
        id: true,
        rfqCode: true,
        status: true,
        priority: true,
        receivedDate: true,
        opportunityId: true,
        customer: {
          select: { name: true, customerCode: true, email: true, phone: true, city: true },
        },
        lineItems: {
          select: {
            id: true,
            itemDescription: true,
            sourceRequirementItemId: true,
            quantity: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!rfq)
      return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

    // Empty-state: no linked opportunity
    if (!rfq.opportunityId) {
      return NextResponse.json({
        success: true,
        data: {
          rfq: {
            rfqCode: rfq.rfqCode,
            status: rfq.status,
            priority: rfq.priority,
            receivedDate: rfq.receivedDate,
          },
          customer: rfq.customer,
          opportunity: null,
          requirementItems: [],
          stageHistory: [],
          generatedAt: new Date().toISOString(),
          note: "No opportunity linked to this RFQ. No requirement items to display.",
        },
      });
    }

    // Fetch the full opportunity with ALL requirement items (no feasibility filter)
    const opportunity = await prisma.deal.findUnique({
      where: { id: rfq.opportunityId },
      select: {
        id: true,
        dealName: true,
        opportunityCode: true,
        status: true,
        meetingLogs: {
          orderBy: { attemptNumber: "desc" },
          take: 1,
          select: {
            meetingDate: true,
            meetingType: true,
            outcome: true,
            notes: true,
            conductedAt: true,
          }
        },
        requirementItems: {
          select: {
            id: true,
            productName: true,
            estimatedQuantity: true,
            targetPriceMin: true,
            targetPriceMax: true,
            material: true,
            requiredDelivery: true,
            specNotes: true,
            technicalNote: {
              select: {
                feasibility: true,
                confirmedSpec: true,
                toolingRequired: true,
                reviewedAt: true,
                engineer: { select: { name: true } },
              },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
        stageHistories: {
          select: { fromStatus: true, toStatus: true, changedAt: true, outcomeNotes: true },
          orderBy: { changedAt: "asc" },
        },
      },
    });

    // Cross-reference using the FK
    const rfqLineItemRequirementIds = new Set(
      rfq.lineItems
        .map((li) => li.sourceRequirementItemId)
        .filter(Boolean) as string[]
    );

    const requirementItems = (opportunity?.requirementItems || []).map((item) => ({
      id: item.id,
      productName: item.productName,
      estimatedQuantity: item.estimatedQuantity,
      targetPriceMin: item.targetPriceMin ? Number(item.targetPriceMin) : null,
      targetPriceMax: item.targetPriceMax ? Number(item.targetPriceMax) : null,
      material: item.material,
      requiredDelivery: item.requiredDelivery,
      specNotes: item.specNotes,
      feasibility: item.technicalNote?.feasibility ?? null,
      confirmedSpec: item.technicalNote?.confirmedSpec ?? null,
      toolingRequired: item.technicalNote?.toolingRequired ?? null,
      reviewedAt: item.technicalNote?.reviewedAt ?? null,
      engineerName: item.technicalNote?.engineer?.name ?? null,
      // Cross-reference: did this item make it into the RFQ?
      includedInRFQ: rfqLineItemRequirementIds.has(item.id),
      // True when no technical note OR feasibility is not Feasible/FeasibleWithChanges
      needsFeasibilityReview:
        !item.technicalNote ||
        !["Feasible", "FeasibleWithChanges"].includes(item.technicalNote?.feasibility ?? ""),
    }));

    return NextResponse.json({
      success: true,
      data: {
        rfq: {
          rfqCode: rfq.rfqCode,
          status: rfq.status,
          priority: rfq.priority,
          receivedDate: rfq.receivedDate,
        },
        customer: rfq.customer,
        opportunity: opportunity
          ? {
              dealName: opportunity.dealName,
              opportunityCode: opportunity.opportunityCode,
              currentStatus: opportunity.status,
              demoOutcome: opportunity.meetingLogs?.[0]?.outcome || null,
              demoNotes: opportunity.meetingLogs?.[0]?.notes || null,
              meetingDate: opportunity.meetingLogs?.[0]?.meetingDate?.toISOString() || null,
              meetingType: opportunity.meetingLogs?.[0]?.meetingType || null,
              conductedAt: opportunity.meetingLogs?.[0]?.conductedAt?.toISOString() || null,
            }
          : null,
        stageHistory: opportunity?.stageHistories ?? [],
        requirementItems,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating requirement report:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal Server Error" }, { status: 500 });
  }
}