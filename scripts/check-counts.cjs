const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const c = await p.customer.count();
  const d = await p.deal.count();
  const q = await p.quotation.count();
  const po = await p.purchaseOrder.count();
  console.log("Customers:", c);
  console.log("Deals:", d);
  console.log("Quotations:", q);
  console.log("POs:", po);
  await p.$disconnect();
})().catch((e) => console.error(e));
