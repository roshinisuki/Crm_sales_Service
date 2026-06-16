"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getLeadSourcesAction(onlyActive = false) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const where: any = {
      OR: [
        { companyId: userPayload.companyId },
        { companyId: null } // Seeded globals or default fallbacks
      ]
    };

    if (onlyActive) {
      where.isActive = true;
    }

    const leadSources = await prisma.leadSource.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return { success: true, data: leadSources };
  } catch (error: any) {
    console.error("GET Lead Sources Error:", error);
    return { success: false, message: "Failed to fetch lead sources" };
  }
}

export async function createLeadSourceAction(data: { name: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin or SalesManager only" };
    }

    if (!data.name || !data.name.trim()) {
      return { success: false, message: "Name is required" };
    }

    // Check uniqueness
    const existing = await prisma.leadSource.findUnique({
      where: { name: data.name.trim() }
    });

    if (existing) {
      // If it exists but belongs to a different company, or is deactivated
      if (existing.companyId === userPayload.companyId) {
        if (!existing.isActive) {
          // Reactivate it
          const reactivated = await prisma.leadSource.update({
            where: { id: existing.id },
            data: { isActive: true }
          });
          revalidatePath("/settings/lead-sources");
          return { success: true, message: "Lead source reactivated successfully", data: reactivated };
        }
        return { success: false, message: "Lead source already exists" };
      }
    }

    const leadSource = await prisma.leadSource.create({
      data: {
        name: data.name.trim(),
        isActive: true,
        companyId: userPayload.companyId,
      },
    });

    await logAudit(userPayload.id, "settings", "create", `Created lead source: ${data.name}`);

    revalidatePath("/settings/lead-sources");
    return { success: true, message: "Lead source created successfully", data: leadSource };
  } catch (error: any) {
    console.error("CREATE Lead Source Error:", error);
    return { success: false, message: "Failed to create lead source" };
  }
}

export async function updateLeadSourceAction(id: string, data: { name?: string; isActive?: boolean }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin or SalesManager only" };
    }

    const existing = await prisma.leadSource.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, message: "Lead source not found" };
    }

    if (existing.companyId && existing.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized to edit this lead source" };
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      if (!data.name.trim()) {
        return { success: false, message: "Name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updated = await prisma.leadSource.update({
      where: { id },
      data: updateData,
    });

    await logAudit(
      userPayload.id,
      "settings",
      "update",
      `Updated lead source ${id}: ${JSON.stringify(data)}`
    );

    revalidatePath("/settings/lead-sources");
    return { success: true, message: "Lead source updated successfully", data: updated };
  } catch (error: any) {
    console.error("UPDATE Lead Source Error:", error);
    return { success: false, message: "Failed to update lead source" };
  }
}
