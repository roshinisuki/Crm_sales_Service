"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildScope, checkRecordScope } from "@/lib/scopes";

export async function getUsersAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager", "SalesExecutive", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const scope = buildScope(userPayload, "User");

    const users = await prisma.user.findMany({
      where: scope,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userType: true,
        isActive: true,
        isFirstLogin: true,
        createdAt: true,
      },
    });

    return { success: true, data: users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })) };
  } catch (error) {
    console.error("GET Users Error:", error);
    return { success: false, message: "Failed to fetch users" };
  }
}

export async function updateUserAction(params: { id: string; role?: string; isActive?: boolean }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, role, isActive } = params;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return { success: false, message: "User not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, existingUser, "User")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: role !== undefined ? (role as any) : existingUser.role,
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
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return { success: false, message: "User not found" };
    }

    // Access scope check
    if (!checkRecordScope(userPayload, existingUser, "User")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (userPayload.role === "SuperAdmin") {
      // Permanent Hard Delete for SuperAdmin
      await prisma.user.delete({ where: { id } });
      await logAudit(userPayload.id, "User Master", "Delete_Permanent", `Permanently deleted user ${existingUser.email}`);
    } else {
      // Soft Delete for Admin
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: userPayload.id,
          isActive: false, // Deactivate
        }
      });
      await logAudit(userPayload.id, "User Master", "Delete", `Soft-deleted user ${existingUser.email}`);
    }

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("DELETE User Error:", error);
    return { success: false, message: "Failed to delete user" };
  }
}

export async function restoreUserAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "User not found" };

    if (user.companyId !== userPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: true
      }
    });

    await logAudit(userPayload.id, "User Master", "Restore", `Restored user ${user.email}`);
    return { success: true, message: "User restored successfully" };
  } catch (error) {
    console.error("restoreUserAction error:", error);
    return { success: false, message: "Failed to restore user" };
  }
}

// ─── Approve Pending Registration ─────────────────────────────────────────────
export async function approveUserAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized: Admins only" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "User not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, user, "User")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (user.isActive) return { success: false, message: "User is already active" };

    // Activate the user
    await prisma.user.update({
      where: { id },
      data: { isActive: true, isFirstLogin: true },
    });

    // Send first-login OTP so they can set their password
    const crypto = await import("crypto");
    const { sendEmail, buildOtpEmail } = await import("@/lib/email");

    const otp = crypto.randomInt(100000, 999999).toString();
    await prisma.user.update({
      where: { id },
      data: {
        otpCode: otp,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
      },
    });

    await sendEmail(
      user.email,
      "Your SUKI CRM account has been approved!",
      buildOtpEmail(user.name, otp)
    );

    await logAudit(
      userPayload.id,
      "User Master",
      "Approve",
      `Approved registration for ${user.email}`
    );

    return { success: true, message: `Account approved and activation code sent to ${user.email}` };
  } catch (error) {
    console.error("approveUserAction error:", error);
    return { success: false, message: "Failed to approve user" };
  }
}

// ─── Reject / Delete Pending Registration ────────────────────────────────────
export async function rejectUserAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "User not found" };

    // Access scope check
    if (!checkRecordScope(userPayload, user, "User")) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    if (user.isActive) return { success: false, message: "Cannot reject an already active user." };

    await prisma.user.delete({ where: { id } });

    await logAudit(
      userPayload.id,
      "User Master",
      "Reject",
      `Rejected registration for ${user.email}`
    );

    return { success: true, message: "Registration request rejected and removed." };
  } catch (error) {
    console.error("rejectUserAction error:", error);
    return { success: false, message: "Failed to reject user" };
  }
}

