import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";
import { logAudit, extractAuditContext } from "@/lib/audit";

// GET: Role-restricted costing sheet view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      costingSheets: {
        include: { submittedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Role-restricted view
  const canSeeFullBreakdown = ["CostingEngineer", "Admin", "SalesManager"].includes(user.role || "");

  if (canSeeFullBreakdown) {
    return NextResponse.json({ success: true, data: rfq.costingSheets });
  } else {
    // Sales Executive / Telecaller: only computed_unit_price
    const restricted = rfq.costingSheets.map((cs) => ({
      id: cs.id,
      rfqId: cs.rfqId,
      computedUnitPrice: cs.computedUnitPrice,
      createdAt: cs.createdAt,
      submittedBy: cs.submittedBy,
    }));
    return NextResponse.json({ success: true, data: restricted });
  }
}

// POST: Submit costing sheet(s) (Costing Engineer / Admin only)
// Supports two modes:
//   1. Legacy single costing: { material_cost, labour_cost, ... }
//   2. Per-line-item costing: { line_items: [{ line_item_id, material_cost, labour_cost, ... }] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  if (!["CostingEngineer", "Admin"].includes(user.role || "")) {
    return NextResponse.json(
      { success: false, message: "Only Costing Engineers and Admins can submit costing sheets" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { rfqCode: true, assignedUserId: true, lineItems: { select: { id: true, itemDescription: true } } },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  // Helper to validate and compute unit price
  const computeUnitPrice = (mc: number, lc: number, oh: number, mg: number, fr: number, pk: number, tl: number, ot: number) => {
    return (mc + lc + fr + pk + tl + ot) * (1 + oh / 100) * (1 + mg / 100);
  };

  const validateCost = (val: any, field: string, allowZero: boolean = true): { valid: boolean; message?: string; value: number } => {
    const n = parseFloat(val);
    if (isNaN(n)) return { valid: false, message: `${field} must be a number`, value: 0 };
    if (allowZero ? n < 0 : n <= 0) return { valid: false, message: `${field} must be ${allowZero ? "0 or greater" : "greater than 0"}`, value: 0 };
    return { valid: true, value: n };
  };

  const createdSheets: any[] = [];

  if (body.line_items && Array.isArray(body.line_items)) {
    // Per-line-item costing mode
    if (body.line_items.length === 0) {
      return NextResponse.json({ success: false, message: "At least one line item costing is required" }, { status: 400 });
    }

    for (const li of body.line_items) {
      const mc = validateCost(li.material_cost, "Material cost", false);
      const lc = validateCost(li.labour_cost, "Labour cost", false);
      const oh = validateCost(li.overhead_percent, "Overhead percent");
      const mg = validateCost(li.margin_percent, "Margin percent");
      const fr = validateCost(li.freight_cost || 0, "Freight cost");
      const pk = validateCost(li.packaging_cost || 0, "Packaging cost");
      const tl = validateCost(li.tooling_cost || 0, "Tooling cost");
      const ot = validateCost(li.other_cost || 0, "Other cost");

      if (!mc.valid) return NextResponse.json({ success: false, message: mc.message }, { status: 400 });
      if (!lc.valid) return NextResponse.json({ success: false, message: lc.message }, { status: 400 });
      if (!oh.valid) return NextResponse.json({ success: false, message: oh.message }, { status: 400 });
      if (!mg.valid) return NextResponse.json({ success: false, message: mg.message }, { status: 400 });

      const computedUnitPrice = computeUnitPrice(mc.value, lc.value, oh.value, mg.value, fr.value, pk.value, tl.value, ot.value);
      if (computedUnitPrice <= 0) {
        return NextResponse.json({ success: false, message: "Computed unit price must be greater than 0" }, { status: 400 });
      }

      // Validate line item belongs to this RFQ
      const lineItemExists = rfq.lineItems.some((li2) => li2.id === li.line_item_id);
      if (!lineItemExists) {
        return NextResponse.json({ success: false, message: `Line item ${li.line_item_id} not found in this RFQ` }, { status: 400 });
      }

      const sheet = await prisma.rFQCostingSheet.create({
        data: {
          rfqId: id,
          rfqLineItemId: li.line_item_id,
          materialCost: mc.value,
          labourCost: lc.value,
          overheadPercent: oh.value,
          marginPercent: mg.value,
          freightCost: fr.value,
          packagingCost: pk.value,
          toolingCost: tl.value,
          otherCost: ot.value,
          computedUnitPrice,
          submittedById: user.id,
          notes: li.notes || body.notes || null,
        },
      });
      createdSheets.push(sheet);
    }
  } else {
    // Legacy single costing mode (no line item association)
    const mc = validateCost(body.material_cost, "Material cost", false);
    const lc = validateCost(body.labour_cost, "Labour cost", false);
    const oh = validateCost(body.overhead_percent, "Overhead percent");
    const mg = validateCost(body.margin_percent, "Margin percent");
    const fr = validateCost(body.freight_cost || 0, "Freight cost");
    const pk = validateCost(body.packaging_cost || 0, "Packaging cost");
    const tl = validateCost(body.tooling_cost || 0, "Tooling cost");
    const ot = validateCost(body.other_cost || 0, "Other cost");

    if (!mc.valid) return NextResponse.json({ success: false, message: mc.message }, { status: 400 });
    if (!lc.valid) return NextResponse.json({ success: false, message: lc.message }, { status: 400 });
    if (!oh.valid) return NextResponse.json({ success: false, message: oh.message }, { status: 400 });
    if (!mg.valid) return NextResponse.json({ success: false, message: mg.message }, { status: 400 });

    const computedUnitPrice = computeUnitPrice(mc.value, lc.value, oh.value, mg.value, fr.value, pk.value, tl.value, ot.value);
    if (computedUnitPrice <= 0) {
      return NextResponse.json({ success: false, message: "Computed unit price must be greater than 0" }, { status: 400 });
    }

    const sheet = await prisma.rFQCostingSheet.create({
      data: {
        rfqId: id,
        rfqLineItemId: null,
        materialCost: mc.value,
        labourCost: lc.value,
        overheadPercent: oh.value,
        marginPercent: mg.value,
        freightCost: fr.value,
        packagingCost: pk.value,
        toolingCost: tl.value,
        otherCost: ot.value,
        computedUnitPrice,
        submittedById: user.id,
        notes: body.notes || null,
      },
    });
    createdSheets.push(sheet);
  }

  // Notify assigned sales executive
  if (rfq.assignedUserId) {
    const latestPrice = createdSheets[createdSheets.length - 1].computedUnitPrice;
    await dispatchNotification({
      userId: rfq.assignedUserId,
      title: "Costing Ready for RFQ",
      message: `Costing is ready for RFQ ${rfq.rfqCode}. ${createdSheets.length} line item(s) costed.`,
      type: "rfq",
      link: `/rfq/${id}`,
    });
  }

  await logAudit(user.id, "RFQ", "SubmitCosting", `Submitted costing for RFQ ${rfq.rfqCode} (${createdSheets.length} sheet(s))`, {
    resourceId: id,
    newState: { sheets: createdSheets.map((s) => ({ lineItemId: s.rfqLineItemId, computedUnitPrice: s.computedUnitPrice })) },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  return NextResponse.json({ success: true, data: createdSheets }, { status: 201 });
}
