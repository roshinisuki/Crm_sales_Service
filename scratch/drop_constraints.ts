import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching default constraints for CRMDocument...");
  
  const constraints: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      dc.name AS constraint_name,
      c.name AS column_name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_column_id = c.column_id
      AND dc.parent_object_id = c.object_id
    WHERE dc.parent_object_id = OBJECT_ID('CRMDocument')
  `);

  console.log("Found constraints:", constraints);

  for (const row of constraints) {
    console.log(`Dropping constraint ${row.constraint_name} on column ${row.column_name}...`);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE [CRMDocument] DROP CONSTRAINT [${row.constraint_name}]
    `);
  }

  console.log("All default constraints on CRMDocument dropped successfully!");
}

main()
  .catch((e) => {
    console.error("Error executing script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
