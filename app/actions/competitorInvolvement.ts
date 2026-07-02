"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export type CompetitorInvolvementInput = {
  competitorId: string;
  competitorProductId?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  rfqId?: string | null;
  quotationId?: string | null;
  negotiationId?: string | null;
  activityId?: string | null;
  discoveredAtStage: string;
  discoveredThrough: string;
  competitorStatus: string;
  threatLevel: string;
  currentVendor?: string | null;
  customerPainPoint?: string | null;
  customerPreference?: string | null;
  requiredFeatures?: string | null;
  competitorStrengths?: string | null;
  competitorWeaknesses?: string | null;
  ourAdvantages?: string | null;
  ourGaps?: string | null;
  technicalComparisonNotes?: string | null;
  demoFeedback?: string | null;
  competitorQuotedPrice?: number | null;
  ourQuotedPrice?: number | null;
  commercialTermsComparison?: string | null;
  paymentTermsComparison?: string | null;
  deliveryComparison?: string | null;
  negotiationActionPlan?: string | null;
  discountRequestedDueToComp?: boolean;
  expectedCompetitorDiscount?: number | null;
  discountApprovalStatus?: string | null;
  finalResult?: string | null;
  selectedCompetitorId?: string | null;
  winLossReasonId?: string | null;
  secondaryReason?: string | null;
  correctiveAction?: string | null;
  managerReviewNotes?: string | null;
};

export async function listCompetitorInvolvements(filters: {
  leadId?: string;
  dealId?: string;
  customerId?: string;
  rfqId?: string;
  quotationId?: string;
  negotiationId?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const where: Record<string, string> = {};
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.dealId) where.dealId = filters.dealId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.rfqId) where.rfqId = filters.rfqId;
    if (filters.quotationId) where.quotationId = filters.quotationId;
    if (filters.negotiationId) where.negotiationId = filters.negotiationId;

    const records = await prisma.competitorInvolvement.findMany({
      where,
      include: {
        competitor: { select: { id: true, name: true, website: true } },
        competitorProduct: { select: { id: true, name: true } },
        selectedCompetitor: { select: { id: true, name: true } },
        winLossReason: { select: { id: true, name: true } },
        discountApprovedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: records };
  } catch (error) {
    console.error("listCompetitorInvolvements error:", error);
    return { success: false, message: "Failed to fetch competitor involvements." };
  }
}

export async function createCompetitorInvolvement(data: CompetitorInvolvementInput) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    if (!data.competitorId) return { success: false, message: "Competitor is required." };
    if (!data.discoveredAtStage) return { success: false, message: "Discovered at stage is required." };
    if (!data.discoveredThrough) return { success: false, message: "Discovered through is required." };
    if (!data.competitorStatus) return { success: false, message: "Competitor status is required." };
    if (!data.threatLevel) return { success: false, message: "Threat level is required." };

    if (data.discountApprovalStatus === "Approved" && !["SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Only Sales Manager or Admin can approve competitor-driven discounts." };
    }

    const record = await prisma.competitorInvolvement.create({
      data: {
        ...data,
        discountApprovedById: data.discountApprovalStatus === "Approved" ? userPayload.id : null,
        createdById: userPayload.id,
        updatedById: userPayload.id,
        companyId: userPayload.companyId || null,
      },
    });

    return { success: true, data: record };
  } catch (error) {
    console.error("createCompetitorInvolvement error:", error);
    return { success: false, message: "Failed to create competitor involvement." };
  }
}

export async function updateCompetitorInvolvement(id: string, data: Partial<CompetitorInvolvementInput>) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    if (data.discountApprovalStatus === "Approved" && !["SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Only Sales Manager or Admin can approve competitor-driven discounts." };
    }

    const updateData: Record<string, unknown> = { ...data, updatedById: userPayload.id };
    if (data.discountApprovalStatus === "Approved") {
      updateData.discountApprovedById = userPayload.id;
    }

    const record = await prisma.competitorInvolvement.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: record };
  } catch (error) {
    console.error("updateCompetitorInvolvement error:", error);
    return { success: false, message: "Failed to update competitor involvement." };
  }
}

export async function deleteCompetitorInvolvement(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    await prisma.competitorInvolvement.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error("deleteCompetitorInvolvement error:", error);
    return { success: false, message: "Failed to delete competitor involvement." };
  }
}

export async function carryForwardToDeal(leadId: string, dealId: string, customerId?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const leadInvolvements = await prisma.competitorInvolvement.findMany({
      where: { leadId, dealId: null },
    });

    if (leadInvolvements.length === 0) return { success: true, data: [] };

    const updated = await Promise.all(
      leadInvolvements.map((ci) =>
        prisma.competitorInvolvement.update({
          where: { id: ci.id },
          data: {
            dealId,
            customerId: customerId || ci.customerId || null,
            updatedById: userPayload.id,
          },
        })
      )
    );

    return { success: true, data: updated };
  } catch (error) {
    console.error("carryForwardToDeal error:", error);
    return { success: false, message: "Failed to carry forward competitor involvements." };
  }
}

export async function getCompetitorsList() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const competitors = await prisma.competitor.findMany({
      where: {
        companyId: userPayload.companyId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        products: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: competitors };
  } catch (error) {
    console.error("getCompetitorsList error:", error);
    return { success: false, message: "Failed to fetch competitors." };
  }
}

export async function getLossReasonsList() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };

    const reasons = await prisma.lossReason.findMany({
      where: {
        companyId: userPayload.companyId,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: reasons };
  } catch (error) {
    console.error("getLossReasonsList error:", error);
    return { success: false, message: "Failed to fetch loss reasons." };
  }
}
