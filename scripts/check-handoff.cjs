const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Check approved POs
  const approvedPOs = await p.purchaseOrder.findMany({
    where: { status: "Approved" },
    select: { id: true, poCode: true, customerId: true, dealId: true, status: true },
    take: 10,
  });
  console.log("=== Approved POs ===");
  console.log(JSON.stringify(approvedPOs, null, 2));

  // Check all POs and their statuses
  const allPOs = await p.purchaseOrder.findMany({
    select: { id: true, poCode: true, status: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  console.log("\n=== Recent POs (all statuses) ===");
  console.log(JSON.stringify(allPOs, null, 2));

  // Check CustomerAssets
  const assets = await p.customerAsset.findMany({
    take: 10,
    include: {
      customer: { select: { name: true } },
      purchaseOrder: { select: { poCode: true } },
    },
  });
  console.log("\n=== CustomerAssets ===");
  console.log(JSON.stringify(assets, null, 2));

  await p.$disconnect();
})();
