"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/ui-utils";

interface StageAdvanceButtonProps {
  /** Button label, e.g. "Advance to Technical Discussion" */
  label: string;
  /**
   * Reasons that block advancing. When non-empty the button is disabled
   * and the first reason is shown as a tooltip / inline text.
   */
  blockingReasons: string[];
  /**
   * When true, at least one product is marked NotFeasible.
   * Shows an amber warning banner ABOVE the button in addition to disabling it.
   */
  hasNotFeasible?: boolean;
  /** Names of NotFeasible products — used in the warning banner. */
  notFeasibleNames?: string[];
  /** Callback when user clicks and the button is enabled */
  onAdvance: () => void;
  loading?: boolean;
  className?: string;
}

export function StageAdvanceButton({
  label,
  blockingReasons,
  hasNotFeasible = false,
  notFeasibleNames = [],
  onAdvance,
  loading = false,
  className,
}: StageAdvanceButtonProps) {
  const isBlocked = blockingReasons.length > 0;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Not-feasible warning banner */}
      {hasNotFeasible && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 px-3 py-2">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Warning:</strong> The following product{notFeasibleNames.length !== 1 ? "s are" : " is"} marked Not feasible:{" "}
            <strong>{notFeasibleNames.join(", ")}</strong>. Resolve or remove before advancing.
          </p>
        </div>
      )}

      <div
        className="relative inline-flex"
        onMouseEnter={() => isBlocked && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          type="button"
          onClick={!isBlocked && !loading ? onAdvance : undefined}
          disabled={isBlocked || loading}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            isBlocked || loading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
              : "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.98]"
          )}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ArrowRight size={15} />
          )}
          {label}
        </button>

        {/* Tooltip on hover when blocked */}
        {isBlocked && showTooltip && (
          <div className="absolute bottom-full mb-2 left-0 z-50 w-64 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-lg p-2.5 text-xs text-slate-600 dark:text-slate-300 pointer-events-none">
            <p className="font-medium text-slate-800 dark:text-slate-200 mb-1">Cannot advance</p>
            <p>{blockingReasons[0]}</p>
            {blockingReasons.length > 1 && (
              <p className="mt-1 text-slate-400">
                +{blockingReasons.length - 1} more reason{blockingReasons.length - 1 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Inline blocking reason text (accessible, always visible) */}
      {isBlocked && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {blockingReasons[0]}
        </p>
      )}
    </div>
  );
}
