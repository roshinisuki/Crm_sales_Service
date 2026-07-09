"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function getRolePermissions() {
  const permissions = await prisma.rolePermission.findMany({
    orderBy: [
      { module: 'asc' },
      { role: 'asc' }
    ]
  });
  return permissions;
}

export async function updateRolePermission(
  role: string,
  moduleName: string,
  field: "visible" | "canDelete",
  value: boolean
) {
  try {
    await prisma.rolePermission.upsert({
      where: {
        role_module: {
          role,
          module: moduleName
        }
      },
      update: {
        [field]: value
      },
      create: {
        role,
        module: moduleName,
        [field]: value,
        visible: field === "visible" ? value : true,
        canDelete: field === "canDelete" ? value : false
      }
    });

    revalidatePath("/settings/roles");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating permission:", error);
    return { success: false, error: error.message };
  }
}
