import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const engineer = await prisma.serviceEngineer.findFirst({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
      },
    });

    if (!engineer) {
      return NextResponse.json({ error: "Engineer profile not found for this user" }, { status: 404 });
    }

    return NextResponse.json(engineer);
  } catch (error: any) {
    console.error("Error fetching engineer profile:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
