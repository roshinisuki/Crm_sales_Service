import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const docs = await p.cRMDocument.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      documentCode: true,
      documentType: true,
      customerId: true,
      isCurrent: true,
      parentDocumentId: true,
      revisionNumber: true,
      entityType: true,
      entityId: true,
    },
  });

  console.log("Total docs:", docs.length);
  console.log("With customerId:", docs.filter((d) => d.customerId).length);
  console.log("Without customerId:", docs.filter((d) => !d.customerId).length);

  const byType: Record<string, number> = {};
  docs.forEach((d) => { byType[d.documentType] = (byType[d.documentType] || 0) + 1; });
  console.log("By type:", byType);

  const byTypeWithCustomer: Record<string, number> = {};
  docs.filter((d) => d.customerId).forEach((d) => { byTypeWithCustomer[d.documentType] = (byTypeWithCustomer[d.documentType] || 0) + 1; });
  console.log("By type (with customerId):", byTypeWithCustomer);

  console.log("isCurrent=true:", docs.filter((d) => d.isCurrent).length);
  console.log("isCurrent=false:", docs.filter((d) => !d.isCurrent).length);

  console.log("\n--- Docs WITHOUT customerId ---");
  docs.filter((d) => !d.customerId).forEach((d) => {
    console.log(`  ${d.documentCode} | type=${d.documentType} | entity=${d.entityType}/${d.entityId} | isCurrent=${d.isCurrent}`);
  });

  console.log("\n--- Docs WITH customerId ---");
  docs.filter((d) => d.customerId).forEach((d) => {
    console.log(`  ${d.documentCode} | type=${d.documentType} | customer=${d.customerId} | isCurrent=${d.isCurrent} | rev=${d.revisionNumber} | parent=${d.parentDocumentId ?? "none"}`);
  });

  await p.$disconnect();
})();
