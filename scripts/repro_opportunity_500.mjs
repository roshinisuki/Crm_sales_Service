import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEAL_ID = "669e1958-53cb-4f87-857c-66c23b9b7248";

async function main() {
  try {
    console.log("=== Reproducing GET /api/opportunities/[id] query ===");
    console.log("Deal ID:", DEAL_ID);

    // First: does the deal exist at all?
    const exists = await prisma.deal.findUnique({
      where: { id: DEAL_ID },
      select: {
        id: true,
        dealName: true,
        customerId: true,
        companyId: true,
        deletedAt: true,
        lostReasonRefId: true,
        assignedUserId: true,
      },
    });
    console.log("\n--- Deal row (raw) ---");
    console.log(JSON.stringify(exists, null, 2));

    if (!exists) {
      console.log("\nDeal not found — 500 is NOT a query error, it's a 404 path. Check the route handler.");
      return;
    }

    // Now run the EXACT query from the route handler (without companyId filter to isolate)
    console.log("\n--- Running full include query (no companyId filter) ---");
    const deal = await prisma.deal.findFirst({
      where: { id: DEAL_ID, deletedAt: null },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true, email: true, city: true, status: true },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
        opportunityDetail: true,
        opportunityContacts: {
          include: {
            contact: { select: { id: true, name: true, designation: true, email: true, phone: true, company: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
        stageHistories: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
        quotations: {
          select: {
            id: true, quotationCode: true, status: true, finalAmount: true,
            validUntil: true, pdfUrl: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: "desc" },
        },
        lostReasonRef: { select: { id: true, name: true } },
        _count: { select: { quotations: true, tasks: true } },
      },
    });
    console.log("\n--- Full query SUCCESS ---");
    console.log("dealName:", deal?.dealName);
    console.log("keys:", Object.keys(deal || {}));

    // Second query: RFQs
    console.log("\n--- Running RFQ query ---");
    const rfqs = await prisma.rFQ.findMany({
      where: { customerId: deal.customerId, deletedAt: null },
      select: {
        id: true, rfqCode: true, status: true, priority: true,
        customerDueDate: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.log("RFQs:", rfqs.length, "rows");
    console.log("\n=== ALL QUERIES PASSED — root cause is NOT the Prisma query ===");
    console.log("=> Likely auth/session (companyId null) or Prisma client out of sync in Next runtime.");
  } catch (err) {
    console.error("\n=== QUERY ERROR REPRODUCED ===");
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Full:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
