import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getPartLedger } from "@/lib/spare-parts-inventory";

// GET — List all spare parts with current stock, or get a single part's ledger
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const partId = searchParams.get("partId");
  const engineerId = searchParams.get("engineerId");
  const search = searchParams.get("search");
  const lowStockOnly = searchParams.get("lowStock") === "true";

  // If partId is provided, return the full ledger for that part
  if (partId) {
    const part = await prisma.sparePart.findUnique({
      where: { id: partId },
      include: {
        partMovements: {
          include: {
            engineer: { include: { user: { select: { name: true } } } },
            serviceVisit: { select: { id: true, title: true } },
            customerAsset: { select: { id: true, productName: true, serialNumber: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!part) return NextResponse.json({ success: false, message: "Part not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: part });
  }

  // If engineerId is provided, return that engineer's current holdings
  if (engineerId) {
    const movements = await prisma.partMovement.findMany({
      where: { engineerId, type: { in: ["Issued", "Used", "Returned"] } },
      include: { sparePart: true },
    });

    const holdingsMap = new Map<string, { sparePart: any; issued: number; used: number; returned: number; holding: number }>();
    for (const m of movements) {
      if (!m.sparePart) continue;
      const key = m.sparePartId;
      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, { sparePart: m.sparePart, issued: 0, used: 0, returned: 0, holding: 0 });
      }
      const h = holdingsMap.get(key)!;
      if (m.type === "Issued") h.issued += m.quantity;
      else if (m.type === "Used") h.used += m.quantity;
      else if (m.type === "Returned") h.returned += m.quantity;
    }
    for (const h of holdingsMap.values()) {
      h.holding = h.issued - h.used - h.returned;
    }
    return NextResponse.json({
      success: true,
      data: Array.from(holdingsMap.values()).filter((h) => h.holding > 0),
    });
  }

  // Otherwise, list all spare parts
  const where: any = {};
  if (search) {
    where.OR = [
      { partCode: { contains: search, mode: "insensitive" } },
      { partName: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }
  if (lowStockOnly) {
    where.currentStock = { lte: 5 };
  }

  const parts = await prisma.sparePart.findMany({
    where,
    orderBy: { partName: "asc" },
  });

  return NextResponse.json({ success: true, data: parts });
}

// POST — Stock adjustment (initial stock, restock) or mark damaged
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { sparePartId, action, quantity, notes } = body;

  if (!sparePartId || !action) {
    return NextResponse.json({ success: false, message: "sparePartId and action are required" }, { status: 400 });
  }

  const part = await prisma.sparePart.findUnique({ where: { id: sparePartId } });
  if (!part) return NextResponse.json({ success: false, message: "Part not found" }, { status: 404 });

  if (action === "restock") {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json({ success: false, message: "Quantity must be a positive number" }, { status: 400 });
    }
    const movement = await prisma.partMovement.create({
      data: {
        sparePartId,
        type: "Returned",
        quantity: qty,
        notes: notes || "Manual stock adjustment / restock",
        createdById: user.id,
      },
    });
    await prisma.sparePart.update({
      where: { id: sparePartId },
      data: { currentStock: { increment: qty } },
    });
    await logAudit(user.id, "SparePart", "Restock", `Restocked ${qty} units of ${part.partName} (${part.partCode})`);
    return NextResponse.json({ success: true, data: movement });
  }

  if (action === "damaged") {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json({ success: false, message: "Quantity must be a positive number" }, { status: 400 });
    }
    const movement = await prisma.partMovement.create({
      data: {
        sparePartId,
        type: "Damaged",
        quantity: qty,
        notes: notes || "Marked as damaged",
        createdById: user.id,
      },
    });
    await logAudit(user.id, "SparePart", "Damaged", `Marked ${qty} units of ${part.partName} (${part.partCode}) as damaged`);
    return NextResponse.json({ success: true, data: movement });
  }

  return NextResponse.json({ success: false, message: "Invalid action. Use 'restock' or 'damaged'." }, { status: 400 });
}
