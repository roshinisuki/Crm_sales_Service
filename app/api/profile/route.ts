import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: {
        name: true,
        email: true,
        role: true,
        phone: true,
        profilePhoto: true,
        isActive: true,
        createdAt: true,
      }
    });

    if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, phone, profilePhoto } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userPayload.id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        profilePhoto: profilePhoto || null,
      },
      select: {
        name: true,
        email: true,
        role: true,
        phone: true,
        profilePhoto: true,
        isActive: true,
        createdAt: true,
      }
    });

    return NextResponse.json({ success: true, message: "Profile updated successfully", data: updatedUser });
  } catch (error) {
    console.error("Profile PATCH Error:", error);
    return NextResponse.json({ success: false, message: "Failed to update profile" }, { status: 500 });
  }
}
