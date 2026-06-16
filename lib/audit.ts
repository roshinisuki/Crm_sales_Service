import { prisma } from "@/lib/prisma";

// ─── Severity Levels ─────────────────────────────────────────────────────────
// INFO    : Normal read/create operations
// WARN    : Updates to important data
// HIGH    : Deletions, role changes, status demotions
// CRITICAL: Data exports, auth failures, SLA breaches, security events

export type AuditSeverity = "INFO" | "WARN" | "HIGH" | "CRITICAL";

// ─── Context extracted from Next.js request headers ──────────────────────────
export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ─── Full enriched audit options ─────────────────────────────────────────────
export interface AuditOptions {
  /** ID of the primary entity being changed (lead.id, customer.id, deal.id, etc.) */
  resourceId?: string | null;
  /** Plain object snapshot BEFORE the mutation. Pass null on create. */
  previousState?: Record<string, any> | null;
  /** Plain object snapshot AFTER the mutation. Pass null on delete. */
  newState?: Record<string, any> | null;
  /** Request context: IP address + User-Agent from Next.js headers */
  context?: AuditContext | null;
  /** Severity classification. Defaults to "INFO". */
  severity?: AuditSeverity;
}

/**
 * logAudit — Phase 2 enriched audit logger.
 *
 * Fully backward compatible: existing callers with (userId, module, action, details)
 * continue to work without modification. New callers can pass an options object
 * as the 5th argument to include state-diffs, IP, severity, and resource ID.
 *
 * @example Basic (backward-compat)
 *   await logAudit(userId, "LEADS", "CREATE_LEAD", "Created lead: XYZ");
 *
 * @example Enriched (Phase 2)
 *   const before = { status: "Prospect", name: "Old Name" };
 *   const after  = { status: "ActiveCustomer", name: "New Name" };
 *   await logAudit(userId, "CUSTOMERS", "UPDATE_CUSTOMER", "Status promoted", {
 *     resourceId: customer.id,
 *     previousState: before,
 *     newState: after,
 *     severity: "WARN",
 *     context: extractAuditContext(request),
 *   });
 */
export async function logAudit(
  userId: string | null,
  module: string,
  action: string,
  details?: string,
  options?: AuditOptions
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        module,
        action,
        details,
        resourceId:    options?.resourceId    ?? null,
        previousState: options?.previousState ? JSON.stringify(options.previousState) : undefined,
        newState:      options?.newState ? JSON.stringify(options.newState) : undefined,
        ipAddress:     options?.context?.ipAddress  ?? null,
        userAgent:     options?.context?.userAgent  ?? null,
        severity:      options?.severity ?? "INFO",
      },
    });
  } catch (error) {
    // Never throw — audit failures must not break business logic
    console.error("Failed to log audit event:", error);
  }
}

/**
 * extractAuditContext — Helper to extract IP + User-Agent from a Next.js Request.
 *
 * Supports standard forwarded headers used by Vercel, Nginx, Cloudflare, etc.
 *
 * @example In an API route or server action:
 *   const ctx = extractAuditContext(request);
 *   await logAudit(userId, "LEADS", "CREATE_LEAD", "...", { context: ctx });
 */
export function extractAuditContext(request: Request): AuditContext {
  const headers = request.headers;

  // IP address: Cloudflare → X-Real-IP → X-Forwarded-For → fallback
  const ipAddress =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;

  const userAgent = headers.get("user-agent") || null;

  return { ipAddress, userAgent };
}

/**
 * computeDiff — Computes a field-level diff between two plain objects.
 * Returns only the fields that changed, with their old and new values.
 *
 * Useful for building minimal `previousState` / `newState` payloads
 * that focus only on what actually changed.
 *
 * @example
 *   const { before, after } = computeDiff(
 *     { name: "Old", status: "Prospect", email: "a@b.com" },
 *     { name: "New", status: "Active",   email: "a@b.com" }
 *   );
 *   // before → { name: "Old", status: "Prospect" }
 *   // after  → { name: "New", status: "Active" }
 */
export function computeDiff(
  previous: Record<string, any>,
  updated: Record<string, any>
): { before: Record<string, any>; after: Record<string, any> } {
  const before: Record<string, any> = {};
  const after:  Record<string, any> = {};

  const allKeys = new Set([...Object.keys(previous), ...Object.keys(updated)]);

  for (const key of allKeys) {
    // Skip internal Prisma / Date comparison noise
    const prevVal = previous[key];
    const nextVal = updated[key];

    const prevStr = prevVal instanceof Date ? prevVal.toISOString() : JSON.stringify(prevVal);
    const nextStr = nextVal instanceof Date ? nextVal.toISOString() : JSON.stringify(nextVal);

    if (prevStr !== nextStr) {
      before[key] = prevVal;
      after[key]  = nextVal;
    }
  }

  return { before, after };
}

/**
 * inferSeverity — Infers audit severity from action verb.
 * Use as a convenience helper when you don't want to hardcode severity.
 */
export function inferSeverity(action: string): AuditSeverity {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("revoke") || a.includes("ban"))
    return "HIGH";
  if (a.includes("export") || a.includes("download") || a.includes("breach") || a.includes("fail"))
    return "CRITICAL";
  if (a.includes("update") || a.includes("reassign") || a.includes("transfer"))
    return "WARN";
  return "INFO";
}
