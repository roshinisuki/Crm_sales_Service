import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { migrateTheme, migrateMode, THEME_TO_LEGACY } from "@/lib/theme";

export async function GET() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: { theme: true, themeMode: true }
    });
    console.log("[api/me/preferences GET]", { userId: userPayload.id, theme: user?.theme, themeMode: user?.themeMode });
    return NextResponse.json({
      success: true,
      theme: user?.theme || "ocean",
      themeMode: user?.themeMode || "light"
    });
  } catch (error) {
    console.error("GET preferences error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { theme, themeMode } = body;
    console.log("[api/me/preferences PUT] received", { userId: userPayload.id, theme, themeMode });

    const data: any = {};
    if (theme) {
      // Migrate to valid theme name first
      const cleanTheme = migrateTheme(theme);
      data.theme = THEME_TO_LEGACY[cleanTheme] || cleanTheme;
    }
    if (themeMode) {
      data.themeMode = migrateMode(themeMode);
    }
    console.log("[api/me/preferences PUT] saving", data);

    const updated = await prisma.user.update({
      where: { id: userPayload.id },
      data,
      select: { theme: true, themeMode: true }
    });

    console.log("[api/me/preferences PUT] saved", { theme: updated.theme, themeMode: updated.themeMode });
    return NextResponse.json({
      success: true,
      theme: updated.theme,
      themeMode: updated.themeMode
    });
  } catch (error) {
    console.error("PUT preferences error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
