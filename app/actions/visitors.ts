"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getVisitorsAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const visitors = await prisma.visitor.findMany({
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
      orderBy: { inTime: "desc" },
    });

    const normalized = visitors.map((v) => ({
      ...v,
      name:         v.visitorName,
      email:        v.visitorEmail,
      phone:        v.visitorPhone,
      hostName:     v.host?.name ?? null,
      checkInTime:  v.inTime.toISOString(),
      checkOutTime: v.outTime?.toISOString() ?? null,
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET Visitors Error:", error);
    return { success: false, message: "Failed to fetch visitors" };
  }
}

export async function createVisitorAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { name, email, phone, company, purpose, hostName } = data;

    if (!name || !phone || !purpose) {
      return { success: false, message: "Name, Phone, and Purpose are required" };
    }

    const visitor = await prisma.visitor.create({
      data: {
        visitorName:  name,
        visitorEmail: email || null,
        visitorPhone: phone,
        company:      company || "",
        purpose,
        hostUserId:   userPayload.id,
        inTime:       new Date(),
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "visitor",
      "create",
      `Walk-in registered: ${name} visited ${visitor.host?.name ?? "office"}`
    );

    return {
      success: true,
      message: "Visitor registered successfully",
      data: {
        ...visitor,
        name:         visitor.visitorName,
        email:        visitor.visitorEmail,
        phone:        visitor.visitorPhone,
        hostName:     visitor.host?.name ?? null,
        checkInTime:  visitor.inTime.toISOString(),
        checkOutTime: null,
      }
    };
  } catch (error) {
    console.error("POST Visitor Error:", error);
    return { success: false, message: "Failed to create visitor" };
  }
}

export async function checkoutVisitorAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "MarketingLead", "MarketingExecutive"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const { id } = data;
    if (!id) return { success: false, message: "Visitor ID is required" };

    const visitor = await prisma.visitor.update({
      where: { id },
      data:  { outTime: new Date() },
    });

    await logAudit(userPayload.id, "visitor", "checkout", `Visitor ${visitor.visitorName} checked out`);

    return {
      success: true,
      message: "Visitor checked out",
      data: { ...visitor, checkOutTime: visitor.outTime?.toISOString() ?? null }
    };
  } catch (error) {
    console.error("PUT Visitor Error:", error);
    return { success: false, message: "Failed to checkout visitor" };
  }
}
