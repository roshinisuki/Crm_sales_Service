import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
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

    return apiSuccess(users);
  } catch (error) {
    console.error("GET Users Error:", error);
    return apiError("Failed to fetch users", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin"])) {
      return apiError("Unauthorized: Only Admin can create users", 403);
    }

    const { email, name, role, password } = await request.json();

    if (!email || !name || !role || !password) {
      return apiError("Missing required fields");
    }

    if (!email.toLowerCase().endsWith("@sukisoftware.com")) {
      return apiError("Email must end with @sukisoftware.com");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError("Company email must be unique");
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

    await logAudit(userPayload?.id || null, "User Master", "Create", `Created user ${email}`);

    return apiSuccess(
      {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
      },
      "User created successfully",
      201
    );
  } catch (error) {
    console.error("POST User Error:", error);
    return apiError("Failed to create user", 500);
  }
}
