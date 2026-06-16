"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  sendEmail,
  buildOtpEmail,
  buildResetEmail,
  buildInvitationEmail,
  buildCustomerActivationEmail,
  buildInternalActivationEmail,
} from "@/lib/email";
import { z } from "zod";
import { verifyAuth, isInternalEmail, requiresInternalEmail, getRoleRedirect } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || "sukisoftware.com";
const RESET_EXPIRY_MIN = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES) || 15;
const ACTIVATION_EXPIRY_HRS = Number(process.env.ACTIVATION_TOKEN_EXPIRY_HOURS) || 24;

// ─── Password Strength Schema ─────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, "Minimum 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[!@#$%^&*]/, "Must contain a special character (!@#$%^&*)");

// ─── JWT Cookie Setter ────────────────────────────────────────────────────────
async function issueAuthCookie(user: { id: string; email: string; role: string; companyId?: string | null }, rememberMe = false) {
  // rememberMe=true → 7 days; default → 8 hours
  const expiresIn = rememberMe ? "7d" : "8h";
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 8 * 60 * 60;

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
    JWT_SECRET,
    { expiresIn }
  );

  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
  });
}

// ═══════════════════════════════════════════════════════════════
// FLOW 1 — FIRST LOGIN (OTP + SET PASSWORD)
// ═══════════════════════════════════════════════════════════════

// --- STEP 0: Check login type ---
export async function checkLoginType(email: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
    });

    if (!user) {
      return { success: false, message: "No account found with this email." };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        success: false,
        message: "Account temporarily locked. Try again later.",
      };
    }

    // Domain validation for internal roles
    if (requiresInternalEmail(user.role) && !isInternalEmail(normalizedEmail)) {
      return {
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed for internal accounts.`,
      };
    }

    // Bypass first-time setup flow for all internal users.
    // They will login with email and password directly, and use "Forgot Password" if they need to set their initial password.
    const isFirstLogin = false;

    return { success: true, data: { isFirstLogin } };
  } catch (error) {
    console.error("checkLoginType error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW 2 — NORMAL LOGIN (EMAIL + PASSWORD)
// ═══════════════════════════════════════════════════════════════

export async function loginWithPassword(email: string, password: string, rememberMe: boolean) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
    });

    if (!user) {
      return { success: false, message: "Invalid email or password." };
    }

    // Domain validation for internal roles
    if (requiresInternalEmail(user.role) && !isInternalEmail(normalizedEmail)) {
      await logAudit(user.id, "AUTH", "LOGIN_DOMAIN_REJECTED", `Domain check failed for ${normalizedEmail}`);
      return {
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed for internal accounts.`,
      };
    }

    // Block if isFirstLogin=true removed as per request to bypass OTP setup for all roles.

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        success: false,
        message: "Account locked due to too many failed attempts. Try again later.",
      };
    }

    // Verify password
    if (!user.passwordHash) {
      return { success: false, message: "Invalid email or password." };
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const newAttempts = (user.loginAttempts || 0) + 1;
      const lockData =
        newAttempts >= 5
          ? {
              loginAttempts: 0,
              lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            }
          : { loginAttempts: newAttempts };

      await prisma.user.update({ where: { id: user.id }, data: lockData });
      await logAudit(user.id, "AUTH", "LOGIN_FAILED", `Failed login attempt ${newAttempts} for ${user.email}`);
      return { success: false, message: "Invalid email or password." };
    }

    // Customer subscription check removed. Expired customers can now login to the portal.

    // Reset lockout + update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), rememberMe },
    });

    await issueAuthCookie(user, rememberMe);
    await logAudit(user.id, "AUTH", "LOGIN", `Successful login for ${user.email}`);

    const redirectUrl = getRoleRedirect(user.role);
    return { success: true, redirectUrl };
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("loginWithPassword error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW 3 — FORGOT PASSWORD (RESET LINK)
// ═══════════════════════════════════════════════════════════════

export async function sendPasswordResetLink(email: string) {
  const genericResponse = {
    success: true,
    message: "If an account exists with this email, a reset link has been sent.",
  };

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
    });

    if (!user) return genericResponse;

    // Strict check for Customers: ensure their business record is "Active"
    if (user.userType === "customer") {
      const customerRecord = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
      });
      if (!customerRecord || customerRecord.status !== "ActiveCustomer") {
        return genericResponse;
      }
    }

    // Generate reset token — expires in 15 minutes
    const resetToken = jwt.sign(
      { userId: user.id, purpose: "PASSWORD_RESET" },
      JWT_SECRET,
      { expiresIn: `${RESET_EXPIRY_MIN}m` }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: new Date(Date.now() + RESET_EXPIRY_MIN * 60 * 1000),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    await sendEmail(
      user.email,
      "Reset Your Password —  SUKI  Marketing CRM",
      buildResetEmail(user.name, resetUrl)
    );

    await logAudit(user.id, "AUTH", "RESET_LINK_SENT", `Password reset link sent to ${user.email}`);

    return genericResponse;
  } catch (error) {
    console.error("sendPasswordResetLink error:", error);
    return genericResponse;
  }
}

// --- Validate Reset Token (called on page load) ---
export async function validateResetToken(token: string) {
  try {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return { success: false, message: "Reset link is invalid or has expired." };
    }

    if (payload?.purpose !== "PASSWORD_RESET") {
      return { success: false, message: "Invalid reset link." };
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, resetToken: token },
    });

    if (!user) {
      return { success: false, message: "Reset link has already been used." };
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return { success: false, message: "Reset link has expired. Please request a new one." };
    }

    return { success: true, message: "Token valid." };
  } catch (error) {
    console.error("validateResetToken error:", error);
    return { success: false, message: "Reset link is invalid or has expired." };
  }
}

// --- Save New Password ---
export async function saveNewPassword(token: string, newPassword: string) {
  try {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return { success: false, message: "Reset link is invalid or has expired." };
    }

    if (payload?.purpose !== "PASSWORD_RESET") {
      return { success: false, message: "Invalid reset link." };
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, resetToken: token },
    });

    if (!user) {
      return { success: false, message: "Reset link has already been used." };
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return { success: false, message: "Reset link has expired. Please request a new one." };
    }

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues?.[0]?.message || "Password does not meet requirements.",
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await logAudit(user.id, "AUTH", "PASSWORD_RESET", `Password successfully reset for ${user.email}`);

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    console.error("saveNewPassword error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW 4 — CUSTOMER PORTAL ACTIVATION
// ═══════════════════════════════════════════════════════════════

/** Admin/Lead activates portal access for a customer */
export async function activateCustomerPortal(customerId: string) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(adminPayload.role)) {
      return { success: false, message: "Unauthorized: Admin or Marketing Lead only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (adminPayload.role === "SuperAdmin" && (!adminPayload.supportMode || !adminPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Find customer record
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) return { success: false, message: "Customer not found." };

    // Tenant check
    if (customer.companyId !== adminPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    if (!customer.email) return { success: false, message: "Customer does not have an email address." };
    if (customer.status !== "ActiveCustomer") return { success: false, message: "Only Active customers can be granted portal access." };

    // Find or create user record for customer
    let user = await prisma.user.findUnique({ where: { email: customer.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: customer.email,
          name: customer.name,
          role: "Customer",
          userType: "customer",
          passwordHash: "",
          isActive: true,
          isFirstLogin: true,
          companyId: customer.companyId,
        },
      });
    }

    // Generate activation token (24hr)
    const activationToken = jwt.sign(
      { userId: user.id, purpose: "CUSTOMER_ACTIVATION" },
      JWT_SECRET,
      { expiresIn: `${ACTIVATION_EXPIRY_HRS}h` }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken,
        activationTokenExpiry: new Date(Date.now() + ACTIVATION_EXPIRY_HRS * 60 * 60 * 1000),
        isActive: true,
        isFirstLogin: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const activationUrl = `${appUrl}/activate-account?token=${activationToken}`;

    await sendEmail(
      customer.email,
      "Welcome to  SUKI  Software Customer Portal",
      buildCustomerActivationEmail(customer.name, activationUrl)
    );

    await logAudit(
      adminPayload.id,
      "Customer Master",
      "PORTAL_ACTIVATED",
      `Portal access activated for customer ${customer.name} (${customer.email})`
    );

    return { success: true, message: `Activation email sent to ${customer.email}.` };
  } catch (error) {
    console.error("activateCustomerPortal error:", error);
    return { success: false, message: "Failed to activate portal access." };
  }
}

/** Customer sets their password via activation link */
export async function completeCustomerActivation(token: string, password: string) {
  try {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return { success: false, message: "Activation link is invalid or has expired." };
    }

    if (payload?.purpose !== "CUSTOMER_ACTIVATION") {
      return { success: false, message: "Invalid activation link." };
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, activationToken: token },
    });

    if (!user) {
      return { success: false, message: "This activation link has already been used." };
    }

    if (!user.activationTokenExpiry || user.activationTokenExpiry < new Date()) {
      return { success: false, message: "Activation link has expired. Please contact support." };
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues?.[0]?.message || "Password does not meet requirements.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isFirstLogin: false,
        isActive: true,
        activationToken: null,
        activationTokenExpiry: null,
        lastLoginAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await issueAuthCookie(user, false);
    await logAudit(user.id, "AUTH", "CUSTOMER_ACTIVATION_COMPLETE", `Customer portal activated for ${user.email}`);

    revalidatePath("/customer/portal");
    redirect("/customer/portal");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("completeCustomerActivation error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARED ACTIONS
// ═══════════════════════════════════════════════════════════════

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: "token",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return { success: true, message: "Logged out successfully" };
}

export async function getMeAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isFirstLogin: true,
        lastLoginAt: true,
        theme: true,
        themeMode: true,
      },
    });

    if (!user || !user.isActive) {
      return { success: false, message: "User not found or inactive" };
    }

    return { success: true, data: { ...user, lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null } };
  } catch (error) {
    console.error("getMeAction error:", error);
    return { success: false, message: "Internal server error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// THEME PERSISTENCE (per-user profile)
// ═══════════════════════════════════════════════════════════════

export async function saveUserThemeAction(theme: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const validThemes = ["ember", "ocean", "forest", "obsidian"];
    if (!validThemes.includes(theme)) {
      return { success: false, message: "Invalid theme" };
    }

    await prisma.user.update({
      where: { id: userPayload.id },
      data: { theme },
    });

    return { success: true };
  } catch (error) {
    console.error("saveUserThemeAction error:", error);
    return { success: false, message: "Failed to save theme" };
  }
}

export async function saveUserThemeModeAction(mode: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const validModes = ["light", "dark"];
    if (!validModes.includes(mode)) {
      return { success: false, message: "Invalid theme mode" };
    }

    await prisma.user.update({
      where: { id: userPayload.id },
      data: { themeMode: mode },
    });

    return { success: true };
  } catch (error) {
    console.error("saveUserThemeModeAction error:", error);
    return { success: false, message: "Failed to save theme mode" };
  }
}

// Legacy alias
export async function loginAction(data: { email: string; password: string }) {
  return loginWithPassword(data.email, data.password, false);
}

/** Admin unlocks a locked user account (resets loginAttempts and lockedUntil) */
export async function unlockAccountAction(email: string) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || !["Admin", "SuperAdmin"].includes(adminPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, message: "User not found." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    await logAudit(adminPayload.id, "AUTH", "UNLOCK_ACCOUNT", `Admin unlocked account for ${user.email}`);

    return { success: true, message: `Account ${user.email} has been unlocked.` };
  } catch (error) {
    console.error("unlockAccountAction error:", error);
    return { success: false, message: "Failed to unlock account." };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN-CONTROLLED USER CREATION + INVITATION
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ADMIN-CONTROLLED INTERNAL USER CREATION
// ═══════════════════════════════════════════════════════════════
export async function createInternalUserByAdmin(data: {
  name: string;
  email: string;
  role: "SalesManager" | "SalesExecutive";
}) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || !["Admin", "SuperAdmin"].includes(adminPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (adminPayload.role === "SuperAdmin" && (!adminPayload.supportMode || !adminPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { name, email, role } = data;
    if (!name?.trim() || !email?.trim() || !role) {
      return { success: false, message: "Name, email and role are required." };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Domain check: internal users MUST use company email
    if (!isInternalEmail(normalizedEmail)) {
      return {
        success: false,
        message: `Internal employees must use a @${ALLOWED_DOMAIN} email address.`,
      };
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, message: "A user with this email already exists." };
    }

    // Generate a secure activation token (24 hours)
    const activationToken = jwt.sign(
      { email: normalizedEmail, purpose: "ACCOUNT_ACTIVATION" },
      JWT_SECRET,
      { expiresIn: `${ACTIVATION_EXPIRY_HRS}h` }
    );
    const activationTokenExpiry = new Date(Date.now() + ACTIVATION_EXPIRY_HRS * 60 * 60 * 1000);

    const adminUser = await prisma.user.findUnique({ where: { id: adminPayload.id }, select: { name: true } });
    const inviterName = adminUser?.name || " SUKI  CRM Admin";

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        role,
        userType: "internal",
        passwordHash: "",
        isActive: true,
        isFirstLogin: true,
        activationToken,
        activationTokenExpiry,
        otpAttempts: 0,
        invitedBy: adminPayload.id,
        invitedAt: new Date(),
        companyId: adminPayload.companyId,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const activationUrl = `${appUrl}/activate-account?token=${activationToken}`;

    await sendEmail(
      normalizedEmail,
      "You've been added to  SUKI  CRM — Set Your Password",
      buildInternalActivationEmail(name.trim(), activationUrl, inviterName)
    );

    await logAudit(adminPayload.id, "User Master", "USER_CREATED", `Admin created internal user ${normalizedEmail} (${role})`);
    await logAudit(adminPayload.id, "User Master", "ACTIVATION_SENT", `Activation link sent to ${normalizedEmail}`);

    return {
      success: true,
      message: `Account created. Activation link sent to ${normalizedEmail}.`,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        userType: newUser.userType,
        isActive: newUser.isActive,
        isFirstLogin: newUser.isFirstLogin,
      },
    };
  } catch (error) {
    console.error("createInternalUserByAdmin error:", error);
    return { success: false, message: "Failed to create user. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN-CONTROLLED CUSTOMER PORTAL USER CREATION
// ═══════════════════════════════════════════════════════════════
export async function createCustomerPortalUser(customerId: string) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || !["Admin", "SuperAdmin"].includes(adminPayload.role)) {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (adminPayload.role === "SuperAdmin" && (!adminPayload.supportMode || !adminPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    // Delegate to the existing portal activation flow
    const result = await activateCustomerPortal(customerId);
    if (result.success) {
      await logAudit(adminPayload.id, "User Master", "CUSTOMER_PORTAL_CREATED", `Portal user created for customer ${customerId}`);
    }
    return result;
  } catch (error) {
    console.error("createCustomerPortalUser error:", error);
    return { success: false, message: "Failed to create customer portal user." };
  }
}

// ═══════════════════════════════════════════════════════════════
// RESEND INVITATION (activation link, not OTP)
// ═══════════════════════════════════════════════════════════════
export async function resendInvitation(userId: string) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || !["Admin", "SalesManager", "SuperAdmin"].includes(adminPayload.role)) {
      return { success: false, message: "Unauthorized: Admin or Marketing Lead only." };
    }

    // Tenant check: SuperAdmin supportMode check
    if (adminPayload.role === "SuperAdmin" && (!adminPayload.supportMode || !adminPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "User not found." };

    // Tenant check
    if (user.companyId !== adminPayload.companyId) {
      return { success: false, message: "Unauthorized access" };
    }

    if (!user.isFirstLogin) return { success: false, message: "User has already completed setup." };

    const adminUser = await prisma.user.findUnique({ where: { id: adminPayload.id }, select: { name: true } });
    const inviterName = adminUser?.name || " SUKI  CRM Admin";

    if (user.userType === "customer") {
      // For customer portal users, resend the portal activation email
      const result = await activateCustomerPortal(
        // Find the linked customer
        (await prisma.customer.findFirst({ where: { email: user.email } }))?.id || ""
      );
      if (!result.success) return { success: false, message: result.message || "Failed to resend portal activation." };
    } else {
      // For internal users, regenerate activation token and resend
      const activationToken = jwt.sign(
        { email: user.email, purpose: "ACCOUNT_ACTIVATION" },
        JWT_SECRET,
        { expiresIn: `${ACTIVATION_EXPIRY_HRS}h` }
      );
      await prisma.user.update({
        where: { id: userId },
        data: {
          activationToken,
          activationTokenExpiry: new Date(Date.now() + ACTIVATION_EXPIRY_HRS * 60 * 60 * 1000),
          invitedBy: adminPayload.id,
          invitedAt: new Date(),
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const activationUrl = `${appUrl}/activate-account?token=${activationToken}`;

      await sendEmail(
        user.email,
        "SUKI CRM — Set Your Password (resent)",
        buildInternalActivationEmail(user.name, activationUrl, inviterName)
      );
    }

    await logAudit(adminPayload.id, "User Master", "INVITATION_RESENT", `Invitation resent to ${user.email}`);
    return { success: true, message: `Invitation resent to ${user.email}.` };
  } catch (error) {
    console.error("resendInvitation error:", error);
    return { success: false, message: "Failed to resend invitation." };
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTIVATE ACCOUNT (new users setting password via activation link)
// ═══════════════════════════════════════════════════════════════
export async function activateAccountAction(token: string, password: string) {
  try {
    const cleanToken = token.trim();
    // Validate the JWT
    let payload: any;
    try {
      payload = jwt.verify(cleanToken, JWT_SECRET);
    } catch {
      return { success: false, message: "Activation link is invalid or has expired." };
    }

    if (payload?.purpose !== "ACCOUNT_ACTIVATION" && payload?.purpose !== "CUSTOMER_ACTIVATION") {
      return { success: false, message: "Invalid activation link." };
    }

    let user;
    if (payload.purpose === "CUSTOMER_ACTIVATION" && payload.userId) {
      user = await prisma.user.findUnique({ where: { id: payload.userId } });
    } else if (payload.email) {
      user = await prisma.user.findUnique({ where: { email: payload.email } });
    }

    if (!user || user.activationToken !== cleanToken) {
      return { success: false, message: "This activation link has already been used or is invalid." };
    }

    if (!user.activationTokenExpiry || user.activationTokenExpiry < new Date()) {
      return { success: false, message: "Activation link has expired. Please contact your administrator." };
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues?.[0]?.message || "Password does not meet requirements.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isFirstLogin: false,
        isActive: true,
        activationToken: null,
        activationTokenExpiry: null,
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
        passwordSetAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await logAudit(user.id, "AUTH", "ACCOUNT_ACTIVATED", `Account activated for ${user.email}`);
    return { success: true, message: "Account activated successfully." };
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("activateAccountAction error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// Legacy alias kept for backward compatibility
export async function createUserByAdmin(data: {
  name: string;
  email: string;
  role: "Admin" | "SalesManager" | "SalesExecutive" | "Customer";
  phone?: string;
  department?: string;
  employeeId?: string;
}) {
  if (data.role === "SalesManager" || data.role === "SalesExecutive") {
    return createInternalUserByAdmin({ name: data.name, email: data.email, role: data.role });
  }
  return { success: false, message: "Use the split creation flow (createInternalUserByAdmin / createCustomerPortalUser)." };
}

// ═══════════════════════════════════════════════════════════════
// SELF-SERVICE: REQUEST NEW ACTIVATION LINK (for expired links)
// ═══════════════════════════════════════════════════════════════
export async function requestNewActivationLink(email: string) {
  try {
    if (!email?.trim()) {
      return { success: false, message: "Please provide your email address." };
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Always return success to prevent email enumeration
    if (!user || !user.isFirstLogin) {
      return { success: true, message: "If that email is registered and pending activation, a new link has been sent." };
    }

    // Find linked customer to use activateCustomerPortal flow
    const customer = await prisma.customer.findFirst({ where: { email: user.email } });

    if (customer) {
      // Customer portal user — regenerate via activateCustomerPortal-style flow
      const activationToken = jwt.sign(
        { userId: user.id, purpose: "CUSTOMER_ACTIVATION" },
        JWT_SECRET,
        { expiresIn: `${ACTIVATION_EXPIRY_HRS}h` }
      );
      await prisma.user.update({
        where: { id: user.id },
        data: {
          activationToken,
          activationTokenExpiry: new Date(Date.now() + ACTIVATION_EXPIRY_HRS * 60 * 60 * 1000),
          isActive: true,
          isFirstLogin: true,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const activationUrl = `${appUrl}/activate-account?token=${activationToken}`;
      await sendEmail(user.email, "Your New  SUKI  Portal Activation Link", buildCustomerActivationEmail(customer.name, activationUrl));
    } else {
      // Internal user — regenerate internal activation
      const activationToken = jwt.sign(
        { email: user.email, purpose: "ACCOUNT_ACTIVATION" },
        JWT_SECRET,
        { expiresIn: `${ACTIVATION_EXPIRY_HRS}h` }
      );
      await prisma.user.update({
        where: { id: user.id },
        data: {
          activationToken,
          activationTokenExpiry: new Date(Date.now() + ACTIVATION_EXPIRY_HRS * 60 * 60 * 1000),
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const activationUrl = `${appUrl}/activate-account?token=${activationToken}`;
      await sendEmail(user.email, "Your New  SUKI  CRM Activation Link", buildInternalActivationEmail(user.name, activationUrl, " SUKI  CRM Admin"));
    }

    return { success: true, message: "If that email is registered and pending activation, a new link has been sent." };
  } catch (error) {
    console.error("requestNewActivationLink error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ─── First Login OTP Functions ────────────────────────────────────────────────
// TODO: Implement OTP-based first login flow
export async function sendFirstLoginOtp(email: string) {
  try {
    // Stub implementation
    return { success: true, message: "OTP sent to your email." };
  } catch (error) {
    console.error("sendFirstLoginOtp error:", error);
    return { success: false, message: "Failed to send OTP." };
  }
}

export async function verifyFirstLoginOtp(email: string, code: string) {
  try {
    // Stub implementation
    return { success: true, message: "OTP verified." };
  } catch (error) {
    console.error("verifyFirstLoginOtp error:", error);
    return { success: false, message: "Invalid or expired OTP." };
  }
}

export async function completeFirstLogin(email: string, otp: string, password: string, rememberMe: boolean) {
  try {
    // Stub implementation
    return { success: true, message: "Login completed.", redirectUrl: "/dashboard" };
  } catch (error) {
    console.error("completeFirstLogin error:", error);
    return { success: false, message: "Failed to complete login." };
  }
}
