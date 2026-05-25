import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { apiSuccess, apiError } from "@/lib/apiResponse";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return apiError("Email and password are required");
    }

    // Domain validation
    if (!email.toLowerCase().endsWith("@sukisoftware.com")) {
      return apiError("Access restricted. Please use your official domain @sukisoftware.com");
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return apiError("Invalid credentials");
    }

    if (!user.isActive) {
      return apiError("Account is inactive. Please contact your administrator.");
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return apiError("Invalid credentials");
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "30m" } // Session timeout: auto-logout after 30 mins
    );

    // Create response
    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }, "Login successful");

    // Set HTTP-only cookie
    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 60, // 30 mins
    });

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    return apiError("Internal server error", 500);
  }
}
