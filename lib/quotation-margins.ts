/**
 * Shared margin-calculation helpers for Quotation line items.
 *
 * Used by both `generate-quotation` and the `PUT /api/quotations/[id]` edit route
 * so the two paths can never drift out of sync.
 */

/**
 * Per-item margin percentage.
 * Returns null when there is no cost basis (standalone manual pricing).
 */
export function computeItemMarginPercent(
  unitPrice: number,
  costBasisUnitPrice: number | null
): number | null {
  if (costBasisUnitPrice == null || costBasisUnitPrice <= 0) return null;
  if (unitPrice <= 0) return 0;
  return ((unitPrice - costBasisUnitPrice) / unitPrice) * 100;
}

/**
 * Weighted-average margin across all line items that have a cost basis.
 * Returns null when no item has a cost basis (entirely standalone quotation).
 */
export function computeOverallMarginPercent(
  items: Array<{ quantity: number; unitPrice: number; costBasisUnitPrice: number | null }>
): number | null {
  let totalRevenueForMargin = 0;
  let totalMarginRevenue = 0;

  for (const item of items) {
    if (item.costBasisUnitPrice != null && item.costBasisUnitPrice > 0) {
      totalRevenueForMargin += item.quantity * item.unitPrice;
      totalMarginRevenue += item.quantity * (item.unitPrice - item.costBasisUnitPrice);
    }
  }

  return totalRevenueForMargin > 0 ? (totalMarginRevenue / totalRevenueForMargin) * 100 : null;
}

/**
 * Apply a discount to a quotation: updates header fields, recalculates each line item
 * proportionally, and recomputes tax so everything stays consistent.
 *
 * Used by:
 * - Negotiation revision auto-approve path (revisions/route.ts)
 * - Negotiation revision approval-resolution path (approvals/[id]/route.ts)
 * - Start Negotiation initial revision (quotations/[id]/negotiate/route.ts)
 *
 * Returns the updated header values so the caller can persist them.
 */
export function applyDiscountToQuotationItems(
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxPercent: number;
    discountPercent: number;
  }>,
  headerTotalAmount: number,
  discountPercent: number
): {
  items: Array<{ id: string; unitPrice: number; totalPrice: number; lineTotal: number; discountPercent: number }>;
  finalAmount: number;
  taxAmount: number;
  subtotal: number;
} {
  const finalAmount = headerTotalAmount * (1 - discountPercent / 100);
  const ratio = headerTotalAmount > 0 ? finalAmount / headerTotalAmount : 1;

  const updatedItems = items.map((item) => {
    const newUnitPrice = item.unitPrice * ratio;
    const newTotalPrice = item.totalPrice * ratio;
    const newLineTotal = newTotalPrice * (1 + item.taxPercent / 100);
    return {
      id: item.id,
      unitPrice: Math.round(newUnitPrice * 100) / 100,
      totalPrice: Math.round(newTotalPrice * 100) / 100,
      lineTotal: Math.round(newLineTotal * 100) / 100,
      discountPercent,
    };
  });

  const subtotal = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const taxAmount = updatedItems.reduce(
    (sum, i) => sum + (i.totalPrice * (items.find((x) => x.id === i.id)?.taxPercent || 0)) / 100,
    0
  );

  return {
    items: updatedItems,
    finalAmount: Math.round(finalAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
  };
}
