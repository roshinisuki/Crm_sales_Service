import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/quotations/export?status=Draft&search=...
// Exports quotations as CSV
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: any = { deletedAt: null, companyId: user.companyId };
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { quotationCode: { contains: search } },
      { customer: { name: { contains: search } } },
    ];
  }

  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      customer: { select: { name: true, customerCode: true } },
      contact: { select: { name: true } },
      createdBy: { select: { name: true } },
      assignedUser: { select: { name: true } },
      deal: { select: { dealName: true } },
      rfq: { select: { rfqCode: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Quotation Code",
    "Revision",
    "Customer",
    "Customer Code",
    "Contact",
    "Status",
    "Subtotal",
    "Discount %",
    "Tax Amount",
    "Final Amount",
    "Valid Until",
    "Sent At",
    "Accepted At",
    "Rejected At",
    "Linked RFQ",
    "Linked Deal",
    "Items Count",
    "Created By",
    "Assigned To",
    "Created At",
  ];

  const rows = quotations.map((q) => [
    q.quotationCode,
    `R${q.revisionNumber || 1}`,
    q.customer?.name || "",
    q.customer?.customerCode || "",
    q.contact?.name || "",
    q.status,
    String(q.subtotal?.toFixed(2) || "0.00"),
    String(q.discountPercent || 0),
    String(q.taxAmount?.toFixed(2) || "0.00"),
    String(q.finalAmount?.toFixed(2) || "0.00"),
    q.validUntil ? new Date(q.validUntil).toISOString().split("T")[0] : "",
    q.sentAt ? new Date(q.sentAt).toISOString().split("T")[0] : "",
    q.acceptedAt ? new Date(q.acceptedAt).toISOString().split("T")[0] : "",
    q.rejectedAt ? new Date(q.rejectedAt).toISOString().split("T")[0] : "",
    q.rfq?.rfqCode || "",
    q.deal?.dealName || "",
    String(q._count?.items || 0),
    q.createdBy?.name || "",
    q.assignedUser?.name || "",
    new Date(q.createdAt).toISOString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quotations-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
