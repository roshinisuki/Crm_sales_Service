import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await prisma.warrantyClaim.findMany({
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(claims);
  } catch (error: any) {
    console.error("Error fetching warranty claims:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title,
      description,
      customerId,
      customerAssetId,
      statusId,
      resolution,
      createdById,
    } = body;

    if (!title || !customerId || !customerAssetId || !statusId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use authenticated user, or fall back to provided createdById
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      finalCreatedById = user.id;
    }

    const newClaim = await prisma.warrantyClaim.create({
      data: {
        title,
        description,
        customerId,
        customerAssetId,
        statusId,
        resolution,
        createdById: finalCreatedById,
      },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      }
    });

    return NextResponse.json(newClaim);
  } catch (error: any) {
    console.error("Error creating warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
