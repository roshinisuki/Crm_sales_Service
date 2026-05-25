// ─── Prisma Configuration ─────────────────────────────────────────────────────
// Automatically selects the correct schema based on the DB_PROVIDER env var:
//
//   DB_PROVIDER=mysql       → prisma/schema.mysql.prisma     (local development)
//   DB_PROVIDER=sqlserver   → prisma/schema.sqlserver.prisma  (production)
//
// If DB_PROVIDER is not set, falls back to "mysql" (safe for local dev).
//
// Usage:
//   npx prisma generate           (uses DB_PROVIDER from .env)
//   npx prisma migrate dev        (MySQL)
//   npx prisma migrate deploy     (SQL Server in CI/CD)

import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

const provider = process.env.DB_PROVIDER ?? "mysql";

const schemaMap: Record<string, string> = {
  mysql: "prisma/schema.mysql.prisma",
  sqlserver: "prisma/schema.sqlserver.prisma",
};

const schemaPath = schemaMap[provider];

if (!schemaPath) {
  throw new Error(
    `[prisma.config.ts] Unknown DB_PROVIDER="${provider}". ` +
      `Supported values: "mysql" (local dev) | "sqlserver" (production).`
  );
}

console.log(
  `[Prisma] Using schema: ${schemaPath} (DB_PROVIDER="${provider}")`
);

export default defineConfig({
  schema: schemaPath,
  migrations: {
    // Migrations are stored per-provider so they don't conflict
    path: `prisma/migrations/${provider}`,
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
