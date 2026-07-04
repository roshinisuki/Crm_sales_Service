import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/plant-locations?customerId=xxx
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ success: false, message: "customerId is required" }, { status: 400 });
    }

    const locations = await prisma.plantLocation.findMany({
      where: { 
        customerId,
        isActive: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/plant-locations
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.customerId || !body.locationName || !body.address) {
      return NextResponse.json(
        { success: false, message: "customerId, locationName, and address are required" },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId, deletedAt: null },
    });
    if (!customer) {
      return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
    }

    // If setting as primary, unset existing primary
    if (body.isPrimary === true) {
      await prisma.plantLocation.updateMany({
        where: { customerId: body.customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const location = await prisma.plantLocation.create({
      data: {
        customerId: body.customerId,
        locationName: body.locationName,
        address: body.address,
        city: body.city || null,
        state: body.state || null,
        pincode: body.pincode || null,
        gpsLat: body.gpsLat || null,
        gpsLng: body.gpsLng || null,
        isPrimary: body.isPrimary ?? false,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
