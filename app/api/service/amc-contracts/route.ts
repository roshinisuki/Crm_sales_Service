import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contracts = await prisma.aMCContract.findMany({
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error: any) {
    console.error("Error fetching AMC contracts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      contractNumber,
      customerId,
      customerAssetId,
      statusId,
      startDate,
      endDate,
      renewalStatus,
      planTier,
      preventiveVisitsIncluded,
      breakdownCallsUnlimited,
      breakdownCallsIncluded,
      sparesCoverage,
      createdById,
    } = body;

    if (!contractNumber || !customerId || !customerAssetId || !statusId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use authenticated user, or fall back to provided createdById
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      finalCreatedById = user.id;
    }

    const newContract = await prisma.aMCContract.create({
      data: {
        contractNumber,
        customerId,
        customerAssetId,
        statusId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        renewalStatus: renewalStatus || "Pending",
        planTier: planTier || null,
        preventiveVisitsIncluded: preventiveVisitsIncluded || 0,
        breakdownCallsUnlimited: breakdownCallsUnlimited || false,
        breakdownCallsIncluded: breakdownCallsIncluded || 0,
        sparesCoverage: sparesCoverage || null,
        createdById: finalCreatedById,
      },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      }
    });

    return NextResponse.json(newContract);
  } catch (error: any) {
    console.error("Error creating AMC contract:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
