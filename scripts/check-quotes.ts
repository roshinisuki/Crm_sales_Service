import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const quotes = await p.quotation.findMany({
    where: { deletedAt: null },
    select: { id: true, quotationCode: true, customerId: true, dealId: true, rfqId: true },
  });
  console.log("Total quotations:", quotes.length);
  quotes.forEach((q) => console.log("  ", q.quotationCode, "| customer:", q.customerId, "| deal:", q.dealId, "| rfq:", q.rfqId));

  const deals = await p.deal.findMany({
    where: { deletedAt: null },
    select: { id: true, dealName: true, customerId: true, status: true },
  });
  console.log("\nTotal deals:", deals.length);
  deals.forEach((d) => console.log("  ", d.dealName, "| customer:", d.customerId, "| status:", d.status));

  const customers = await p.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, customerCode: true },
  });
  console.log("\nTotal customers:", customers.length);
  customers.forEach((c) => console.log("  ", c.customerCode, c.name));

  await p.$disconnect();
})();
