import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/opportunities/[id]/quotations
// Returns all quotations linked to this opportunity (newest first)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  // SuperAdmin must use support/impersonation mode
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, assignedUserId: true },
  });

  if (!deal) return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });

  if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const quotations = await prisma.quotation.findMany({
    where: { dealId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quotationCode: true,
      status: true,
      finalAmount: true,
      totalAmount: true,
      discountPercent: true,
      overallMarginPercent: true,
      validUntil: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: quotations });
}
