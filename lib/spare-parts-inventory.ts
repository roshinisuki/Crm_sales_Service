import { prisma } from "@/lib/prisma";

/**
 * Returns the current holding of each spare part for a given engineer.
 * Holding = sum of "Issued" quantities minus sum of ("Used" + "Returned") quantities
 * for that engineer. "Damaged" does not affect holding (part was already deducted at "Used").
 */
export async function getEngineerHolding(engineerId: string) {
  const movements = await prisma.partMovement.findMany({
    where: {
      engineerId,
      type: { in: ["Issued", "Used", "Returned", "Damaged"] },
    },
    include: {
      sparePart: { select: { id: true, partCode: true, partName: true, unit: true, unitCost: true } },
    },
  });

  const holdingsMap = new Map<string, {
    sparePartId: string;
    partCode: string;
    partName: string;
    unit: string | null;
    unitCost: number;
    issuedQty: number;
    usedQty: number;
    returnedQty: number;
    damagedQty: number;
    holdingQty: number;
  }>();

  for (const m of movements) {
    if (!m.sparePart) continue;
    const key = m.sparePartId;
    if (!holdingsMap.has(key)) {
      holdingsMap.set(key, {
        sparePartId: m.sparePartId,
        partCode: m.sparePart.partCode,
        partName: m.sparePart.partName,
        unit: m.sparePart.unit,
        unitCost: m.sparePart.unitCost,
        issuedQty: 0,
        usedQty: 0,
        returnedQty: 0,
        damagedQty: 0,
        holdingQty: 0,
      });
    }
    const h = holdingsMap.get(key)!;
    if (m.type === "Issued") h.issuedQty += m.quantity;
    else if (m.type === "Used") h.usedQty += m.quantity;
    else if (m.type === "Returned") h.returnedQty += m.quantity;
    else if (m.type === "Damaged") h.damagedQty += m.quantity;
  }

  for (const h of holdingsMap.values()) {
    h.holdingQty = h.issuedQty - h.usedQty - h.returnedQty;
  }

  return Array.from(holdingsMap.values()).filter((h) => h.holdingQty > 0);
}

/**
 * Returns the full movement history for a given spare part (the ledger).
 */
export async function getPartLedger(sparePartId: string) {
  return prisma.partMovement.findMany({
    where: { sparePartId },
    include: {
      engineer: { include: { user: { select: { name: true } } } },
      serviceVisit: { select: { id: true, title: true } },
      customerAsset: { select: { id: true, productName: true, serialNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Creates a PartMovement and updates SparePart.currentStock accordingly.
 * Stock changes:
 *   "Issued"   → no change (relocation, still company-owned)
 *   "Used"     → currentStock -= quantity
 *   "Returned" → currentStock += quantity
 *   "Damaged"  → no change (already deducted at "Used")
 */
export async function recordPartMovement(params: {
  sparePartId: string;
  type: "Issued" | "Used" | "Returned" | "Damaged";
  quantity: number;
  engineerId?: string | null;
  serviceVisitId?: string | null;
  customerAssetId?: string | null;
  notes?: string | null;
  createdById: string;
}) {
  const { sparePartId, type, quantity, engineerId, serviceVisitId, customerAssetId, notes, createdById } = params;

  const movement = await prisma.partMovement.create({
    data: {
      sparePartId,
      type,
      quantity,
      engineerId: engineerId || null,
      serviceVisitId: serviceVisitId || null,
      customerAssetId: customerAssetId || null,
      notes: notes || null,
      createdById,
    },
  });

  if (type === "Used") {
    await prisma.sparePart.update({
      where: { id: sparePartId },
      data: { currentStock: { decrement: quantity } },
    });
  } else if (type === "Returned") {
    await prisma.sparePart.update({
      where: { id: sparePartId },
      data: { currentStock: { increment: quantity } },
    });
  }

  return movement;
}
