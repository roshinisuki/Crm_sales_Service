// Phase 6 enforcement control.
//
// Modules listed here are ENFORCED — requests from companies that lack
// the module will receive a 403 response.  Modules NOT listed here
// remain in shadow mode (log-only, no blocking).
//
// To enable enforcement for a module, add its key to the Set below.
// To revert (disable enforcement), remove it.  This is the single
// switch for per-module rollout / rollback.
//
// Default: empty set → all modules still in shadow mode → zero behavior change.

import { ModuleKey, MODULE_KEYS } from "./moduleVariantMap";

export const ENFORCED_MODULES: Set<ModuleKey> = new Set<ModuleKey>(
  Object.values(MODULE_KEYS)
);

export function isModuleEnforced(moduleKey: ModuleKey): boolean {
  return ENFORCED_MODULES.has(moduleKey);
}
