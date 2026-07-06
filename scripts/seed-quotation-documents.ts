import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const quotations = await p.quotation.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      quotationCode: true,
      customerId: true,
      dealId: true,
      rfqId: true,
      companyId: true,
    },
  });

  console.log(`Found ${quotations.length} quotations. Creating document records...\n`);

  // Get the first user to use as uploader
  const adminUser = await p.user.findFirst({
    where: { role: "Admin" },
    select: { id: true, name: true, companyId: true },
  });

  if (!adminUser) {
    console.error("No admin user found!");
    process.exit(1);
  }

  console.log(`Using admin user: ${adminUser.name} (${adminUser.id})\n`);

  let created = 0;
  let revisionsCreated = 0;

  for (const quot of quotations) {
    if (!quot.customerId) {
      console.log(`  SKIP ${quot.quotationCode} — no customerId`);
      continue;
    }

    const companyId = quot.companyId || adminUser.companyId;
    if (!companyId) {
      console.log(`  SKIP ${quot.quotationCode} — no companyId`);
      continue;
    }

    const year = new Date().getFullYear();
    const lastDoc = await p.cRMDocument.findFirst({
      where: { companyId, documentCode: { startsWith: `DOC-${year}-` } },
      orderBy: { createdAt: "desc" },
      select: { documentCode: true },
    });
    const nextNum = lastDoc?.documentCode
      ? parseInt(lastDoc.documentCode.split("-")[2] ?? "0") + 1
      : 1;
    const documentCode = `DOC-${year}-${String(nextNum).padStart(5, "0")}`;

    // Create the original quotation document (R1)
    const doc = await p.cRMDocument.create({
      data: {
        documentCode,
        name: `Quotation — ${quot.quotationCode}`,
        documentType: "Quotation",
        entityType: "Quotation",
        entityId: quot.id,
        fileUrl: `/uploads/documents/placeholder-quotation.pdf`,
        fileSize: 245000,
        mimeType: "application/pdf",
        uploadedById: adminUser.id,
        customerId: quot.customerId,
        companyId,
        parentDocumentId: null,
        revisionNumber: 1,
        isCurrent: true,
      },
    });

    created++;
    console.log(`  ✓ ${documentCode} | Quotation | ${quot.quotationCode} | customer: ${quot.customerId}`);

    // For every 3rd quotation, create a revision (R2) to demonstrate versioning
    if (created % 3 === 0) {
      const revDocCode = `DOC-${year}-${String(nextNum + 1).padStart(5, "0")}`;

      // Mark R1 as non-current
      await p.cRMDocument.update({
        where: { id: doc.id },
        data: { isCurrent: false },
      });

      // Create R2 as current
      await p.cRMDocument.create({
        data: {
          documentCode: revDocCode,
          name: `Quotation — ${quot.quotationCode}`,
          documentType: "Quotation",
          entityType: "Quotation",
          entityId: quot.id,
          fileUrl: `/uploads/documents/placeholder-quotation-v2.pdf`,
          fileSize: 258000,
          mimeType: "application/pdf",
          uploadedById: adminUser.id,
          customerId: quot.customerId,
          companyId,
          parentDocumentId: doc.id,
          revisionNumber: 2,
          isCurrent: true,
        },
      });

      revisionsCreated++;
      console.log(`    ↳ Created R2 revision (${revDocCode}) — R1 marked as non-current`);
    }
  }

  console.log(`\nDone! Created ${created} quotation documents, ${revisionsCreated} with R2 revisions.`);

  // Verify
  const allDocs = await p.cRMDocument.findMany({
    where: { deletedAt: null },
    select: { documentType: true, isCurrent: true, revisionNumber: true, parentDocumentId: true },
  });
  const byType: Record<string, number> = {};
  allDocs.forEach((d) => { byType[d.documentType] = (byType[d.documentType] || 0) + 1; });
  console.log("\nDocument counts by type:", byType);
  console.log("Total current revisions:", allDocs.filter((d) => d.isCurrent).length);
  console.log("Total old revisions:", allDocs.filter((d) => !d.isCurrent).length);

  await p.$disconnect();
})();
