import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Try querying with a column that should exist to see which ones are missing
try {
  // Test: try selecting nextFollowUpDate from OpportunityDetail
  const result = await prisma.$queryRaw`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'OpportunityDetail' 
    ORDER BY ORDINAL_POSITION
  `;
  console.log("OpportunityDetail columns in DB:");
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Error querying OpportunityDetail schema:", e.message);
}

await prisma.$disconnect();
