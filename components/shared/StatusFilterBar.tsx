"use client";

import React, { useRef, useCallback, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/ui-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusOption {
  /** Display label shown to the user */
  label: string;
  /** Backend status value sent to the API. Empty string means "Overview" (no filter). */
  value: string;
  /** Optional record count badge */
  count?: number;
  /** When true, the tab is visible but disabled (permission-restricted) */
  disabled?: boolean;
}

interface StatusFilterBarProps {
  /** Module-specific status options. "Overview" (value: "") is always prepended automatically. */
  statuses: StatusOption[];
  /**
   * Called when the active status changes. The value "" means "Overview" (no status filter).
   * If omitted, the bar manages URL state on its own using `?status={value}`.
   */
  onStatusChange?: (value: string) => void;
  /** Optional className for the container */
  className?: string;
  /** Optional param name for URL state (default: "status") */
  paramKey?: string;
  /** Optional base path for URL updates (default: current pathname) */
  basePath?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StatusFilterBar({
  statuses,
  onStatusChange,
  className,
  paramKey = "status",
  basePath,
}: StatusFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // The active status from URL ("" = Overview / no filter)
  const activeValue = searchParams.get(paramKey) || "";

  // Build the full list with "Overview" prepended
  const allTabs: StatusOption[] = [
    { label: "Overview", value: "" },
    ...statuses,
  ];

  const updateUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramKey, value);
      } else {
        params.delete(paramKey);
      }
      // Preserve other params (search, sort, page, etc.) but reset page
      params.delete("page");
      const path = basePath || window.location.pathname;
      router.push(`${path}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, paramKey, basePath]
  );

  const handleSelect = useCallback(
    (value: string, disabled?: boolean) => {
      if (disabled) return;
      if (onStatusChange) {
        onStatusChange(value);
      }
      updateUrl(value);
    },
    [onStatusChange, updateUrl]
  );

  // ── Keyboard navigation (ARIA tablist pattern) ──────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const enabledIndices = allTabs
        .map((t, i) => (t.disabled ? -1 : i))
        .filter((i) => i >= 0);
      const currentEnabledIdx = enabledIndices.indexOf(index);
      const total = enabledIndices.length;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          nextIndex = enabledIndices[(currentEnabledIdx + 1) % total];
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          nextIndex = enabledIndices[(currentEnabledIdx - 1 + total) % total];
          break;
        case "Home":
          e.preventDefault();
          nextIndex = enabledIndices[0];
          break;
        case "End":
          e.preventDefault();
          nextIndex = enabledIndices[total - 1];
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          e.preventDefault();
          handleSelect(allTabs[index].value, allTabs[index].disabled);
          return;
        default:
          return;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        tabRefs.current[nextIndex]?.focus();
        handleSelect(allTabs[nextIndex].value, allTabs[nextIndex].disabled);
      }
    },
    [allTabs, handleSelect]
  );

  return (
    <div
      role="tablist"
      aria-label="Status filter"
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto scrollbar-thin",
        "border-b border-slate-100 dark:border-slate-800/60",
        "pb-px -mb-px",
        className
      )}
    >
      {allTabs.map((tab, index) => {
        const isActive = activeValue === tab.value;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.value || "__overview"}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => handleSelect(tab.value, tab.disabled)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap",
              "border-b-2 transition-all duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
              isActive
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              isDisabled && "opacity-40 cursor-not-allowed hover:text-slate-500"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-[var(--primary)] text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Helper: useStatusFromUrl ──────────────────────────────────────────────────

/**
 * Hook to read the active status filter from the URL.
 * Returns "" when no filter is applied (Overview state).
 */
export function useStatusFromUrl(paramKey = "status"): string {
  const searchParams = useSearchParams();
  return searchParams.get(paramKey) || "";
}
