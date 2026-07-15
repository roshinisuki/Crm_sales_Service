import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordPartMovement } from "@/lib/spare-parts-inventory";

// POST — Return unused parts from an engineer (creates "Returned" PartMovement rows)
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { engineerId, serviceVisitId, items, notes } = body as {
    engineerId?: string;
    serviceVisitId?: string;
    items: { sparePartId: string; quantity: number }[];
    notes?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, message: "At least one part item is required" }, { status: 400 });
  }

  const created = [];
  for (const item of items) {
    if (!item.sparePartId || !item.quantity || item.quantity < 1) continue;
    const part = await prisma.sparePart.findUnique({ where: { id: item.sparePartId } });
    if (!part) continue;

    const movement = await recordPartMovement({
      sparePartId: item.sparePartId,
      type: "Returned",
      quantity: item.quantity,
      engineerId: engineerId || null,
      serviceVisitId: serviceVisitId || null,
      notes: notes || null,
      createdById: user.id,
    });
    created.push(movement);
  }

  await logAudit(user.id, "SparePart", "Return", `Returned ${created.length} part(s) to inventory`);

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
