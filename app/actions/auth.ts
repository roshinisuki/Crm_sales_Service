"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sendEmail, buildOtpEmail, buildResetEmail, buildInvitationEmail } from "@/lib/email";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// ─── Password Strength Schema ─────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, "Minimum 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[!@#$%^&*]/, "Must contain a special character (!@#$%^&*)");

// ─── JWT Cookie Setter ────────────────────────────────────────────────────────
async function issueAuthCookie(user: {
  id: string;
  email: string;
  role: string;
}) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

// ═══════════════════════════════════════════════════════════════
// FLOW 1 — FIRST LOGIN (OTP + SET PASSWORD)
// ═══════════════════════════════════════════════════════════════

// --- STEP 0: Check login type ---
export async function checkLoginType(email: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true },
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

    return { success: true, data: { isFirstLogin: user.isFirstLogin } };
  } catch (error) {
    console.error("checkLoginType error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// --- STEP 1: Send First Login OTP ---
export async function sendFirstLoginOtp(email: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true, isFirstLogin: true },
    });

    if (!user) {
      return { success: false, message: "Invalid request." };
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
      },
    });

    await sendEmail(
      user.email,
      "Verify your Suki CRM account",
      buildOtpEmail(user.name, otp)
    );

    await logAudit(user.id, "AUTH", "FIRST_LOGIN_OTP_SENT", `OTP sent to ${user.email}`);

    return {
      success: true,
      message: "A verification code has been sent to your email.",
    };
  } catch (error) {
    console.error("sendFirstLoginOtp error:", error);
    return { success: false, message: "Failed to send verification code. Please try again." };
  }
}

// --- STEP 2: Verify First Login OTP ---
export async function verifyFirstLoginOtp(email: string, otp: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isFirstLogin: true },
    });

    if (!user) {
      return { success: false, message: "Invalid request." };
    }

    // Check expiry
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
      });
      await logAudit(user.id, "AUTH", "OTP_EXPIRED", `OTP expired for ${user.email}`);
      return { success: false, message: "Code expired. Request a new one." };
    }

    // Check max attempts
    if (user.otpAttempts >= 3) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
      });
      await logAudit(user.id, "AUTH", "OTP_MAX_ATTEMPTS", `Max OTP attempts for ${user.email}`);
      return {
        success: false,
        message: "Too many attempts. Request a new code.",
      };
    }

    // Check OTP match
    if (user.otpCode !== otp) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      await logAudit(user.id, "AUTH", "OTP_FAILED", `Wrong OTP attempt for ${user.email}`);
      return { success: false, message: "Incorrect code. Try again." };
    }

    // OTP is valid — do NOT clear yet (will clear after password saved)
    await logAudit(user.id, "AUTH", "OTP_VERIFIED", `OTP verified for ${user.email}`);
    return { success: true, message: "Code verified. Please set your password." };
  } catch (error) {
    console.error("verifyFirstLoginOtp error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// --- STEP 3: Complete First Login (Set Password) ---
export async function completeFirstLogin(
  email: string,
  otp: string,
  newPassword: string
) {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isFirstLogin: true },
    });

    if (!user) {
      return { success: false, message: "Invalid request." };
    }

    // Re-verify OTP server-side (never trust client)
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
      });
      return { success: false, message: "Code expired. Please request a new one." };
    }

    if (user.otpAttempts >= 3) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
      });
      return { success: false, message: "Too many attempts. Please request a new code." };
    }

    if (user.otpCode !== otp) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      return { success: false, message: "Invalid verification code." };
    }

    // Validate password strength
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.errors[0]?.message || "Password does not meet requirements.",
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isFirstLogin: false,
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
        lastLoginAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await issueAuthCookie(user);
    await logAudit(user.id, "AUTH", "FIRST_LOGIN_COMPLETE", `First login completed for ${user.email}`);

    revalidatePath("/dashboard");
    redirect("/dashboard");
  } catch (error: any) {
    // redirect() throws internally — re-throw it
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("completeFirstLogin error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW 2 — NORMAL LOGIN (EMAIL + PASSWORD)
// ═══════════════════════════════════════════════════════════════

export async function loginWithPassword(email: string, password: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true },
    });

    if (!user) {
      return { success: false, message: "Invalid email or password." };
    }

    // Block if isFirstLogin=true — must go through OTP flow first
    if (user.isFirstLogin) {
      return {
        success: false,
        message: "Please complete your first-time account setup.",
      };
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        success: false,
        message: "Account locked due to too many failed attempts. Try again later.",
      };
    }

    // Verify password
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

    // Customer subscription check
    if (user.role === "Customer") {
      // Find subscription via Customer record linked to this user
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          customer: { assignedUserId: user.id },
          status: "Active",
          endDate: { gt: new Date() },
        },
      });
      if (!activeSubscription) {
        await logAudit(user.id, "AUTH", "LOGIN_BLOCKED_NO_SUBSCRIPTION", `No active subscription for ${user.email}`);
        return {
          success: false,
          message: "Your subscription has expired. Please contact support.",
        };
      }
    }

    // Reset lockout + update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await issueAuthCookie(user);
    await logAudit(user.id, "AUTH", "LOGIN", `Successful login for ${user.email}`);

    revalidatePath("/dashboard");
    redirect("/dashboard");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("loginWithPassword error:", error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW 3 — FORGOT PASSWORD (RESET LINK)
// ═══════════════════════════════════════════════════════════════

// --- STEP 1: Send Reset Link ---
export async function sendPasswordResetLink(email: string) {
  // Always return the same message (prevent email enumeration)
  const genericResponse = {
    success: true,
    message: "If this email is registered, a reset link has been sent.",
  };

  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true },
    });

    if (!user) return genericResponse;

    const resetToken = jwt.sign(
      { userId: user.id, purpose: "PASSWORD_RESET" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

    await sendEmail(
      user.email,
      "Reset your Suki CRM password",
      buildResetEmail(user.name, resetUrl)
    );

    await logAudit(user.id, "AUTH", "RESET_LINK_SENT", `Password reset link sent to ${user.email}`);

    return genericResponse;
  } catch (error) {
    console.error("sendPasswordResetLink error:", error);
    // Still return generic — never expose email existence
    return genericResponse;
  }
}

// --- STEP 2: Validate Reset Token (called on page load) ---
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

// --- STEP 3: Save New Password ---
export async function saveNewPassword(token: string, newPassword: string) {
  try {
    // Re-validate token server-side
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

    // Validate password strength server-side
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.errors[0]?.message || "Password does not meet requirements.",
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
// SHARED ACTIONS (preserved from original)
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
      },
    });

    if (!user || !user.isActive) {
      return { success: false, message: "User not found or inactive" };
    }

    return { success: true, data: user };
  } catch (error) {
    console.error("getMeAction error:", error);
    return { success: false, message: "Internal server error" };
  }
}

// Legacy alias — keeps compatibility with any existing references to loginAction
export async function loginAction(data: { email: string; password: string }) {
  return loginWithPassword(data.email, data.password);
}

// ═══════════════════════════════════════════════════════════════
// ADMIN-CONTROLLED USER CREATION + INVITATION
// ═══════════════════════════════════════════════════════════════

// Create user + send invitation OTP (Admin only)
export async function createUserByAdmin(data: {
  name: string;
  email: string;
  role: "Admin" | "MarketingLead" | "MarketingExecutive" | "Customer";
  phone?: string;
  department?: string;
  employeeId?: string;
}) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || adminPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    const { name, email, role, phone, department, employeeId } = data;
    if (!name?.trim() || !email?.trim() || !role) {
      return { success: false, message: "Name, email and role are required." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, message: "A user with this email already exists." };
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Get admin name for invitation email
    const adminUser = await prisma.user.findUnique({ where: { id: adminPayload.id }, select: { name: true } });
    const inviterName = adminUser?.name || "Suki CRM Admin";

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        role,
        passwordHash: "",
        isActive: true,
        isFirstLogin: true,
        otpCode: otp,
        otpExpiry,
        otpAttempts: 0,
        invitedBy: adminPayload.id,
        invitedAt: new Date(),
      },
    });

    // Send branded invitation email
    await sendEmail(
      normalizedEmail,
      "You've been invited to Suki CRM",
      buildInvitationEmail(name.trim(), normalizedEmail, otp, inviterName)
    );

    await logAudit(adminPayload.id, "User Master", "USER_CREATED", `Admin created user ${normalizedEmail} (${role})`);
    await logAudit(adminPayload.id, "User Master", "INVITATION_SENT", `Invitation sent to ${normalizedEmail}`);

    return {
      success: true,
      message: `Account created and invitation sent to ${normalizedEmail}.`,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
        isFirstLogin: newUser.isFirstLogin,
      },
    };
  } catch (error) {
    console.error("createUserByAdmin error:", error);
    return { success: false, message: "Failed to create user. Please try again." };
  }
}

// Resend invitation OTP to an existing pending user (Admin only)
export async function resendInvitation(userId: string) {
  try {
    const adminPayload = await verifyAuth();
    if (!adminPayload || adminPayload.role !== "Admin") {
      return { success: false, message: "Unauthorized: Admin only." };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "User not found." };
    if (!user.isFirstLogin) return { success: false, message: "User has already completed setup." };

    const adminUser = await prisma.user.findUnique({ where: { id: adminPayload.id }, select: { name: true } });
    const inviterName = adminUser?.name || "Suki CRM Admin";

    const otp = crypto.randomInt(100000, 999999).toString();
    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: otp,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        invitedBy: adminPayload.id,
        invitedAt: new Date(),
      },
    });

    await sendEmail(
      user.email,
      "Your Suki CRM invitation (resent)",
      buildInvitationEmail(user.name, user.email, otp, inviterName)
    );

    await logAudit(adminPayload.id, "User Master", "INVITATION_RESENT", `Invitation resent to ${user.email}`);

    return { success: true, message: `Invitation resent to ${user.email}.` };
  } catch (error) {
    console.error("resendInvitation error:", error);
    return { success: false, message: "Failed to resend invitation." };
  }
}

