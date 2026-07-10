const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.rFQ.findMany({ include: { lineItems: true } })
  .then(r => console.log(r.map(x => ({ id: x.id, code: x.rfqCode, createdAt: x.createdAt, items: x.lineItems.length, status: x.status }))))
  .finally(() => p.$disconnect());
