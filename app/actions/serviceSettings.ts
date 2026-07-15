"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// List of allowed service settings models
const ALLOWED_MODELS = [
  "serviceCategory",
  "complaintType",
  "defectType",
  "priorityLevel",
  "serviceStatus",
  "serviceTeam",
  "serviceEngineer",
  "customerAsset",
  "escalationRule",
  "sparePart",
];

export async function getServiceSettingsAction(modelName: string, onlyActive = false) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    if (!ALLOWED_MODELS.includes(modelName)) {
      return { success: false, message: "Invalid model name" };
    }

    const where: any = {};
    if (onlyActive) {
      where.isActive = true;
    }

    // Dynamic select/include for relations
    let include: any = undefined;
    if (modelName === "serviceTeam") {
      include = { manager: { select: { id: true, name: true, email: true } } };
    } else if (modelName === "serviceEngineer") {
      include = {
        user: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
      };
    } else if (modelName === "customerAsset") {
      include = { customer: { select: { id: true, name: true } } };
    }

    const items = await (prisma as any)[modelName].findMany({
      where,
      include,
      orderBy: modelName === "serviceStatus" ? { order: "asc" } : { createdAt: "desc" },
    });

    return { success: true, data: items };
  } catch (error: any) {
    console.error(`GET Service Settings (${modelName}) Error:`, error);
    return { success: false, message: `Failed to fetch ${modelName} settings` };
  }
}

export async function createServiceSettingsAction(modelName: string, data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only" };
    }

    if (!ALLOWED_MODELS.includes(modelName)) {
      return { success: false, message: "Invalid model name" };
    }

    // Standard name field sanitization if present
    if (data.name && typeof data.name === "string") {
      data.name = data.name.trim();
    }

    // Number conversion for fields
    if (data.slaLimitHours !== undefined) {
      data.slaLimitHours = parseInt(data.slaLimitHours, 10);
    }
    if (data.order !== undefined) {
      data.order = parseInt(data.order, 10);
    }

    // Date conversion
    if (data.purchaseDate) data.purchaseDate = new Date(data.purchaseDate);
    if (data.warrantyExpiryDate) data.warrantyExpiryDate = new Date(data.warrantyExpiryDate);
    if (data.amcExpiryDate) data.amcExpiryDate = new Date(data.amcExpiryDate);

    const created = await (prisma as any)[modelName].create({
      data,
    });

    await logAudit(userPayload.id, "settings", "create", `Created service setting ${modelName}: ${created.id}`);

    revalidatePath("/service/settings");
    return { success: true, message: "Setting created successfully", data: created };
  } catch (error: any) {
    console.error(`CREATE Service Settings (${modelName}) Error:`, error);
    return { success: false, message: `Failed to create ${modelName} setting` };
  }
}

export async function updateServiceSettingsAction(modelName: string, id: string, data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only" };
    }

    if (!ALLOWED_MODELS.includes(modelName)) {
      return { success: false, message: "Invalid model name" };
    }

    if (data.name && typeof data.name === "string") {
      data.name = data.name.trim();
    }

    if (data.slaLimitHours !== undefined) {
      data.slaLimitHours = parseInt(data.slaLimitHours, 10);
    }
    if (data.order !== undefined) {
      data.order = parseInt(data.order, 10);
    }

    // Date conversion
    if (data.purchaseDate) data.purchaseDate = new Date(data.purchaseDate);
    if (data.warrantyExpiryDate) data.warrantyExpiryDate = new Date(data.warrantyExpiryDate);
    if (data.amcExpiryDate) data.amcExpiryDate = new Date(data.amcExpiryDate);

    // Filter out undefined values to prevent overriding fields unexpectedly
    const cleanData: any = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        cleanData[key] = data[key];
      }
    });

    const updated = await (prisma as any)[modelName].update({
      where: { id },
      data: cleanData,
    });

    await logAudit(userPayload.id, "settings", "update", `Updated service setting ${modelName} (${id})`);

    revalidatePath("/service/settings");
    return { success: true, message: "Setting updated successfully", data: updated };
  } catch (error: any) {
    console.error(`UPDATE Service Settings (${modelName}) Error:`, error);
    return { success: false, message: `Failed to update ${modelName} setting` };
  }
}

export async function deleteServiceSettingsAction(modelName: string, id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only" };
    }

    if (!ALLOWED_MODELS.includes(modelName)) {
      return { success: false, message: "Invalid model name" };
    }

    await (prisma as any)[modelName].delete({
      where: { id },
    });

    await logAudit(userPayload.id, "settings", "delete", `Deleted service setting ${modelName} (${id})`);

    revalidatePath("/service/settings");
    return { success: true, message: "Setting deleted successfully" };
  } catch (error: any) {
    console.error(`DELETE Service Settings (${modelName}) Error:`, error);
    return { success: false, message: `Failed to delete ${modelName} setting` };
  }
}
