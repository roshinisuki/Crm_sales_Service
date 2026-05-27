import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: userPayload.id }
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: userPayload.id }
      });
    }

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    console.error("GET NotificationPreferences Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { emailFollowUp, emailVisitorCheckIn, inAppVisitUpdate } = body;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: userPayload.id },
      create: {
        userId: userPayload.id,
        emailFollowUp: emailFollowUp ?? true,
        emailVisitorCheckIn: emailVisitorCheckIn ?? false,
        inAppVisitUpdate: inAppVisitUpdate ?? true
      },
      update: {
        ...(emailFollowUp !== undefined && { emailFollowUp }),
        ...(emailVisitorCheckIn !== undefined && { emailVisitorCheckIn }),
        ...(inAppVisitUpdate !== undefined && { inAppVisitUpdate }),
      }
    });

    return NextResponse.json({ success: true, data: prefs, message: "Preferences updated" });
  } catch (error) {
    console.error("PATCH NotificationPreferences Error:", error);
    return NextResponse.json({ success: false, message: "Failed to update preferences" }, { status: 500 });
  }
}
