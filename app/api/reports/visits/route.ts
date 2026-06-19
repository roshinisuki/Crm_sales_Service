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
    else if (status === "Completed") where.status = "COMPLETED";
    else if (status === "Missed") where.status = "MISSED";
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

  // Summary
  const total = visits.length;
  const completed = visits.filter((v) => v.status === "COMPLETED").length;
  const missed = visits.filter((v) => v.status === "MISSED").length;
  const planned = visits.filter((v) => v.status === "PLANNED").length;

  let avgDuration = 0;
  const completedVisits = visits.filter((v) => v.status === "COMPLETED" && v.checkInTime && v.checkOutTime);
  if (completedVisits.length > 0) {
    const totalMinutes = completedVisits.reduce((sum, v) => {
      const diff = new Date(v.checkOutTime!).getTime() - new Date(v.checkInTime).getTime();
      return sum + diff / (1000 * 60);
    }, 0);
    avgDuration = Math.round(totalMinutes / completedVisits.length);
  }

  const formattedVisits = visits.map((v) => {
    let duration: number | null = null;
    if (v.status === "COMPLETED" && v.checkInTime && v.checkOutTime) {
      duration = Math.round((new Date(v.checkOutTime).getTime() - new Date(v.checkInTime).getTime()) / (1000 * 60));
    }
    return {
      id: v.id,
      customerName: v.customer?.name || "—",
      customerCode: v.customer?.customerCode || "—",
      hostName: v.host?.name || "—",
      purpose: v.purpose,
      meetingType: v.meetingType || "—",
      checkInTime: v.checkInTime ? new Date(v.checkInTime).toISOString() : null,
      checkOutTime: v.checkOutTime ? new Date(v.checkOutTime).toISOString() : null,
      duration,
      outcome: v.outcome || "—",
      customerDecision: v.customerDecision || "—",
      status: v.status,
    };
  });

  return NextResponse.json({
    success: true,
    summary: { total, completed, missed, planned, avgDuration },
    visits: formattedVisits,
  });
}
