import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

// POST /api/rfq/customer-submit
// Customer-facing endpoint: allows customers to submit RFQs directly
// Restricted fields — customer can only set requirement details, line items, and due date
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  // Only Customer role can use this endpoint
  if (user.role !== "Customer") {
    return NextResponse.json({ success: false, message: "This endpoint is for customer submissions only" }, { status: 403 });
  }

  const body = await request.json();

  // Validate line items
  if (!body.line_items || !Array.isArray(body.line_items) || body.line_items.length === 0) {
    return NextResponse.json({ success: false, message: "At least one line item is required" }, { status: 400 });
  }

  for (const li of body.line_items) {
    if (!li.item_description || !li.item_description.trim()) {
      return NextResponse.json({ success: false, message: "Each line item must have a description" }, { status: 400 });
    }
  }

  // Find the customer record linked to this user
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { email: user.email },
        { assignedUserId: user.id },
      ],
      deletedAt: null,
    },
    select: { id: true, name: true, customerCode: true, assignedUserId: true },
  });

  if (!customer) {
    return NextResponse.json({ success: false, message: "No customer profile linked to your account" }, { status: 404 });
  }

  // Generate RFQ code: RFQ-YYYY-NNNNN
  const year = new Date().getFullYear();
  const yearCount = await prisma.rFQ.count({
    where: { companyId: user.companyId, rfqCode: { startsWith: `RFQ-${year}-` } },
  });
  const rfqCode = `RFQ-${year}-${String(yearCount + 1).padStart(5, "0")}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create RFQ — customer can only set: requirementDetails, customerDueDate, line items
      const rfq = await tx.rFQ.create({
        data: {
          rfqCode,
          customerId: customer.id,
          contactId: body.contact_id || null,
          status: "New",
          receivedDate: new Date(),
          customerDueDate: body.customer_due_date ? new Date(body.customer_due_date) : null,
          requirementDetails: body.requirement_details || null,
          notes: body.notes || null,
          priority: "Normal",
          assignedUserId: customer.assignedUserId || null,
          companyId: user.companyId,
          rfqStatusHistories: {
            create: {
              fromStatus: null,
              toStatus: "New",
              notes: "RFQ submitted by customer",
            },
          },
        },
      });

      // Create line items
      for (let i = 0; i < body.line_items.length; i++) {
        const li = body.line_items[i];
        await tx.rFQLineItem.create({
          data: {
            rfqId: rfq.id,
            itemDescription: li.item_description,
            productId: li.product_id || null,
            quantity: parseFloat(li.quantity) || 1,
            unit: li.unit || null,
            targetPrice: li.target_price ? parseFloat(li.target_price) : null,
            requestedDeliveryDate: li.delivery_date ? new Date(li.delivery_date) : null,
            specifications: li.specifications || null,
            displayOrder: i,
            quantityBreaks: {
              create: [{ quantity: parseFloat(li.quantity) || 1 }],
            },
          },
        });
      }

      return rfq;
    });

    // Notify assigned sales user
    if (customer.assignedUserId) {
      await dispatchNotification({
        userId: customer.assignedUserId,
        title: "New Customer RFQ Submitted",
        message: `Customer ${customer.name} submitted RFQ ${result.rfqCode}`,
        type: "rfq",
        link: `/rfq/${result.id}`,
      });
    }

    await logAudit(user.id, "RFQ", "CustomerSubmit", `Customer submitted RFQ ${result.rfqCode}`, {
      resourceId: result.id,
      newState: { customerId: customer.id, lineItemCount: body.line_items.length },
      context: extractAuditContext(request),
      severity: "INFO",
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to submit RFQ: ${error.message}` },
      { status: 500 }
    );
  }
}
