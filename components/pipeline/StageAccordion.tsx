"use client";

import { ReactNode } from "react";
import { ChevronDown, CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export type StageAccordionState = "completed" | "active" | "future";

interface StageAccordionProps {
  /** Pipeline stage key, e.g. "RequirementGathering" */
  stage: string;
  /** Display label shown in the accordion header */
  label: string;
  /** completed = done, active = current stage, future = not yet reached */
  state: StageAccordionState;
  /** One-line auto-generated summary shown when collapsed (e.g. "Bracket assembly, qty 500") */
  summary: string;
  /** Whether this section is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Section body content */
  children: ReactNode;
  /** Optional extra class on the outer wrapper */
  className?: string;
}

const STATE_ICON_CLS: Record<StageAccordionState, string> = {
  completed: "text-[var(--success,#16a34a)]",
  active:    "text-[var(--accent,#2563eb)]",
  future:    "text-slate-300 dark:text-slate-600",
};

const HEADER_CLS: Record<StageAccordionState, string> = {
  completed: "bg-white dark:bg-slate-900",
  active:    "bg-white dark:bg-slate-900",
  future:    "bg-slate-50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed",
};

function StateIcon({ state }: { state: StageAccordionState }) {
  if (state === "completed") {
    return <CheckCircle size={18} className={STATE_ICON_CLS.completed} aria-label="Completed" />;
  }
  if (state === "active") {
    return (
      <span className={cn("flex items-center justify-center w-[18px] h-[18px] rounded-full border-2 border-[var(--accent,#2563eb)]", STATE_ICON_CLS.active)} aria-label="Active" />
    );
  }
  return <Circle size={18} className={STATE_ICON_CLS.future} aria-label="Not yet reached" />;
}

export function StageAccordion({
  state,
  label,
  summary,
  isOpen,
  onToggle,
  children,
  className,
}: StageAccordionProps) {
  const isClickable = state !== "future";

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] overflow-hidden",
        state === "active" && "border-[var(--accent,#2563eb)]/40 shadow-sm",
        className
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={isClickable ? onToggle : undefined}
        disabled={!isClickable}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
          HEADER_CLS[state],
          isClickable && "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        )}
        aria-expanded={isOpen}
      >
        {/* Status icon */}
        <StateIcon state={state} />

        {/* Stage label */}
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            state === "future" ? "text-slate-400" : "text-slate-800 dark:text-slate-100"
          )}
        >
          {label}
        </span>

        {/* Collapsed summary — only shown when closed and not future */}
        {!isOpen && state !== "future" && summary && (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs hidden sm:block">
            {summary}
          </span>
        )}

        {/* Chevron — rotates 180° when open */}
        {isClickable && (
          <ChevronDown
            size={16}
            className={cn(
              "text-slate-400 flex-shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Body */}
      {isOpen && (
        <div className="border-t border-[var(--border,rgba(0,0,0,0.08))]">
          {children}
        </div>
      )}
    </div>
  );
}
