import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { transitionDealStatus } from "@/lib/dealService";

/**
 * GET /api/cron/proposals
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily sweep that:
 *  1. Finds all non-deleted proposals with validUntil < now AND status "Sent" or "Draft"
 *  2. Marks them Expired
 *  3. For each expired proposal linked to an active deal → moves deal back to PipelineQualified
 *  4. Dispatches an in-app notification to the deal's assigned user
 *  5. Writes an audit trail for every action
 *
 * Secured by CRON_SECRET Bearer token (set in .env / hosting cron config).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(request: Request) {
  try {
    // ── Auth gate ────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // ── 1. Find expired proposals ────────────────────────────────────────────
    const expiredProposals = await prisma.proposal.findMany({
      where: {
        validUntil: { lt: now },
        status: { in: ["Sent", "Draft"] },
        deletedAt: null,
      },
      include: {
        deal: {
          select: {
            id: true,
            status: true,
            assignedUserId: true,
            dealName: true,
          },
        },
        customer: { select: { name: true } },
      },
    });

    if (expiredProposals.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const expiredIds = expiredProposals.map((p) => p.id);

    // ── 2. Mark proposals as Expired ─────────────────────────────────────────
    await prisma.proposal.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: "Expired" },
    });

    // ── 3. Per-proposal: deal regression + notification + audit ──────────────
    for (const proposal of expiredProposals) {
      // Audit trail for each proposal
      await logAudit(
        "system",
        "Proposal",
        "Expired",
        `Proposal "${proposal.proposalNumber}" (${proposal.title}) for ${proposal.customer?.name ?? "Unknown"} expired automatically. ValidUntil: ${proposal.validUntil.toISOString()}`
      );

      // If linked to a deal that is still active (not Won/Lost), regress it to PipelineQualified
      const deal = proposal.deal;
      if (deal && deal.status !== "Won" && deal.status !== "Lost") {
        await transitionDealStatus(deal.id, "SalesOpportunity", {
          actorId: "system",
          reason: `Linked proposal "${proposal.proposalNumber}" expired on ${proposal.validUntil.toDateString()}`,
        });

        // Notify the deal's assigned executive / manager
        if (deal.assignedUserId) {
          await dispatchNotification({
            userId: deal.assignedUserId,
            title: "Proposal Expired ⚠️",
            message: `Proposal "${proposal.proposalNumber}" for deal "${deal.dealName}" has expired. Deal moved back to Pipeline Qualified.`,
            type: "deal",
            link: `/deals/${deal.id}`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredProposals.length,
      proposalIds: expiredIds,
    });
  } catch (error) {
    console.error("Cron Proposals Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
