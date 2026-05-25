import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin"])) {
      return apiError("Unauthorized", 403);
    }

    const { id } = await params;
    const { name, role, isActive } = await request.json();

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return apiError("User not found", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingUser.name,
        role: role !== undefined ? role : existingUser.role,
        isActive: isActive !== undefined ? isActive : existingUser.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    await logAudit(
      userPayload?.id || null,
      "User Master",
      "Update",
      `Updated user ${updatedUser.email}`
    );

    return apiSuccess(updatedUser, "User updated successfully");
  } catch (error) {
    console.error("PUT User Error:", error);
    return apiError("Failed to update user", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin"])) {
      return apiError("Unauthorized", 403);
    }

    const { id } = await params;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return apiError("User not found", 404);
    }

    await prisma.user.delete({ where: { id } });

    await logAudit(
      userPayload?.id || null,
      "User Master",
      "Delete",
      `Deleted user ${existingUser.email}`
    );

    return apiSuccess(null, "User deleted successfully");
  } catch (error) {
    console.error("DELETE User Error:", error);
    return apiError("Failed to delete user", 500);
  }
}
