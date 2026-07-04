import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status = searchParams.get("status");
  const hostedBy = searchParams.get("hostedBy");
  const customerId = searchParams.get("customerId");
  const isExport = searchParams.get("export") === "true";

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status && status !== "All") {
    if (status === "Planned") where.status = "PLANNED";
    else if (status === "Checked In") where.status = "CHECKED_IN";
    else if (status === "Checked Out") where.status = "CHECKED_OUT";
    else if (status === "Completed") where.status = "COMPLETED";
    else if (status === "Missed") where.status = "MISSED";
    else if (status === "Unavailable") where.status = "CUSTOMER_UNAVAILABLE";
  }
  if (hostedBy) where.hostedBy = hostedBy;
  if (customerId) where.customerId = customerId;

  // Date range filter
  if (startDate || endDate) {
    where.OR = [
      { checkInTime: {} as any },
      { createdAt: {} as any },
    ];
    if (startDate && endDate) {
      where.OR = [
        { checkInTime: { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59") } },
        { createdAt: { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59") } },
      ];
    } else if (startDate) {
      where.OR = [
        { checkInTime: { gte: new Date(startDate) } },
        { createdAt: { gte: new Date(startDate) } },
      ];
    } else if (endDate) {
      where.OR = [
        { checkInTime: { lte: new Date(endDate + "T23:59:59") } },
        { createdAt: { lte: new Date(endDate + "T23:59:59") } },
      ];
    }
  }

  if (user.role === "SalesExecutive") where.hostedBy = user.id;

  const visits = await prisma.customerVisit.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      host: { select: { id: true, name: true } },
    },
    orderBy: { checkInTime: "desc" },
    ...(isExport ? {} : { take: 100 }),
  });

  // Summary metrics per specification
  const total = visits.length;
  const completed = visits.filter((v) => v.status === "COMPLETED").length;
  const missed = visits.filter((v) => v.status === "MISSED").length;
  const planned = visits.filter((v) => v.status === "PLANNED").length;
  const checkedIn = visits.filter((v) => v.status === "CHECKED_IN").length;
  const checkedOut = visits.filter((v) => v.status === "CHECKED_OUT").length;
  const unavailable = visits.filter((v) => v.status === "CUSTOMER_UNAVAILABLE").length;
  const autoCheckedOut = visits.filter((v) => v.status === "AUTO_CHECKED_OUT").length;
  
  // Completion rate: % of Planned that reach Completed (not Missed)
  const plannedTotal = planned + missed + completed; // Total planned visits that have a terminal status
  const completionRate = plannedTotal > 0 ? Math.round((completed / plannedTotal) * 1000) / 10 : 0;
  
  // Total visits by type
  const fieldVisits = visits.filter((v) => v.visitType === "field_visit").length;
  const officeVisits = visits.filter((v) => v.visitType === "office_visit").length;
  
  // Average visit duration, split by type
  const fieldVisitsWithDuration = visits.filter((v) => v.visitType === "field_visit" && v.durationMinutes != null);
  const officeVisitsWithDuration = visits.filter((v) => v.visitType === "office_visit" && v.durationMinutes != null);
  const fieldAvgDuration = fieldVisitsWithDuration.length > 0
    ? Math.round(fieldVisitsWithDuration.reduce((sum, v) => sum + (v.durationMinutes || 0), 0) / fieldVisitsWithDuration.length)
    : 0;
  const officeAvgDuration = officeVisitsWithDuration.length > 0
    ? Math.round(officeVisitsWithDuration.reduce((sum, v) => sum + (v.durationMinutes || 0), 0) / officeVisitsWithDuration.length)
    : 0;
  const avgDuration = visits.filter((v) => v.durationMinutes != null).length > 0
    ? Math.round(visits.reduce((sum, v) => sum + (v.durationMinutes || 0), 0) / visits.filter((v) => v.durationMinutes != null).length)
    : 0;

  // GPS compliance % — field visits where check-in location matched registered site within 500m tolerance
  const fieldVisitsWithGps = visits.filter((v) => v.visitType === "field_visit" && v.gpsAnomaly !== null);
  const gpsCompliant = fieldVisitsWithGps.filter((v) => !v.gpsAnomaly).length;
  const gpsComplianceRate = fieldVisitsWithGps.length > 0 ? Math.round((gpsCompliant / fieldVisitsWithGps.length) * 1000) / 10 : 0;

  // Missed-visit rate per executive
  const visitsByExecutive = visits.reduce((acc, v) => {
    if (!acc[v.hostedBy]) acc[v.hostedBy] = { total: 0, missed: 0 };
    acc[v.hostedBy].total++;
    if (v.status === "MISSED") acc[v.hostedBy].missed++;
    return acc;
  }, {} as Record<string, { total: number; missed: number }>);
  const missedVisitRateByExecutive = Object.entries(visitsByExecutive).map(([executiveId, data]) => ({
    executiveId,
    executiveName: visits.find((v) => v.hostedBy === executiveId)?.host?.name || "Unknown",
    totalPlanned: data.total,
    missed: data.missed,
    missedRate: data.total > 0 ? Math.round((data.missed / data.total) * 1000) / 10 : 0,
  }));

  // Office visits breakdown by host
  const officeVisitsByHost = visits
    .filter((v) => v.visitType === "office_visit")
    .reduce((acc, v) => {
      if (!acc[v.hostedBy]) acc[v.hostedBy] = 0;
      acc[v.hostedBy]++;
      return acc;
    }, {} as Record<string, number>);
  const officeVisitsByHostList = Object.entries(officeVisitsByHost).map(([hostId, total]) => ({
    hostId,
    hostName: visits.find((v) => v.hostedBy === hostId)?.host?.name || "Unknown",
    total,
  }));

  // Key account compliance: key accounts with a visit in the period
  const keyAccounts = await prisma.customer.findMany({
    where: { companyId: user.companyId, deletedAt: null, isKeyAccountV2: true },
    select: { id: true },
  });
  const keyAccountIds = keyAccounts.map((k) => k.id);
  const keyAccountsVisited = new Set(visits.filter((v) => v.status === "COMPLETED" && keyAccountIds.includes(v.customerId)).map((v) => v.customerId));
  const keyAccountComplianceRate = keyAccountIds.length > 0 ? Math.round((keyAccountsVisited.size / keyAccountIds.length) * 1000) / 10 : 0;

  const formattedVisits = visits.map((v) => {
    return {
      id: v.id,
      customerName: v.customer?.name || "—",
      customerCode: v.customer?.customerCode || "—",
      plantLocation: v.plantLocationId || "—",
      purpose: v.purpose || "—",
      plannedDate: v.plannedDate ? new Date(v.plannedDate).toISOString() : v.checkInTime ? new Date(v.checkInTime).toISOString() : null,
      status: v.status,
      visitSummaryPreview: v.meetingSummary ? v.meetingSummary.substring(0, 80) : v.visitSummary ? v.visitSummary.substring(0, 80) : "",
      hostName: v.host?.name || "—",
      checkInTime: v.checkInTime ? new Date(v.checkInTime).toISOString() : null,
      checkOutTime: v.checkOutTime ? new Date(v.checkOutTime).toISOString() : null,
      duration: v.durationMinutes ?? null,
      outcome: v.outcomeType || v.outcome || null,
    };
  });

  return NextResponse.json({
    success: true,
    summary: { 
      total, 
      planned, 
      checkedIn, 
      checkedOut, 
      completed, 
      missed, 
      unavailable, 
      autoCheckedOut,
      completionRate, 
      avgDuration,
      fieldVisits,
      officeVisits,
      fieldAvgDuration,
      officeAvgDuration,
      gpsComplianceRate,
      missedVisitRateByExecutive,
      officeVisitsByHost: officeVisitsByHostList,
      keyAccountComplianceRate 
    },
    visits: formattedVisits,
  });
}
