"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";
import { Check } from "lucide-react";

export interface StepperStep {
  label: string;
  key: string;
  /** Whether this step has been reached/completed */
  reached?: boolean;
  /** Whether this is the current/active step */
  active?: boolean;
  /** Optional ID for navigation (e.g. RFQ id, Quotation id) */
  id?: string | null;
  /** Optional click handler */
  onClick?: () => void;
  /** Whether this step is clickable */
  clickable?: boolean;
  /** Terminal state — show danger/warning color instead of default */
  terminal?: "success" | "danger" | "warning";
}

interface StatusStepperProps {
  steps: StepperStep[];
  className?: string;
  /** Compact mode — smaller circles, no labels on mobile */
  compact?: boolean;
}

/**
 * Single reusable status/lifecycle stepper component for the entire CRM.
 * Used across Quotation, Negotiation, RFQ, Samples, Sales Pipeline, and all
 * other modules that need a status/lifecycle progress bar.
 *
 * - Completed steps: solid theme-accent circle with checkmark
 * - Active step: larger solid theme-accent circle with ring
 * - Future steps: muted circle with number
 * - Connecting lines: theme-accent for completed, muted for upcoming
 * - Horizontally scrollable when steps overflow
 * - Fully themed via CSS variables (light + dark mode)
 */
export function StatusStepper({ steps, className, compact = false }: StatusStepperProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className={cn(
        "flex items-center min-w-fit px-1",
        compact ? "gap-1" : "gap-2"
      )}>
        {steps.map((step, i) => {
          const isDone = step.reached && !step.active;
          const isActive = step.active;
          const isFuture = !step.reached && !step.active;
          const isClickable = step.clickable || (!!step.onClick && (isDone || isActive));
          const isLast = i === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              {/* Step node */}
              <div
                onClick={() => {
                  if (isClickable && step.onClick) step.onClick();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg transition-colors shrink-0",
                  compact ? "px-2 py-1" : "px-2.5 py-1.5",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default",
                  isActive && "bg-[var(--primary)] text-[var(--accent-contrast)] shadow-sm border border-[var(--primary)]",
                  !isActive && isDone && "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]",
                  !isActive && !isDone && isFuture && "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]",
                  !isActive && !isDone && step.terminal === "danger" && "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]",
                  !isActive && !isDone && step.terminal === "warning" && "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]",
                  isClickable && !isActive && "hover:brightness-95"
                )}
              >
                {/* Circle */}
                <div
                  className={cn(
                    "rounded-full shrink-0 flex items-center justify-center font-bold border-2 transition-all",
                    compact ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-[11px]",
                    isActive && "bg-[var(--accent-contrast)] text-[var(--primary)] border-[var(--accent-contrast)]",
                    !isActive && isDone && "bg-[var(--status-success)] text-white border-[var(--status-success)]",
                    !isActive && !isDone && isFuture && "text-[var(--text-muted)] border-[var(--border)]",
                    !isActive && !isDone && step.terminal === "danger" && "bg-[var(--status-danger)] text-white border-[var(--status-danger)]",
                    !isActive && !isDone && step.terminal === "warning" && "bg-[var(--status-warning)] text-white border-[var(--status-warning)]"
                  )}
                >
                  {isDone ? <Check size={compact ? 10 : 12} strokeWidth={3} /> : i + 1}
                </div>
                {/* Label */}
                <span className={cn(
                  "font-semibold whitespace-nowrap",
                  compact ? "text-[11px]" : "text-xs"
                )}>
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 rounded-full shrink-0 transition-all",
                    compact ? "w-4 min-w-[8px]" : "flex-1 min-w-[12px]",
                    isDone ? "bg-[var(--status-success)]" : "bg-[var(--border)]"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
