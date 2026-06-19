import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET all system configs (admin only)
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SuperAdmin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const configs = await prisma.systemConfig.findMany();
  return NextResponse.json({ success: true, data: configs });
}

// PUT - bulk update system configs
export async function PUT(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SuperAdmin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { updates } = body as { updates: { key: string; value: string }[] };

  if (!Array.isArray(updates)) {
    return NextResponse.json({ success: false, message: "updates must be an array of {key, value}" }, { status: 400 });
  }

  const ops = updates.map(({ key, value }) =>
    prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true, message: `${updates.length} config(s) saved` });
}
