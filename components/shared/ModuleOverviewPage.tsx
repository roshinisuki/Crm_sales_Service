"use client";

import React from "react";
import { PageShell } from "@/components/ui/PageShell";
import { StatusFilterBar, type StatusOption } from "./StatusFilterBar";
import { cn } from "@/lib/ui-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleOverviewPageProps {
  /** Module name used as the page heading (e.g. "Pipeline", "Deals") — never "Overview" */
  title: string;
  subtitle?: string;
  /** Role-based action buttons rendered top-right */
  actions?: React.ReactNode;
  /** Status options for the filter bar (without "Overview" — it's auto-prepended) */
  statusOptions: StatusOption[];
  /** Called when the active status filter changes. "" = Overview (no filter). */
  onStatusChange?: (value: string) => void;
  /** URL param key for status (default: "status") */
  statusParamKey?: string;
  /** Optional base path for URL updates (default: current pathname) */
  basePath?: string;
  /** Search value */
  search?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder (default: "Search...") */
  searchPlaceholder?: string;
  /** Whether the table is currently loading */
  loading?: boolean;
  /** Error message if fetch failed */
  error?: string;
  /** Retry handler for error state */
  onRetry?: () => void;
  /** Empty state message (already module-aware, e.g. "No deals found") */
  emptyMessage?: string;
  /** Whether the data is empty (not loading, not error) */
  isEmpty?: boolean;
  /** Children: the table + pagination content */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
}

// ─── Table State Helpers ──────────────────────────────────────────────────────

function TableLoadingState({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </td>
    </tr>
  );
}

function TableErrorState({ colSpan, message, onRetry }: { colSpan: number; message: string; onRetry?: () => void }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-rose-600">{message}</p>
          {onRetry && (
            <button onClick={onRetry} className="btn-secondary text-xs">
              Retry
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TableEmptyState({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-500">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModuleOverviewPage({
  title,
  subtitle,
  actions,
  statusOptions,
  onStatusChange,
  statusParamKey = "status",
  basePath,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  loading,
  error,
  onRetry,
  emptyMessage,
  isEmpty,
  children,
  className,
}: ModuleOverviewPageProps) {
  return (
    <PageShell title={title} subtitle={subtitle} action={actions}>
      <div className={cn("space-y-4", className)}>
        {/* Status Filter Bar */}
        <StatusFilterBar
          statuses={statusOptions}
          onStatusChange={onStatusChange}
          paramKey={statusParamKey}
          basePath={basePath}
        />

        {/* Search Bar */}
        {onSearchChange && (
          <div className="relative max-w-sm">
            <svg
              width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
        )}

        {/* Table Content (children render the table + pagination) */}
        {children}
      </div>
    </PageShell>
  );
}

// ─── Exported table state helpers for use inside children ──────────────────────

export { TableLoadingState, TableErrorState, TableEmptyState };
