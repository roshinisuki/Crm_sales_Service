import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "GET /api/rfq");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const assignedUserId = searchParams.get("assignedUserId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 50;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  // Row-level security for Sales Executives
  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const [rfqs, total] = await Promise.all([
    prisma.rFQ.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        contact: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
        costingOwner: { select: { id: true, name: true } },
        _count: { select: { lineItems: true, costingSheets: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rFQ.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rfqs, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "POST /api/rfq");
  if (guard) return guard;

  const body = await request.json();

  let customerId = body.customerId;
  const opportunityId = body.opportunity_id || null;
  let linkedLineItems: any[] = [];

  // Fetch opportunity data to pre-populate customer and line items if opportunityId is present
  if (opportunityId) {
    const deal = await prisma.deal.findFirst({
      where: { id: opportunityId, companyId: user.companyId },
      include: {
        requirementItems: {
          include: { technicalNote: true },
        },
      },
    });

    if (deal) {
      customerId = deal.customerId;
      linkedLineItems = deal.requirementItems.map((item) => {
        const confirmed = item.technicalNote?.confirmedSpec || "";
        const tooling = item.technicalNote?.toolingRequired || "";
        let specs = item.specNotes || "";
        if (confirmed) {
          specs = `Confirmed Specs: ${confirmed}${tooling ? `. Tooling: ${tooling}` : ""}. Original notes: ${specs}`;
        }
        if (item.attachmentUrl) {
          specs = `Drawing/Document URL: ${item.attachmentUrl}\n${specs}`;
        }
        return {
          item_description: item.productName,
          quantity: item.estimatedQuantity,
          target_price: item.targetPriceMax ? Number(item.targetPriceMax) : (item.targetPriceMin ? Number(item.targetPriceMin) : null),
          specifications: specs,
          notes: item.specNotes || null,
          unit: "Pcs",
        };
      });
    }
  }

  // Validation: required fields
  if (!customerId) {
    return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  }

  const receivedDate = body.receivedDate ? new Date(body.receivedDate) : new Date();
  const customerDueDate = body.customerDueDate ? new Date(body.customerDueDate) : null;

  // Validate: rfq_received_date <= customer_due_date
  if (customerDueDate && receivedDate > customerDueDate) {
    return NextResponse.json(
      { success: false, message: "Received date cannot be after customer due date" },
      { status: 400 }
    );
  }

  // Auto-set priority: DATEDIFF(customer_due_date, rfq_received_date) <= 3 → Urgent
  let priority = body.priority || "Normal";
  if (customerDueDate) {
    const diffDays = Math.ceil((customerDueDate.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) priority = "Urgent";
  }

  const year = new Date().getFullYear();

  // Validate line items if provided and not linking opportunity
  const lineItems = body.line_items || [];
  const finalItems = linkedLineItems.length > 0 ? linkedLineItems : lineItems;

  if (finalItems.length === 0) {
    return NextResponse.json({ success: false, message: "At least one line item is required to create an RFQ" }, { status: 400 });
  }

  for (const item of finalItems) {
    if (!item.item_description || !item.item_description.trim()) {
      return NextResponse.json(
        { success: false, message: "Each line item must have a description" },
        { status: 400 }
      );
    }
  }

  // Create RFQ with line items and status history in a transaction
  const rfq = await prisma.$transaction(async (tx) => {
    const yearCount = await tx.rFQ.count({
      where: {
        companyId: user.companyId,
        rfqCode: { startsWith: `RFQ-${year}-` },
      },
    });
    const rfqCode = `RFQ-${year}-${String(yearCount + 1).padStart(5, "0")}`;

    const created = await tx.rFQ.create({
      data: {
        rfqCode,
        customerId,
        contactId: body.contactId || null,
        productId: body.productId || null,
        quantity: body.quantity ? parseFloat(body.quantity) : null,
        targetPrice: body.targetPrice ? parseFloat(body.targetPrice) : null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        receivedDate,
        customerDueDate,
        priority,
        requirementDetails: body.requirementDetails || null,
        assignedUserId: body.assignedUserId || user.id,
        notes: body.notes || null,
        opportunityId: opportunityId,
        templateFileName: body.templateFileName || null,
        templateFileUrl: body.templateFileUrl || null,
        templateParsedAt: body.templateFileName ? new Date() : null,
        status: "New",
        companyId: user.companyId,
      },
    });

    // Insert line items and their default quantity breaks
    for (let idx = 0; idx < finalItems.length; idx++) {
      const item = finalItems[idx];

      // Scan catalogue for product name match to pre-fill productId
      let resolvedProductId = item.product_id || null;
      if (!resolvedProductId && item.item_description) {
        const matchedProd = await tx.product.findFirst({
          where: {
            name: { equals: item.item_description },
            companyId: user.companyId,
          },
        });
        if (matchedProd) resolvedProductId = matchedProd.id;
      }

      const createdItem = await tx.rFQLineItem.create({
        data: {
          rfqId: created.id,
          itemDescription: item.item_description,
          productId: resolvedProductId,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit || "Pcs",
          targetPrice: item.target_price ? parseFloat(item.target_price) : null,
          requestedDeliveryDate: item.delivery_date ? new Date(item.delivery_date) : null,
          specifications: item.specifications || null,
          notes: item.notes || null,
          displayOrder: idx,
          costingStatus: "Pending",
        },
      });

      // Insert default quantity break tier
      await tx.rFQLineItemQuantityBreak.create({
        data: {
          lineItemId: createdItem.id,
          quantity: parseFloat(item.quantity) || 1,
          computedUnitPrice: 0,
        },
      });
    }

    // Insert initial status history
    await tx.rFQStatusHistory.create({
      data: {
        rfqId: created.id,
        fromStatus: null,
        toStatus: "New",
        changedById: user.id,
        notes: "RFQ created",
      },
    });

    // If opportunity_id provided, update opportunity stage to 'RequirementGathering'
    if (opportunityId) {
      const opp = await tx.deal.findUnique({ where: { id: opportunityId } });
      if (opp && opp.status !== "RequirementGathering" && opp.status !== "ProposalSent" && opp.status !== "Negotiation" && opp.status !== "Won" && opp.status !== "Lost") {
        await tx.deal.update({
          where: { id: opportunityId },
          data: { status: "RequirementGathering" },
        });
      }
    }

    return created;
  });

  // Notify assigned user
  if (body.assignedUserId && body.assignedUserId !== user.id) {
    await dispatchNotification({
      userId: body.assignedUserId,
      title: "New RFQ Assigned",
      message: `RFQ ${rfq.rfqCode} has been assigned to you.${priority === "Urgent" ? " — URGENT" : ""}`,
      type: "rfq",
      link: `/rfq/${rfq.id}`,
    });
  }

  // If Urgent: notify assigned user's manager + costing team
  if (priority === "Urgent") {
    const costingTeam = await prisma.user.findMany({
      where: { role: "CostingEngineer", deletedAt: null, companyId: user.companyId },
      select: { id: true },
    });
    const managers = await prisma.user.findMany({
      where: { role: "SalesManager", deletedAt: null, companyId: user.companyId },
      select: { id: true },
    });
    const notifyIds = [...costingTeam.map((u) => u.id), ...managers.map((u) => u.id)];
    if (notifyIds.length > 0) {
      await dispatchNotificationsToMany({
        userIds: notifyIds,
        title: "URGENT RFQ Received",
        message: `URGENT RFQ ${rfq.rfqCode} received — customer due date is within 3 days.`,
        type: "rfq",
        link: `/rfq/${rfq.id}`,
      });
    }
  }

  await logAudit(user.id, "RFQ", "Create", `Created RFQ ${rfq.rfqCode} (Priority: ${priority})`, {
    resourceId: rfq.id,
    newState: { rfqCode: rfq.rfqCode, priority, status: "New", customerId },
    context: extractAuditContext(request),
    severity: "INFO",
  });

  // Fetch the full RFQ with relations for response
  const fullRfq = await prisma.rFQ.findUnique({
    where: { id: rfq.id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
      lineItems: {
        include: {
          quantityBreaks: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: fullRfq }, { status: 201 });
}
