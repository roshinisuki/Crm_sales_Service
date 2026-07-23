import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";
import { logAudit, extractAuditContext } from "@/lib/audit";

// GET: Role-restricted costing sheet view
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/costing-sheet");
  if (guard) return guard;

  const { id } = await params;

  const rfq = await prisma.rFQ.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      costingSheets: {
        include: {
          submittedBy: { select: { id: true, name: true } },
          quantityBreak: true,
        },
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
      rfqLineItemId: cs.rfqLineItemId,
      quantityBreakId: cs.quantityBreakId,
      computedUnitPrice: cs.computedUnitPrice,
      createdAt: cs.createdAt,
      submittedBy: cs.submittedBy,
    }));
    return NextResponse.json({ success: true, data: restricted });
  }
}

// POST: Submit costing sheet(s) (Costing Engineer / Admin only)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/costing-sheet");
  if (guard) return guard;

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
    include: {
      lineItems: {
        include: {
          quantityBreaks: true,
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });
  if (!rfq) return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });

  const computeUnitPrice = (mc: number, lc: number, oh: number, mg: number, fr: number, pk: number, tl: number, ot: number) => {
    return (mc + lc + fr + pk + tl + ot) * (1 + oh / 100) * (1 + mg / 100);
  };

  const validateCost = (val: any, field: string, allowZero: boolean = true): { valid: boolean; message?: string; value: number } => {
    const n = parseFloat(val);
    if (isNaN(n)) return { valid: false, message: `${field} must be a number`, value: 0 };
    if (allowZero ? n < 0 : n <= 0) return { valid: false, message: `${field} must be ${allowZero ? "0 or greater" : "greater than 0"}`, value: 0 };
    return { valid: true, value: n };
  };

  const lineItemsCosting = body.line_items;
  if (!lineItemsCosting || !Array.isArray(lineItemsCosting) || lineItemsCosting.length === 0) {
    return NextResponse.json({ success: false, message: "At least one line item costing entry is required" }, { status: 400 });
  }

  const createdSheets: any[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const li of lineItemsCosting) {
        const lineItem = rfq.lineItems.find((l) => l.id === li.line_item_id);
        if (!lineItem) {
          throw new Error(`Line item ${li.line_item_id} not found in this RFQ`);
        }

        const qb = lineItem.quantityBreaks.find((q) => q.id === li.quantity_break_id);
        if (!qb) {
          throw new Error(`Quantity break ${li.quantity_break_id} not found for line item ${lineItem.itemDescription}`);
        }

        const mc = validateCost(li.material_cost, "Material cost");
        const lc = validateCost(li.labour_cost, "Labour cost");
        const fr = validateCost(li.freight_cost || 0, "Freight cost");
        const pk = validateCost(li.packaging_cost || 0, "Packaging cost");
        const tl = validateCost(li.tooling_cost || 0, "Tooling cost");
        const ot = validateCost(li.other_cost || 0, "Other cost");

        if (!mc.valid) throw new Error(mc.message);
        if (!lc.valid) throw new Error(lc.message);

        // Auto-fill from Product Category defaults if overhead or margin is blank/omitted
        let ohVal = li.overhead_percent !== undefined && li.overhead_percent !== "" ? parseFloat(li.overhead_percent) : null;
        if (ohVal === null || isNaN(ohVal)) {
          ohVal = lineItem.product?.category?.defaultOverheadPercent ? Number(lineItem.product.category.defaultOverheadPercent) : 0;
        }

        let mgVal = li.margin_percent !== undefined && li.margin_percent !== "" ? parseFloat(li.margin_percent) : null;
        if (mgVal === null || isNaN(mgVal)) {
          mgVal = lineItem.product?.category?.defaultMarginPercent ? Number(lineItem.product.category.defaultMarginPercent) : 0;
        }

        const computedUnitPrice = computeUnitPrice(mc.value, lc.value, ohVal, mgVal, fr.value, pk.value, tl.value, ot.value);
        if (computedUnitPrice <= 0) {
          throw new Error("Computed unit price must be greater than 0");
        }

        // Notes scoped per costing sheet
        const sheetNotes = li.notes || undefined;

        const sheet = await tx.rFQCostingSheet.create({
          data: {
            rfqId: id,
            rfqLineItemId: lineItem.id,
            quantityBreakId: qb.id,
            materialCost: mc.value,
            labourCost: lc.value,
            overheadPercent: ohVal,
            marginPercent: mgVal,
            freightCost: fr.value,
            packagingCost: pk.value,
            toolingCost: tl.value,
            otherCost: ot.value,
            computedUnitPrice,
            submittedById: user.id,
            notes: sheetNotes,
          },
        });

        // Update quantity break
        await tx.rFQLineItemQuantityBreak.update({
          where: { id: qb.id },
          data: { computedUnitPrice },
        });

        createdSheets.push(sheet);
      }

      // Sync costingStatus for modified line items
      const lineItemIdsToCheck = Array.from(new Set(lineItemsCosting.map((l) => l.line_item_id)));
      for (const lineItemId of lineItemIdsToCheck) {
        const breaks = await tx.rFQLineItemQuantityBreak.findMany({
          where: { lineItemId },
          include: { costingSheets: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        const totalBreaks = breaks.length;
        const costedBreaks = breaks.filter((b) => b.costingSheets.length > 0).length;

        let status = "Pending";
        if (costedBreaks === totalBreaks) {
          status = "Done";
        } else if (costedBreaks > 0) {
          status = "InProgress";
        }

        await tx.rFQLineItem.update({
          where: { id: lineItemId },
          data: { costingStatus: status },
        });
      }

      // Auto-transition RFQ to CostingCompleted if all items are Done
      const allLineItems = await tx.rFQLineItem.findMany({
        where: { rfqId: id },
        select: { costingStatus: true },
      });

      const allDone = allLineItems.length > 0 && allLineItems.every(li => li.costingStatus === "Done");
      if (allDone && rfq.status === "CostingPending") {
        await tx.rFQ.update({
          where: { id },
          data: { status: "CostingCompleted" },
        });

        await tx.rFQStatusHistory.create({
          data: {
            rfqId: id,
            fromStatus: rfq.status,
            toStatus: "CostingCompleted",
            changedById: user.id,
            notes: "Auto-transitioned: All line items have been costed.",
          },
        });
      }
    });

    // Notify assigned sales executive
    if (rfq.assignedUserId) {
      await dispatchNotification({
        userId: rfq.assignedUserId,
        title: "Costing Ready for RFQ",
        message: `Costing is updated for RFQ ${rfq.rfqCode}. ${createdSheets.length} quantity break(s) costed.`,
        type: "rfq",
        link: `/rfq/${id}`,
      });
    }

    await logAudit(user.id, "RFQ", "SubmitCosting", `Submitted costing for RFQ ${rfq.rfqCode} (${createdSheets.length} sheet(s))`, {
      resourceId: id,
      newState: { sheets: createdSheets.map((s) => ({ lineItemId: s.rfqLineItemId, quantityBreakId: s.quantityBreakId, computedUnitPrice: s.computedUnitPrice })) },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: createdSheets }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}

// PUT: Update an existing costing sheet (Costing Engineer / Admin only)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/[id]/costing-sheet");
  if (guard) return guard;

  if (!["CostingEngineer", "Admin"].includes(user.role || "")) {
    return NextResponse.json(
      { success: false, message: "Only Costing Engineers and Admins can edit costing sheets" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const { sheetId, material_cost, labour_cost, overhead_percent, margin_percent, freight_cost, packaging_cost, tooling_cost, other_cost, notes } = body;

  if (!sheetId) {
    return NextResponse.json({ success: false, message: "sheetId is required" }, { status: 400 });
  }

  const existing = await prisma.rFQCostingSheet.findFirst({
    where: { id: sheetId, rfqId: id },
    include: { rfqLineItem: { include: { product: { include: { category: true } } } } },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Costing sheet not found" }, { status: 404 });

  const mc = parseFloat(material_cost);
  const lc = parseFloat(labour_cost);
  if (isNaN(mc) || mc < 0) return NextResponse.json({ success: false, message: "Material cost must be 0 or greater" }, { status: 400 });
  if (isNaN(lc) || lc < 0) return NextResponse.json({ success: false, message: "Labour cost must be 0 or greater" }, { status: 400 });

  const fr = parseFloat(freight_cost) || 0;
  const pk = parseFloat(packaging_cost) || 0;
  const tl = parseFloat(tooling_cost) || 0;
  const ot = parseFloat(other_cost) || 0;

  let ohVal = overhead_percent !== undefined && overhead_percent !== "" ? parseFloat(overhead_percent) : null;
  if (ohVal === null || isNaN(ohVal)) {
    ohVal = existing.rfqLineItem.product?.category?.defaultOverheadPercent ? Number(existing.rfqLineItem.product.category.defaultOverheadPercent) : 0;
  }

  let mgVal = margin_percent !== undefined && margin_percent !== "" ? parseFloat(margin_percent) : null;
  if (mgVal === null || isNaN(mgVal)) {
    mgVal = existing.rfqLineItem.product?.category?.defaultMarginPercent ? Number(existing.rfqLineItem.product.category.defaultMarginPercent) : 0;
  }

  const computedUnitPrice = (mc + lc + fr + pk + tl + ot) * (1 + ohVal / 100) * (1 + mgVal / 100);
  if (computedUnitPrice <= 0) {
    return NextResponse.json({ success: false, message: "Computed unit price must be greater than 0" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sheet = await tx.rFQCostingSheet.update({
        where: { id: sheetId },
        data: {
          materialCost: mc,
          labourCost: lc,
          overheadPercent: ohVal,
          marginPercent: mgVal,
          freightCost: fr,
          packagingCost: pk,
          toolingCost: tl,
          otherCost: ot,
          computedUnitPrice,
          notes: notes || undefined,
        },
      });

      if (existing.quantityBreakId) {
        await tx.rFQLineItemQuantityBreak.update({
          where: { id: existing.quantityBreakId },
          data: { computedUnitPrice },
        });
      }

      return sheet;
    });

    await logAudit(user.id, "RFQ", "UpdateCosting", `Updated costing sheet ${sheetId} for RFQ ${id}`, {
      resourceId: id,
      newState: { sheetId, computedUnitPrice },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
