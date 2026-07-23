"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { hasModule, type ModuleCheckSubject } from "@/lib/modules";
import { ModuleKey, MODULE_KEYS } from "@/lib/config/moduleVariantMap";

const MODULE_LABELS: Record<string, string> = {
  [MODULE_KEYS.MANAGER_DASHBOARD]: "Manager Dashboard",
  [MODULE_KEYS.CUSTOMER_VISITS]: "Customer Visits",
  [MODULE_KEYS.PRODUCT_CATALOGUE]: "Product Catalogue",
  [MODULE_KEYS.RFQ]: "RFQ Management",
  [MODULE_KEYS.SAMPLE_MANAGEMENT]: "Sample Management",
  [MODULE_KEYS.NEGOTIATION]: "Negotiation Management",
  [MODULE_KEYS.DOCUMENTS]: "Document Management",
  [MODULE_KEYS.APPROVAL_CENTER]: "Approval Center",
  [MODULE_KEYS.COMPETITORS]: "Competitors",
  [MODULE_KEYS.DEALS]: "Deals",
  [MODULE_KEYS.PURCHASE_ORDERS]: "Purchase Orders",
  [MODULE_KEYS.CUSTOMER_ASSETS]: "Customer Assets",
  [MODULE_KEYS.KEY_ACCOUNTS]: "Key Accounts",
  [MODULE_KEYS.TERRITORIES]: "Territories",
  [MODULE_KEYS.TARGETS]: "Targets",
  [MODULE_KEYS.FORECAST]: "Forecast",
};

/**
 * Wraps children. If the current user's company has the module,
 * renders children normally. If not, renders a lock overlay with
 * an upsell message.
 *
 * Usage:
 * <ModuleGate module={MODULE_KEYS.COMPETITORS}>
 *   <CompetitorIntelligenceTab ... />
 * </ModuleGate>
 */
export function ModuleGate({
  module: moduleKey,
  children,
  fallback,
}: {
  module: ModuleKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();

  const subject: ModuleCheckSubject = {
    companyId: user?.company?.id ?? null,
    variant: user?.variant ?? user?.company?.variant ?? null,
    enabledModules: user?.enabledModules ?? user?.company?.enabledModules ?? null,
  };

  if (hasModule(subject, moduleKey)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const label = MODULE_LABELS[moduleKey] ?? moduleKey;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
      <Lock size={24} className="text-slate-400 mb-2" />
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Available in the {label} module.
      </p>
      <a
        href="/settings"
        className="text-xs font-medium text-[var(--primary)] hover:underline mt-2"
      >
        Upgrade or enable module →
      </a>
    </div>
  );
}

/**
 * For collapsible sections — shows the header (title + icon) so the user
 * knows the feature exists, but the body is a lock overlay.
 *
 * Usage:
 * <LockedSection title="Competitor Intelligence" icon={<Swords size={15} />} moduleKey={MODULE_KEYS.COMPETITORS}>
 *   <CompetitorIntelligenceTab ... />
 * </LockedSection>
 */
export function LockedSection({
  title,
  subtitle,
  icon,
  moduleKey,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  moduleKey: ModuleKey;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { user } = useAuth();

  const subject: ModuleCheckSubject = {
    companyId: user?.company?.id ?? null,
    variant: user?.variant ?? user?.company?.variant ?? null,
    enabledModules: user?.enabledModules ?? user?.company?.enabledModules ?? null,
  };

  if (hasModule(subject, moduleKey)) {
    return <>{children}</>;
  }

  const label = MODULE_LABELS[moduleKey] ?? moduleKey;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            {title}
            <Lock size={14} className="text-slate-400" />
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[100px]">
        <Lock size={20} className="text-slate-400 mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Available in the {label} module.
        </p>
        <a
          href="/settings"
          className="text-xs font-medium text-[var(--primary)] hover:underline mt-2"
        >
          Enable {label} module →
        </a>
      </div>
    </div>
  );
}

/**
 * Hook for use in client components to check module access.
 * Returns a function: const hasMod = useHasModule(); hasMod(MODULE_KEYS.X)
 */
export function useHasModule() {
  const { user } = useAuth();

  const subject: ModuleCheckSubject = {
    companyId: user?.company?.id ?? null,
    variant: user?.variant ?? user?.company?.variant ?? null,
    enabledModules: user?.enabledModules ?? user?.company?.enabledModules ?? null,
  };

  return (moduleKey: ModuleKey) => hasModule(subject, moduleKey);
}
