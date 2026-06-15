"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildScope, checkRecordScope } from "@/lib/scopes";

export async function getMarketingLogsAction(params?: { customerId?: string }) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const customerId = params?.customerId;
    const scope = buildScope(userPayload, "MarketingVisit");

    const visits = await prisma.marketingVisit.findMany({
      where: {
        ...scope,
        ...(customerId ? { customerId } : {}),
        checkIn: { not: null }
      },
      include: {
        executive: { select: { id: true, name: true, email: true } },
        customer:  { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { checkIn: "desc" },
    });

    const normalized = visits.map((v) => ({
      ...v,
      checkInTime:  v.checkIn ? v.checkIn.toISOString() : "",
      checkOutTime: v.checkOut?.toISOString() ?? null,
      checkIn:      v.checkIn ? v.checkIn.toISOString() : "",
      checkOut:     v.checkOut?.toISOString() ?? null,
      checkInLat:   v.checkInLat ?? 0,
      checkInLng:   v.checkInLng ?? 0,
      checkOutLat:  v.checkOutLat ?? null,
      checkOutLng:  v.checkOutLng ?? null,
      purpose:      v.remarks ?? null,
      notes:        v.remarks ?? null,
      userId:       v.executiveId,
      user:         v.executive,
      createdAt:    v.createdAt.toISOString(),
      updatedAt:    v.updatedAt?.toISOString() ?? null,
      nextMeetingDate: v.nextMeetingDate?.toISOString() ?? null,
    }));

    return { success: true, data: normalized };
  } catch (error) {
    console.error("GET MarketingVisit Error:", error);
    return { success: false, message: "Failed to fetch marketing visits" };
  }
}

export async function checkInAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { customerId, purpose, remarks, notes, checkInLat, checkInLng, checkInPhoto } = data;

    if (!customerId) return { success: false, message: "Customer ID is required for check-in" };

    // Verify Customer Scope
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !checkRecordScope(userPayload, customer, "Customer")) {
      return { success: false, message: "Customer not found or access denied." };
    }

    const visit = await prisma.marketingVisit.create({
      data: {
        executiveId: userPayload.id,
        customerId,
        purpose:     purpose || null,
        remarks:     remarks || notes || null,
        checkIn:     new Date(),
        checkInLat:  checkInLat ?? null,
        checkInLng:  checkInLng ?? null,
        checkInPhoto: checkInPhoto ?? null,
        companyId:   userPayload.companyId,
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "marketing-log",
      "checkin",
      `Checked in to customer ${customerId}`
    );

    return {
      success: true,
      message: "Checked in successfully",
      data: {
        ...visit,
        checkInTime:  visit.checkIn ? visit.checkIn.toISOString() : "",
        checkOutTime: null,
        checkInLat:   visit.checkInLat ?? 0,
        checkInLng:   visit.checkInLng ?? 0,
        purpose:      visit.remarks,
        notes:        visit.remarks,
        userId:       visit.executiveId,
        user:         visit.executive,
      }
    };
  } catch (error) {
    console.error("POST Marketing Log Check-In Error:", error);
    return { success: false, message: "Failed to check in" };
  }
}

export async function checkOutAction(data: any) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["SalesExecutive", "SalesManager", "Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    // Tenant check: SuperAdmin supportMode check
    if (userPayload.role === "SuperAdmin" && (!userPayload.supportMode || !userPayload.companyId)) {
      return { success: false, message: "Unauthorized: SuperAdmin must access business data via support/impersonation mode." };
    }

    const { id, checkOutLat, checkOutLng, notes } = data;

    if (!id) return { success: false, message: "Visit ID is required for check-out" };

    const existing = await prisma.marketingVisit.findUnique({ where: { id } });
    if (!existing || !checkRecordScope(userPayload, existing, "MarketingVisit")) {
      return { success: false, message: "Visit record not found or access denied." };
    }
    if (existing.checkOut) return { success: false, message: "This visit has already been checked out" };

    const updated = await prisma.marketingVisit.update({
      where: { id },
      data: {
        checkOut: new Date(),
        checkOutLat: checkOutLat ?? null,
        checkOutLng: checkOutLng ?? null,
        remarks:  notes
          ? existing.remarks
            ? `${existing.remarks}\n\nCheck-out notes: ${notes}`
            : notes
          : existing.remarks,
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        executive: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(
      userPayload.id,
      "marketing-log",
      "checkout",
      `Checked out from visit ${id}`
    );

    return {
      success: true,
      message: "Checked out successfully",
      data: {
        ...updated,
        checkInTime:  updated.checkIn ? updated.checkIn.toISOString() : "",
        checkOutTime: updated.checkOut?.toISOString() ?? null,
        checkOutLat:  updated.checkOutLat ?? 0,
        checkOutLng:  updated.checkOutLng ?? 0,
        purpose:      updated.remarks,
        notes:        updated.remarks,
        userId:       updated.executiveId,
        user:         updated.executive,
      }
    };
  } catch (error) {
    console.error("POST Marketing Log Check-Out Error:", error);
    return { success: false, message: "Failed to check out" };
  }
}
