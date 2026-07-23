// Single source of truth mapping each CRM variant preset to the add-on
// module keys it includes. Mirrors the isVariant2 / isVariant3 / isVariant4
// gating currently in app/(dashboard)/layout.tsx (SidebarContent), so that
// hasModule() can stay behavior-identical to the existing sidebar logic
// until the sidebar itself is cut over (Phase 7).
//
// NOTE: This list is CUMULATIVE per variant (a Variant 3 company gets
// everything Variant 2 has, plus its own additions) — matching the
// `isVariant2/3/4` boolean (>=) checks already in the sidebar.

export const MODULE_KEYS = {
  MANAGER_DASHBOARD: "manager_dashboard",
  CUSTOMER_VISITS: "customer_visits",
  PRODUCT_CATALOGUE: "product_catalogue",
  RFQ: "rfq",
  SAMPLE_MANAGEMENT: "sample_management",
  NEGOTIATION: "negotiation",
  DOCUMENTS: "documents",
  APPROVAL_CENTER: "approval_center",
  COMPETITORS: "competitors",
  DEALS: "deals",
  PURCHASE_ORDERS: "purchase_orders",
  CUSTOMER_ASSETS: "customer_assets",
  KEY_ACCOUNTS: "key_accounts",
  TERRITORIES: "territories",
  TARGETS: "targets",
  FORECAST: "forecast",
} as const;

export type ModuleKey = typeof MODULE_KEYS[keyof typeof MODULE_KEYS];

// Modules added at each variant tier (not cumulative — see getModulesForVariant)
const VARIANT_ADDITIONS: Record<number, ModuleKey[]> = {
  1: [],
  2: [
    MODULE_KEYS.MANAGER_DASHBOARD,
    MODULE_KEYS.CUSTOMER_VISITS,
    MODULE_KEYS.PRODUCT_CATALOGUE,
    MODULE_KEYS.RFQ,
  ],
  3: [
    MODULE_KEYS.SAMPLE_MANAGEMENT,
    MODULE_KEYS.NEGOTIATION,
    MODULE_KEYS.DOCUMENTS,
    MODULE_KEYS.APPROVAL_CENTER,
  ],
  4: [
    MODULE_KEYS.COMPETITORS,
    MODULE_KEYS.DEALS,
    MODULE_KEYS.PURCHASE_ORDERS,
    MODULE_KEYS.CUSTOMER_ASSETS,
    MODULE_KEYS.KEY_ACCOUNTS,
    MODULE_KEYS.TERRITORIES,
    MODULE_KEYS.TARGETS,
    MODULE_KEYS.FORECAST,
  ],
};

// Returns the full cumulative module list for a given variant (1-4).
export function getModulesForVariant(variant: number): ModuleKey[] {
  const v = Math.max(1, Math.min(4, Number(variant) || 1));
  const modules: ModuleKey[] = [];
  for (let i = 1; i <= v; i++) {
    modules.push(...(VARIANT_ADDITIONS[i] || []));
  }
  return modules;
}
