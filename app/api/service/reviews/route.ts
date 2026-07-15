import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const engineerId = searchParams.get("engineerId");
    const sourceType = searchParams.get("sourceType");
    const rating = searchParams.get("rating");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let whereClause: any = {};

    // Service Engineer role restriction
    if (user.role === "ServiceEngineer") {
      const eng = await prisma.serviceEngineer.findFirst({
        where: { userId: user.id }
      });
      if (!eng) {
        return NextResponse.json([]);
      }
      whereClause.engineerId = eng.id;
    } else if (engineerId) {
      whereClause.engineerId = engineerId;
    }

    // Status filtering
    if (status === "Pending") {
      whereClause.status = "Pending";
    } else if (status === "Submitted") {
      whereClause.status = "Submitted";
    } else if (status === "LowRating") {
      whereClause.isEscalation = true;
    }

    // Rating filtering
    if (rating) {
      whereClause.rating = parseInt(rating, 10);
    }

    // Source type filtering
    if (sourceType) {
      if (sourceType === "request") whereClause.serviceRequestId = { not: null };
      else if (sourceType === "complaint") whereClause.complaintId = { not: null };
      else if (sourceType === "defect") whereClause.defectId = { not: null };
      else if (sourceType === "installation") whereClause.installationId = { not: null };
      else if (sourceType === "visit") whereClause.serviceVisitId = { not: null };
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.requestedAt = {};
      if (dateFrom) whereClause.requestedAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.requestedAt.lte = new Date(dateTo);
    }

    const reviews = await prisma.serviceReview.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true } },
        engineer: { include: { user: { select: { name: true } } } },
        serviceRequest: { select: { id: true } },
        complaint: { select: { id: true } },
        defect: { select: { id: true } },
        installation: { select: { id: true } },
        serviceVisit: { select: { id: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      engineerId,
      serviceRequestId,
      complaintId,
      defectId,
      installationId,
      serviceVisitId,
    } = body;

    if (!customerId || !engineerId) {
      return NextResponse.json({ error: "Missing customerId or engineerId" }, { status: 400 });
    }

    // Enforce exactly one source constraint
    const sourceCount = [serviceRequestId, complaintId, defectId, installationId, serviceVisitId].filter(Boolean).length;
    if (sourceCount !== 1) {
      return NextResponse.json({ error: "Exactly one source record must be specified" }, { status: 400 });
    }

    // Avoid duplicate creation
    const existing = await prisma.serviceReview.findFirst({
      where: {
        OR: [
          ...(serviceRequestId ? [{ serviceRequestId }] : []),
          ...(complaintId ? [{ complaintId }] : []),
          ...(defectId ? [{ defectId }] : []),
          ...(installationId ? [{ installationId }] : []),
          ...(serviceVisitId ? [{ serviceVisitId }] : []),
        ]
      }
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const review = await prisma.serviceReview.create({
      data: {
        customerId,
        engineerId,
        serviceRequestId: serviceRequestId || null,
        complaintId: complaintId || null,
        defectId: defectId || null,
        installationId: installationId || null,
        serviceVisitId: serviceVisitId || null,
        status: "Pending",
      },
    });

    return NextResponse.json(review);
  } catch (error: any) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
