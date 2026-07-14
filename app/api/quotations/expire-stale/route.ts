import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logEventAsync } from "@/lib/activity-event";

/**
 * POST /api/quotations/expire-stale
 *
 * Marks all Sent quotations whose validUntil date has passed as Expired.
 * Intended to be called by a cron job or scheduled task.
 *
 * Also accessible manually by Admin/SalesManager.
 */
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role && !["Admin", "SalesManager"].includes(user.role)) {
    // Allow cron-style calls with API key header in the future
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }
  }

  const now = new Date();

  // Find all Sent quotations whose validUntil has passed
  const staleQuotations = await prisma.quotation.findMany({
    where: {
      deletedAt: null,
      status: "Sent",
      validUntil: { lt: now },
    },
    select: { id: true, quotationCode: true, validUntil: true, createdById: true },
  });

  let expiredCount = 0;
  for (const quote of staleQuotations) {
    await prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: "Expired" },
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: quote.id,
          fromStatus: "Sent",
          toStatus: "Expired",
          changedById: user.id,
          notes: "Auto-expired: validUntil date has passed",
        },
      });

      await logEventAsync({
        entityType: "Quotation",
        entityId: quote.id,
        type: "quotation_expired",
        fromStatus: "Sent",
        toStatus: "Expired",
        metadata: { quotationCode: quote.quotationCode, validUntil: quote.validUntil },
      });
    });
    expiredCount++;
  }

  return NextResponse.json({
    success: true,
    message: `Expired ${expiredCount} quotation(s)`,
    data: { expiredCount, expiredQuotations: staleQuotations.map((q) => q.quotationCode) },
  });
}
