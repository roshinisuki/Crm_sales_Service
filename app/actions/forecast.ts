"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";

export async function getForecastDataAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }
    const user = userPayload!;
    if (user!.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (user!.role === "SuperAdmin" && (!user!.supportMode || !user!.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const scope = buildScope(userPayload!, "Deal");

    // Define standard probabilities for weighted revenue forecasting
    const stageProbabilities: Record<string, number> = {
      Qualified: 0.2,
      RequirementGathering: 0.35,
      MeetingScheduled: 0.5,
      DemoConducted: 0.7,
      OnHold: 0.2,
      Won: 1.0,
      Lost: 0.0,
      Rejected: 0.0,
    };

    // Fetch all deals with their assigned user details
    const deals = await prisma.deal.findMany({
      where: {
        ...scope,
        status: {
          not: "Lost",
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    // 1. Calculate Pipeline Value & Weighted Projections
    let totalPipelineValue = 0;
    let totalWeightedValue = 0;
    const valueByStage: Record<string, { count: number; raw: number; weighted: number }> = {};

    for (const deal of deals) {
      const value = deal.dealValue || 0;
      const stage = deal.status;
      const prob = stageProbabilities[stage] ?? 0.5;
      const weighted = value * prob;

      totalPipelineValue += value;
      totalWeightedValue += weighted;

      if (!valueByStage[stage]) {
        valueByStage[stage] = { count: 0, raw: 0, weighted: 0 };
      }
      valueByStage[stage].count += 1;
      valueByStage[stage].raw += value;
      valueByStage[stage].weighted += weighted;
    }

    // 2. Expected Closures (Grouped by Month)
    const closuresByMonth: Record<string, { count: number; value: number }> = {};
    const now = new Date();

    for (const deal of deals) {
      const date = deal.expectedCloseDate || now;
      const monthKey = date.toLocaleString("default", { month: "long", year: "numeric" });
      const value = deal.dealValue || 0;

      if (!closuresByMonth[monthKey]) {
        closuresByMonth[monthKey] = { count: 0, value: 0 };
      }
      closuresByMonth[monthKey].count += 1;
      closuresByMonth[monthKey].value += value;
    }

    // Transform closures into sorted array
    const sortedClosures = Object.entries(closuresByMonth)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .slice(0, 6); // Limit to next 6 months

    return {
      success: true,
      data: {
        totalPipelineValue,
        totalWeightedValue,
        valueByStage,
        closures: sortedClosures,
        deals: deals.map((d) => ({
          id: d.id,
          dealName: d.dealName,
          customerName: d.customer?.name || "Unknown",
          dealValue: d.dealValue,
          status: d.status,
          expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString() : null,
          probability: stageProbabilities[d.status] ?? 0.5,
          weightedValue: (d.dealValue || 0) * (stageProbabilities[d.status] ?? 0.5),
        })),
      },
    };
  } catch (error) {
    console.error("Forecast Action Error:", error);
    return { success: false, message: "Failed to load forecast data." };
  }
}
