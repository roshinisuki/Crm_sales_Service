// Phase 3: hasModule() helper — NOT wired into any route/action/page yet.
// This file is intentionally unused dead code at this point in the rollout
// (see implementation plan). It exists so later phases can import it without
// introducing behavior changes in the same step that adds the function.
//
// Fail-open design: if the caller has no `enabledModules` data (e.g. session
// issued before Phase 4, or field missing/malformed), this falls back to the
// exact same variant-based logic the sidebar already uses today
// (isVariant2/3/4), so behavior is byte-identical either way until this is
// deliberately enforced in Phase 6.

import { getModulesForVariant, ModuleKey } from "@/lib/config/moduleVariantMap";

export interface ModuleCheckSubject {
  companyId?: string | null;
  variant?: number | null;
  enabledModules?: string | string[] | null;
}

function parseEnabledModules(raw: string | string[] | null | undefined): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the given user/company subject has access to `moduleKey`.
 * Core modules (Leads, Accounts, Contacts, Activities, Sales Pipeline,
 * Quotations, Tasks, Follow Ups, Reports, Dashboards) are NOT covered by
 * this helper — they remain gated only by role/permission checks (hasPerm),
 * exactly as today.
 */
export function hasModule(subject: ModuleCheckSubject | null | undefined, moduleKey: ModuleKey): boolean {
  if (!subject) return false;

  const parsed = parseEnabledModules(subject.enabledModules);
  if (parsed !== null) {
    return parsed.includes(moduleKey);
  }

  // Fail-open fallback: no enabledModules data yet, use the current
  // variant-based logic so behavior matches the existing sidebar exactly.
  const variant = subject.variant ?? 1;
  return getModulesForVariant(variant).includes(moduleKey);
}

/**
 * Phase 5 shadow-mode helper: logs a warning if the subject would be
 * blocked from `moduleKey`, but never throws/blocks. Safe to call
 * unconditionally at the top of any route/action handler.
 */
export function logShadowGuard(subject: ModuleCheckSubject | null | undefined, moduleKey: ModuleKey, routeLabel: string): void {
  if (!hasModule(subject, moduleKey)) {
    console.warn(`[module-guard-shadow] Company ${subject?.companyId ?? "unknown"} would be blocked from ${routeLabel} (module: ${moduleKey})`);
  }
}

// enforceModuleGuard has moved to lib/moduleGuard.ts (server-only) to keep
// this file client-safe for sidebar imports.
