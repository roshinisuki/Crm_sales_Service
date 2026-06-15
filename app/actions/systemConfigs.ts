"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getSystemConfigsAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const configs = await prisma.systemConfig.findMany();
    const configMap = new Map(configs.map(c => [c.key, c.value]));

    // Return default values if not defined in database
    return {
      success: true,
      data: {
        leads_api_key: configMap.get("leads_api_key") || process.env.LEADS_API_KEY || "suki_secret_key_123",
        leads_assignment_mode: configMap.get("leads_assignment_mode") || "ROUND_ROBIN",
        leads_default_assignee_id: configMap.get("leads_default_assignee_id") || "",
      }
    };
  } catch (error: any) {
    console.error("getSystemConfigsAction error:", error);
    return { success: false, message: "Failed to fetch settings" };
  }
}

export async function updateSystemConfigsAction(data: {
  leads_api_key?: string;
  leads_assignment_mode?: string;
  leads_default_assignee_id?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { leads_api_key, leads_assignment_mode, leads_default_assignee_id } = data;

    const updates = [];
    if (leads_api_key !== undefined) {
      updates.push(prisma.systemConfig.upsert({
        where: { key: "leads_api_key" },
        update: { value: leads_api_key },
        create: { key: "leads_api_key", value: leads_api_key }
      }));
    }
    if (leads_assignment_mode !== undefined) {
      updates.push(prisma.systemConfig.upsert({
        where: { key: "leads_assignment_mode" },
        update: { value: leads_assignment_mode },
        create: { key: "leads_assignment_mode", value: leads_assignment_mode }
      }));
    }
    if (leads_default_assignee_id !== undefined) {
      updates.push(prisma.systemConfig.upsert({
        where: { key: "leads_default_assignee_id" },
        update: { value: leads_default_assignee_id },
        create: { key: "leads_default_assignee_id", value: leads_default_assignee_id }
      }));
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    await logAudit(userPayload.id, "system-setting", "update", "System assignment & API configurations updated");

    return { success: true, message: "Settings saved successfully" };
  } catch (error: any) {
    console.error("updateSystemConfigsAction error:", error);
    return { success: false, message: "Failed to update settings" };
  }
}
