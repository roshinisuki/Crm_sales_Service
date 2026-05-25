// ─── Prisma Client Singleton ──────────────────────────────────────────────────
// Works with both MySQL (local dev) and MS SQL Server (production).
// The correct DB is determined by DB_PROVIDER + DATABASE_URL in your .env file.
//
// In development (DB_PROVIDER=mysql):
//   Enables query logging and re-uses a single client across HMR reloads.
// In production (DB_PROVIDER=sqlserver):
//   Creates a single instance without logging.

import { PrismaClient } from "@prisma/client";

const isDev = process.env.NODE_ENV !== "production";

function createPrismaClient() {
  return new PrismaClient({
    log: isDev ? ["query", "warn", "error"] : ["error"],
  });
}

// Prevent multiple instances during Next.js Hot Module Replacement in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (isDev) globalForPrisma.prisma = prisma;
