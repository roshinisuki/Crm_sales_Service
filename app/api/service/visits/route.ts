import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    const { searchParams } = new URL(request.url);
    const engineerId = searchParams.get("engineerId");
    const statusId = searchParams.get("statusId");
    const customerId = searchParams.get("customerId");
    const customerAssetId = searchParams.get("customerAssetId");
    const requestId = searchParams.get("requestId");
    const complaintId = searchParams.get("complaintId");
    const defectId = searchParams.get("defectId");
    const installationId = searchParams.get("installationId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    
    let whereClause: any = {};
    if (user && user.role === "ServiceEngineer") {
      const eng = await prisma.serviceEngineer.findFirst({
        where: { userId: user.id }
      });
      if (eng) {
        whereClause.engineerId = eng.id;
      } else {
        // Engineer not found for this user, return empty list
        return NextResponse.json([]);
      }
    } else if (engineerId) {
      whereClause.engineerId = engineerId;
    }
    if (statusId) whereClause.statusId = statusId;
    if (customerId) whereClause.customerId = customerId;
    if (customerAssetId) whereClause.customerAssetId = customerAssetId;
    if (requestId) whereClause.requestId = requestId;
    if (complaintId) whereClause.complaintId = complaintId;
    if (defectId) whereClause.defectId = defectId;
    if (installationId) whereClause.installationId = installationId;
    if (dateFrom || dateTo) {
      whereClause.scheduledDate = {};
      if (dateFrom) whereClause.scheduledDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.scheduledDate.lte = new Date(dateTo);
    }

    const visits = await prisma.serviceVisit.findMany({
      where: whereClause,
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
      },
      orderBy: { scheduledDate: "desc" },
    });

    return NextResponse.json(visits);
  } catch (error: any) {
    console.error("Error fetching visits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      notes,
      statusId,
      engineerId,
      scheduledDate,
      customerId,
      customerAssetId,
      requestId,
      complaintId,
      defectId,
      installationId,
      createdById,
    } = body;

    if (!statusId || !engineerId) {
      return NextResponse.json({ error: "Missing required fields: statusId, engineerId" }, { status: 400 });
    }

    // Default to a real user if none provided
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        finalCreatedById = firstUser.id;
      }
    }

    // If source record is linked and customerId/customerAssetId not provided, derive from source
    let finalCustomerId = customerId;
    let finalCustomerAssetId = customerAssetId;
    if ((!finalCustomerId || !finalCustomerAssetId) && (requestId || complaintId || defectId || installationId)) {
      if (requestId) {
        const req = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { customerId: true, customerAssetId: true } });
        if (req) { finalCustomerId = finalCustomerId || req.customerId; finalCustomerAssetId = finalCustomerAssetId || req.customerAssetId; }
      } else if (complaintId) {
        const comp = await prisma.complaint.findUnique({ where: { id: complaintId }, select: { customerId: true, customerAssetId: true } });
        if (comp) { finalCustomerId = finalCustomerId || comp.customerId; finalCustomerAssetId = finalCustomerAssetId || comp.customerAssetId; }
      } else if (defectId) {
        const def = await prisma.defect.findUnique({ where: { id: defectId }, select: { customerId: true, customerAssetId: true } });
        if (def) { finalCustomerId = finalCustomerId || def.customerId; finalCustomerAssetId = finalCustomerAssetId || def.customerAssetId; }
      } else if (installationId) {
        const inst = await prisma.installation.findUnique({ where: { id: installationId }, select: { customerId: true, customerAssetId: true } });
        if (inst) { finalCustomerId = finalCustomerId || inst.customerId; finalCustomerAssetId = finalCustomerAssetId || inst.customerAssetId; }
      }
    }

    const visitTitle = title || "Service Visit";

    const newVisit = await prisma.serviceVisit.create({
      data: {
        title: visitTitle,
        notes,
        statusId,
        engineerId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        customerId: finalCustomerId,
        customerAssetId: finalCustomerAssetId,
        requestId,
        complaintId,
        defectId,
        installationId,
        createdById: finalCreatedById,
      },
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
      }
    });

    return NextResponse.json(newVisit);
  } catch (error: any) {
    console.error("Error creating visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
