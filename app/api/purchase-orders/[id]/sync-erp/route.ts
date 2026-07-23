import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEventAsync } from "@/lib/activity-event";

/**
 * POST /api/purchase-orders/[id]/sync-erp
 *
 * Pushes the purchase order to the configured ERP system.
 * Reads SUKI_ERP_API_URL and SUKI_ERP_API_KEY from environment.
 *
 * The ERP payload is built from the PO + items + customer, sent as JSON
 * to the ERP endpoint with the API key in the Authorization header.
 *
 * On success: stores erpReferenceNumber, sets erpSyncStatus = "Synced",
 *   erpSyncedAt = now, and stores both erpPayload and erpResponse.
 * On failure: sets erpSyncStatus = "Failed", stores error in erpResponse.
 */
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.PURCHASE_ORDERS, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/purchase-orders/[id]/sync-erp");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, email: true, phone: true, city: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true } } } },
    },
  });

  if (!purchaseOrder) return NextResponse.json({ success: false, message: "Purchase order not found" }, { status: 404 });

  // Only allow sync when PO is Approved
  if (purchaseOrder.status !== "Approved") {
    return NextResponse.json(
      { success: false, message: "Purchase order must be in 'Approved' status before syncing to ERP" },
      { status: 400 }
    );
  }

  const erpApiUrl = process.env.SUKI_ERP_API_URL;
  const erpApiKey = process.env.SUKI_ERP_API_KEY;

  if (!erpApiUrl || !erpApiKey) {
    return NextResponse.json(
      { success: false, message: "ERP integration is not configured. Set SUKI_ERP_API_URL and SUKI_ERP_API_KEY in environment." },
      { status: 500 }
    );
  }

  // Build the ERP payload
  const erpPayload = {
    source: "SUKI-CRM",
    poCode: purchaseOrder.poCode,
    poNumber: purchaseOrder.poNumber,
    poDate: purchaseOrder.poDate,
    expectedDelivery: purchaseOrder.expectedDelivery,
    customer: {
      code: purchaseOrder.customer.customerCode,
      name: purchaseOrder.customer.name,
      email: purchaseOrder.customer.email,
      phone: purchaseOrder.customer.phone,
      address: purchaseOrder.shippingAddress || purchaseOrder.customer.city,
      city: purchaseOrder.customer.city,
    },
    contact: purchaseOrder.contact
      ? {
          name: purchaseOrder.contact.name,
          email: purchaseOrder.contact.email,
          phone: purchaseOrder.contact.phone,
        }
      : null,
    lineItems: purchaseOrder.items.map((it) => ({
      productSku: it.product?.productCode || null,
      productName: it.product?.name || it.description,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      unit: it.product?.unit || null,
    })),
    totals: {
      totalAmount: purchaseOrder.totalAmount,
      discountPercent: purchaseOrder.discountPercent,
      finalAmount: purchaseOrder.finalAmount,
    },
    paymentTerms: purchaseOrder.paymentTerms,
    deliveryTerms: purchaseOrder.deliveryTerms,
    shippingAddress: purchaseOrder.shippingAddress,
    billingAddress: purchaseOrder.billingAddress,
    specialInstructions: purchaseOrder.specialInstructions,
    notes: purchaseOrder.notes,
    syncedAt: new Date().toISOString(),
    syncedBy: { id: user.id, email: user.email },
  };

  const payloadJson = JSON.stringify(erpPayload);

  try {
    // Mark as Pending before sending
    await prisma.purchaseOrder.update({
      where: { id },
      data: { erpSyncStatus: "Pending", erpPayload: payloadJson },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const erpResponse = await fetch(`${erpApiUrl}/purchase-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${erpApiKey}`,
        "X-Source": "SUKI-CRM",
      },
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await erpResponse.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    if (erpResponse.ok) {
      // Extract reference number from response (try common field names)
      const erpReferenceNumber =
        responseJson?.referenceNumber ||
        responseJson?.erpReference ||
        responseJson?.poReference ||
        responseJson?.id ||
        responseJson?.documentNumber ||
        null;

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          erpSyncStatus: "Synced",
          erpReferenceNumber,
          erpSyncedAt: new Date(),
          erpResponse: JSON.stringify(responseJson),
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
        },
      });

      await logAudit(user.id, "PurchaseOrder", "ERPSync", `Synced PO ${purchaseOrder.poCode} to ERP${erpReferenceNumber ? ` (ref: ${erpReferenceNumber})` : ""}`, {
        resourceId: id,
        newState: { erpSyncStatus: "Synced", erpReferenceNumber },
        context: extractAuditContext(request),
      });

      await logEventAsync({
        entityType: "PurchaseOrder",
        entityId: id,
        type: "erp_synced",
        actorId: user.id,
        metadata: { poCode: purchaseOrder.poCode, erpReferenceNumber },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: erpReferenceNumber
          ? `Successfully synced to ERP. Reference: ${erpReferenceNumber}`
          : "Successfully synced to ERP.",
      });
    } else {
      // ERP returned an error status
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          erpSyncStatus: "Failed",
          erpResponse: JSON.stringify({ status: erpResponse.status, body: responseJson }),
        },
      });

      await logAudit(user.id, "PurchaseOrder", "ERPSyncFailed", `ERP sync failed for PO ${purchaseOrder.poCode} (HTTP ${erpResponse.status})`, {
        resourceId: id,
        newState: { erpSyncStatus: "Failed" },
        context: extractAuditContext(request),
      });

      await logEventAsync({
        entityType: "PurchaseOrder",
        entityId: id,
        type: "erp_sync_failed",
        actorId: user.id,
        metadata: { poCode: purchaseOrder.poCode, httpStatus: erpResponse.status },
      });

      return NextResponse.json(
        {
          success: false,
          message: `ERP returned status ${erpResponse.status}`,
          error: responseJson,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    // Network error, timeout, or other failure
    const errorMessage = error?.name === "AbortError" ? "ERP request timed out (30s)" : (error?.message || "Unknown error");
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        erpSyncStatus: "Failed",
        erpResponse: JSON.stringify({ error: errorMessage, type: error?.name }),
      },
    });

    await logAudit(user.id, "PurchaseOrder", "ERPSyncFailed", `ERP sync failed for PO ${purchaseOrder.poCode}: ${errorMessage}`, {
      resourceId: id,
      newState: { erpSyncStatus: "Failed" },
      context: extractAuditContext(request),
    });

    await logEventAsync({
      entityType: "PurchaseOrder",
      entityId: id,
      type: "erp_sync_failed",
      actorId: user.id,
      metadata: { poCode: purchaseOrder.poCode, error: errorMessage },
    });

    return NextResponse.json(
      { success: false, message: `ERP sync failed: ${errorMessage}` },
      { status: 502 }
    );
  }
}
