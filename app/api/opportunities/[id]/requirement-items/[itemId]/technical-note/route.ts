import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const FEASIBILITY_VALUES = ["Feasible", "FeasibleWithChanges", "NotFeasible"] as const;

// PUT /api/opportunities/[id]/requirement-items/[itemId]/technical-note
// Upserts the technical note for a requirement item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, assignedUserId: true },
  });
  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  // Row-level scope
  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const reqItem = await prisma.opportunityRequirementItem.findFirst({ where: { id: itemId, dealId: id } });
  if (!reqItem) return NextResponse.json({ success: false, message: "Requirement item not found" }, { status: 404 });

  const body = await request.json();
  const { feasibility, confirmedSpec, toolingRequired, engineerId } = body;

  if (!feasibility || !FEASIBILITY_VALUES.includes(feasibility as any)) {
    return NextResponse.json(
      { success: false, message: `feasibility must be one of: ${FEASIBILITY_VALUES.join(", ")}` },
      { status: 400 }
    );
  }

  const resolvedEngineerId = engineerId || user.id;

  const note = await prisma.opportunityTechnicalNote.upsert({
    where: { requirementItemId: itemId },
    create: {
      requirementItemId: itemId,
      feasibility,
      confirmedSpec: confirmedSpec?.trim() || null,
      toolingRequired: toolingRequired?.trim() || null,
      engineerId: resolvedEngineerId,
      reviewedAt: new Date(),
    },
    update: {
      feasibility,
      confirmedSpec: confirmedSpec?.trim() || null,
      toolingRequired: toolingRequired?.trim() || null,
      engineerId: resolvedEngineerId,
      reviewedAt: new Date(),
    },
    include: { engineer: { select: { id: true, name: true } } },
  });

  await logAudit(user.id, "Opportunity", "TechnicalNote.Upsert",
    `Set feasibility=${feasibility} for product ${reqItem.productName} on opportunity ${id}`,
    { resourceId: id, newState: { feasibility, itemId }, severity: "INFO" }
  );

  return NextResponse.json({ success: true, data: note });
}

// DELETE /api/opportunities/[id]/requirement-items/[itemId]/technical-note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id, itemId } = await params;

  await prisma.opportunityTechnicalNote.deleteMany({ where: { requirementItemId: itemId } });

  return NextResponse.json({ success: true, message: "Technical note cleared" });
}
