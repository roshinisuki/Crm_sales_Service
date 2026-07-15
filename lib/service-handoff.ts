/**
 * Sales CRM → Service CRM Handoff
 *
 * Single trigger point: when a Purchase Order's status becomes "Approved",
 * this helper creates/updates CustomerAsset records in Service CRM for each
 * PO line item — bridging the two sides without duplicating Customer data.
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Create or update CustomerAsset records for every line item on an approved PO.
 *
 * Called from:
 *   - PUT /api/purchase-orders/[id]  (direct Admin/SalesManager approve)
 *   - PATCH /api/approvals/[id]      (Approval Center PO approval)
 *
 * Idempotent: if a CustomerAsset already exists for the same PO + product,
 * it updates purchaseDate/warranty fields rather than creating a duplicate.
 */
export async function createCustomerAssetsFromPO(
  purchaseOrderId: string,
  actorUserId: string,
): Promise<{ created: number; updated: number }> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      items: true,
      customer: { select: { id: true, name: true } },
      deal: { select: { id: true, projects: { where: { status: "Active" }, orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });

  if (!po) {
    throw new Error(`PO ${purchaseOrderId} not found — cannot create CustomerAssets`);
  }

  if (po.status !== "Approved") {
    return { created: 0, updated: 0 };
  }

  const purchaseDate = po.approvedAt ?? po.poDate ?? new Date();
  const projectId = po.deal?.projects?.[0]?.id ?? null;
  let created = 0;
  let updated = 0;

  for (const item of po.items) {
    // Skip items without a linked product — we need a productName at minimum
    const productName = item.description || "Unknown Product";
    const productId = item.productId;

    // Generate a unique serial number placeholder: PO-XXXX-ITEM-N
    // Real serial number is assigned later during Installation.
    const serialPlaceholder = `${po.poCode}-ITEM-${po.items.indexOf(item) + 1}`;

    // Check if an asset already exists for this PO + product combination
    const existing = await prisma.customerAsset.findFirst({
      where: {
        purchaseOrderId: po.id,
        productId: productId ?? undefined,
      },
    });

    if (existing) {
      await prisma.customerAsset.update({
        where: { id: existing.id },
        data: {
          productName,
          purchaseDate,
          dealId: po.dealId || existing.dealId,
          ...(projectId ? { projectId } : {}),
        },
      });
      updated++;
    } else {
      const warrantyExpiryDate = new Date(purchaseDate.getTime());
      warrantyExpiryDate.setMonth(warrantyExpiryDate.getMonth() + 12);

      await prisma.customerAsset.create({
        data: {
          customerId: po.customerId,
          serialNumber: serialPlaceholder,
          productName,
          purchaseDate,
          warrantyExpiryDate, // Default to 12 months warranty
          amcExpiryDate: null, // Set when AMC is purchased
          status: "Active",
          purchaseOrderId: po.id,
          productId: productId || null,
          dealId: po.dealId || null,
          ...(projectId ? { projectId } : {}),
        },
      });
      created++;
    }
  }

  await logAudit(
    actorUserId,
    "CustomerAsset",
    "Create",
    `Auto-created ${created} customer asset(s) from approved PO ${po.poCode} (${po.customer?.name})`,
    {
      newState: { purchaseOrderId: po.id, poCode: po.poCode, created, updated },
      severity: "INFO",
    },
  );

  return { created, updated };
}
