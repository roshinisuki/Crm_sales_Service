import { prisma } from "@/lib/prisma";

export async function createOrHealRFQ(
  dealId: string,
  dealWithDetails: any,
  companyId: string,
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
) {
  let existingRfq = await tx.rFQ.findFirst({
    where: { opportunityId: dealId },
    include: { lineItems: true }
  });

  const allItems = dealWithDetails.requirementItems || [];

  // Function to map an item and auto-link product if exactly 1 match is found
  const mapLineItem = async (item: any, idx: number) => {
    const feasibility = item.technicalNote?.feasibility;
    const needsFeasibilityReview = !item.technicalNote || !["Feasible", "FeasibleWithChanges"].includes(feasibility);

    // Auto-link Product ID if an exact match exists
    let productId = null;
    if (item.productName) {
      const matches = await tx.product.findMany({
        where: { 
          OR: [
            { productCode: item.productName }, 
            { name: item.productName }
          ], 
          companyId 
        }
      });
      if (matches.length === 1) {
        productId = matches[0].id;
      }
    }

    return {
      itemDescription: item.productName,
      productId,
      sourceRequirementItemId: item.id,
      quantity: item.estimatedQuantity,
      targetPrice: item.targetPriceMax ? Number(item.targetPriceMax) : (item.targetPriceMin ? Number(item.targetPriceMin) : null),
      requestedDeliveryDate: item.requiredDelivery || null,
      specifications: item.technicalNote?.confirmedSpec || item.specNotes || null,
      notes: item.technicalNote?.toolingRequired ? `Tooling: ${item.technicalNote.toolingRequired}` : null,
      displayOrder: idx,
      needsFeasibilityReview,
      quantityBreaks: { create: [{ quantity: item.estimatedQuantity || 1 }] },
    };
  };

  if (existingRfq) {
    if (existingRfq.lineItems.length === 0 && allItems.length > 0) {
      const lineItemsToCreate = await Promise.all(allItems.map((item: any, idx: number) => mapLineItem(item, idx)));
      await tx.rFQ.update({
        where: { id: existingRfq.id },
        data: { lineItems: { create: lineItemsToCreate } },
      });
    }
    return existingRfq.id;
  }

  const year = new Date().getFullYear();
  const rfqPrefix = `RFQ-${year}-`;
  const rfqCount = await tx.rFQ.count({ where: { rfqCode: { startsWith: rfqPrefix }, companyId } });
  const rfqCode = `${rfqPrefix}${String(rfqCount + 1).padStart(5, "0")}`;

  const lineItemsToCreate = await Promise.all(allItems.map((item: any, idx: number) => mapLineItem(item, idx)));

  const newRfq = await tx.rFQ.create({
    data: {
      rfqCode,
      customerId: dealWithDetails.customerId,
      opportunityId: dealId,
      status: "New",
      receivedDate: new Date(),
      priority: "Normal",
      companyId,
      lineItems: { create: lineItemsToCreate },
    },
    select: { id: true }
  });

  return newRfq.id;
}
