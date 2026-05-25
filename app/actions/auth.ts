"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { verifyAuth } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export async function loginAction(data: any) {
  try {
    const { email, password } = data;

    if (!email || !password) {
      return { success: false, message: "Email and password are required" };
    }

    if (!email.toLowerCase().endsWith("@sukisoftware.com")) {
      return { success: false, message: "Access restricted. Please use your official domain @sukisoftware.com" };
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { success: false, message: "Invalid credentials" };
    }

    if (!user.isActive) {
      return { success: false, message: "Account is inactive. Please contact your administrator." };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return { success: false, message: "Invalid credentials" };
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    const cookieStore = await cookies();
    cookieStore.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 60,
    });

    return { 
      success: true, 
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
      message: "Login successful" 
    };
  } catch (error) {
    console.error("Login Error:", error);
    return { success: false, message: "Internal server error" };
  }
}

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
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return { success: false, message: "User not found or inactive" };
    }

    return { success: true, data: user };
  } catch (error) {
    console.error("Auth Me Error:", error);
    return { success: false, message: "Internal server error" };
  }
}
