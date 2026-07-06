import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const indexes: any = await prisma.$queryRawUnsafe(`
    SELECT 
        t.name AS TableName,
        ind.name AS IndexName,
        col.name AS ColumnName,
        ind.is_unique AS IsUnique,
        ind.is_primary_key AS IsPrimaryKey
    FROM 
        sys.indexes ind 
    INNER JOIN 
        sys.index_columns ic ON  ind.object_id = ic.object_id and ind.index_id = ic.index_id 
    INNER JOIN 
        sys.columns col ON ic.object_id = col.object_id and ic.column_id = col.column_id 
    INNER JOIN 
        sys.tables t ON ind.object_id = t.object_id 
    WHERE 
        t.name = 'Company'
  `);
  console.log("Indexes on Company:", JSON.stringify(indexes, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
