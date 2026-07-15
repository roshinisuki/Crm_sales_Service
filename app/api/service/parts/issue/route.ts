import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordPartMovement } from "@/lib/spare-parts-inventory";

// POST — Issue parts to an engineer (creates "Issued" PartMovement rows)
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { engineerId, items, notes } = body as {
    engineerId: string;
    items: { sparePartId: string; quantity: number }[];
    notes?: string;
  };

  if (!engineerId) {
    return NextResponse.json({ success: false, message: "engineerId is required" }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, message: "At least one part item is required" }, { status: 400 });
  }

  // Verify engineer exists
  const engineer = await prisma.serviceEngineer.findUnique({ where: { id: engineerId } });
  if (!engineer) {
    return NextResponse.json({ success: false, message: "Engineer not found" }, { status: 404 });
  }

  const created = [];
  for (const item of items) {
    if (!item.sparePartId || !item.quantity || item.quantity < 1) continue;
    const part = await prisma.sparePart.findUnique({ where: { id: item.sparePartId } });
    if (!part) continue;

    const movement = await recordPartMovement({
      sparePartId: item.sparePartId,
      type: "Issued",
      quantity: item.quantity,
      engineerId,
      notes: notes || null,
      createdById: user.id,
    });
    created.push(movement);
  }

  await logAudit(user.id, "SparePart", "Issue", `Issued ${created.length} part(s) to engineer ${engineer.userId}`);

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
