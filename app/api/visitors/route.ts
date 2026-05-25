import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { verifyAuth, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const visitors = await prisma.visitor.findMany({
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
      orderBy: { inTime: "desc" },
    });

    // Normalize to frontend-friendly field names
    const normalized = visitors.map((v) => ({
      ...v,
      name:         v.visitorName,
      email:        v.visitorEmail,
      phone:        v.visitorPhone,
      hostName:     v.host?.name ?? null,
      checkInTime:  v.inTime.toISOString(),
      checkOutTime: v.outTime?.toISOString() ?? null,
    }));

    return apiSuccess(normalized);
  } catch (error) {
    console.error("GET Visitors Error:", error);
    return apiError("Failed to fetch visitors", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const { name, email, phone, company, purpose, hostName } = await request.json();

    if (!name || !phone || !purpose) {
      return apiError("Name, Phone, and Purpose are required");
    }

    const visitor = await prisma.visitor.create({
      data: {
        visitorName:  name,
        visitorEmail: email || null,
        visitorPhone: phone,
        company:      company || "",
        purpose,
        hostUserId:   userPayload!.id,
        inTime:       new Date(),
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload!.id,
      "visitor",
      "create",
      `Walk-in registered: ${name} visited ${visitor.host?.name ?? "office"}`
    );

    return apiSuccess(
      {
        ...visitor,
        name:         visitor.visitorName,
        email:        visitor.visitorEmail,
        phone:        visitor.visitorPhone,
        hostName:     visitor.host?.name ?? null,
        checkInTime:  visitor.inTime.toISOString(),
        checkOutTime: null,
      },
      "Visitor registered successfully",
      201
    );
  } catch (error) {
    console.error("POST Visitor Error:", error);
    return apiError("Failed to create visitor", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userPayload = verifyAuth(request);
    if (!requireRole(userPayload, ["Admin", "MarketingLead", "MarketingExecutive"])) {
      return apiError("Unauthorized", 403);
    }

    const { id } = await request.json();
    if (!id) return apiError("Visitor ID is required");

    const visitor = await prisma.visitor.update({
      where: { id },
      data:  { outTime: new Date() },
    });

    await logAudit(userPayload!.id, "visitor", "checkout", `Visitor ${visitor.visitorName} checked out`);

    return apiSuccess(
      { ...visitor, checkOutTime: visitor.outTime?.toISOString() ?? null },
      "Visitor checked out"
    );
  } catch (error) {
    console.error("PUT Visitor Error:", error);
    return apiError("Failed to checkout visitor", 500);
  }
}
