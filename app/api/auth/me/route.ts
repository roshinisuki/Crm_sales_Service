import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!userPayload) {
      return apiError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    if (!user.isActive) {
      return apiError("Account inactive", 403);
    }

    return apiSuccess(user);
  } catch (error) {
    console.error("GET Auth Me Error:", error);
    return apiError("Failed to fetch current user", 500);
  }
}
