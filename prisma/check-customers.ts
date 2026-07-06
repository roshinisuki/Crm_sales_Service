import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // Let's drop the unique constraint or create an index with non-null values if it's SQL Server.
  // In SQL Server, a standard UNIQUE constraint allows only ONE NULL value.
  // So if we have multiple customers with NULL emails, it violations 'Customer_email_key'.
  // This is a known SQL Server behavior. We can fix it by generating unique placeholder emails or drop/recreate the index as a filtered index.
  // Let's inspect the seed file. The seed file should generate unique emails for each customer rather than leaving them NULL!
  console.log("SQL Server UNIQUE constraint 'Customer_email_key' requires unique emails (or non-nulls since standard UNIQUE in SQL Server only allows one NULL).");
}
main().finally(() => p.$disconnect());
