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
