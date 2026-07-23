import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/rfq/export?status=New&search=...
// Exports RFQs as CSV
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/export");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: any = { deletedAt: null, companyId: user.companyId };
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { rfqCode: { contains: search } },
      { customer: { name: { contains: search } } },
    ];
  }

  // Role-based filter
  if (user.role === "SalesExecutive" || user.role === "Telecaller") {
    where.assignedUserId = user.id;
  } else if (user.role === "CostingEngineer") {
    where.costingOwnerId = user.id;
  }

  const rfqs = await prisma.rFQ.findMany({
    where,
    include: {
      customer: { select: { name: true, customerCode: true } },
      assignedUser: { select: { name: true } },
      costingOwner: { select: { name: true } },
      lineItems: { select: { id: true, itemDescription: true, quantity: true, unit: true, targetPrice: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "RFQ Code",
    "Customer",
    "Customer Code",
    "Status",
    "Priority",
    "Received Date",
    "Customer Due Date",
    "Assigned To",
    "Costing Owner",
    "Line Items Count",
    "Line Item Descriptions",
    "Created At",
  ];

  const rows = rfqs.map((r) => {
    const lineItemDescs = r.lineItems.map((li) => `${li.itemDescription} (Qty: ${li.quantity} ${li.unit || ""})`).join("; ");
    return [
      r.rfqCode,
      r.customer?.name || "",
      r.customer?.customerCode || "",
      r.status,
      r.priority || "Normal",
      r.receivedDate ? new Date(r.receivedDate).toISOString().split("T")[0] : "",
      r.customerDueDate ? new Date(r.customerDueDate).toISOString().split("T")[0] : "",
      r.assignedUser?.name || "",
      r.costingOwner?.name || "",
      String(r.lineItems.length),
      lineItemDescs,
      new Date(r.createdAt).toISOString(),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  // Prepend UTF-8 BOM for proper Excel rendering of ₹ symbol and special chars
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rfq-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
