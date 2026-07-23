// Server-only module guard — enforces module access in API routes.
// This file is kept separate from lib/modules.ts so that client
// components can import hasModule() without pulling in next/server.

import { NextResponse } from "next/server";
import { hasModule, ModuleCheckSubject } from "@/lib/modules";
import { isModuleEnforced } from "@/lib/config/moduleEnforcement";
import { ModuleKey } from "@/lib/config/moduleVariantMap";

export { hasModule, logShadowGuard } from "@/lib/modules";

/**
 * Phase 6 enforcement guard for API routes.
 *
 * If the module is listed in ENFORCED_MODULES and the subject lacks access,
 * returns a 403 NextResponse (caller must return it immediately).
 *
 * If the module is NOT yet enforced, falls through to logShadowGuard and
 * returns null — caller should continue normally.
 */
export function enforceModuleGuard(
  subject: ModuleCheckSubject | null | undefined,
  moduleKey: ModuleKey,
  routeLabel: string,
): NextResponse | null {
  if (!isModuleEnforced(moduleKey)) {
    if (!hasModule(subject, moduleKey)) {
      console.warn(`[module-guard-shadow] Company ${subject?.companyId ?? "unknown"} would be blocked from ${routeLabel} (module: ${moduleKey})`);
    }
    return null;
  }

  if (!hasModule(subject, moduleKey)) {
    console.warn(`[module-guard-enforced] Company ${subject?.companyId ?? "unknown"} blocked from ${routeLabel} (module: ${moduleKey})`);
    return NextResponse.json(
      { success: false, message: "This feature is not included in your current plan." },
      { status: 403 },
    );
  }

  return null;
}
