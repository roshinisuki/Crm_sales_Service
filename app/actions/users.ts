"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getUsersAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { success: true, data: users };
  } catch (error) {
    console.error("GET Users Error:", error);
    return { success: false, message: "Failed to fetch users" };
  }
}

export async function createUserAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Only Admin can create users" };
    }

    const { email, name, role, password } = data;

    if (!email || !name || !role || !password) {
      return { success: false, message: "Missing required fields" };
    }

    if (!email.toLowerCase().endsWith("@sukisoftware.com")) {
      return { success: false, message: "Email must end with @sukisoftware.com" };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, message: "Company email must be unique" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        isActive: true,
      },
    });

    await logAudit(userPayload.id, "User Master", "Create", `Created user ${email}`);

    return {
      success: true,
      message: "User created successfully",
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
      }
    };
  } catch (error) {
    console.error("POST User Error:", error);
    return { success: false, message: "Failed to create user" };
  }
}

export async function updateUserAction(id: string, data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Only Admin can update users" };
    }

    const { role, isActive } = data;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return { success: false, message: "User not found" };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: role !== undefined ? role : existingUser.role,
        isActive: isActive !== undefined ? isActive : existingUser.isActive,
      },
    });

    await logAudit(
      userPayload.id,
      "User Master",
      "Update",
      `Updated user ${existingUser.email} (Role: ${updatedUser.role}, Active: ${updatedUser.isActive})`
    );

    return {
      success: true,
      message: "User updated successfully",
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      }
    };
  } catch (error) {
    console.error("PUT User Error:", error);
    return { success: false, message: "Failed to update user" };
  }
}

export async function deleteUserAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Only Admin can delete users" };
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return { success: false, message: "User not found" };
    }

    await prisma.user.delete({ where: { id } });

    await logAudit(
      userPayload.id,
      "User Master",
      "Delete",
      `Deleted user ${existingUser.email}`
    );

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("DELETE User Error:", error);
    return { success: false, message: "Failed to delete user" };
  }
}
