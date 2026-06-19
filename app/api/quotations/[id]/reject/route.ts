import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Sent", "UnderReview"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Sent or UnderReview quotations can be rejected" }, { status: 400 });
  }

  if (!body.rejectionReason) {
    return NextResponse.json({ success: false, message: "Rejection reason is required" }, { status: 400 });
  }

  const quotation = await prisma.quotation.update({
    where: { id },
    data: {
      status: "Rejected",
      rejectedAt: new Date(),
      rejectionReason: body.rejectionReason,
    },
  });

  return NextResponse.json({ success: true, data: quotation });
}
