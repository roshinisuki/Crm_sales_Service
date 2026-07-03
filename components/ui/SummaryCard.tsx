import React from "react";
import { cn } from "@/lib/ui-utils";
import { CountUp, parseCountValue } from "./CountUp";

interface SummaryCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "orange" | "dark" | "light" | "blue" | "green" | "amber" | "red" | "brand" | "slate" | "brand-solid" | "indigo";
  trend?: { value: string; up: boolean };
  sparklineData?: number[];
  className?: string;
  onClick?: () => void;
  /** When true and value > 0, render with orange accent (for pending follow-ups / overdue) */
  accentWhenPositive?: boolean;
}

// Neutral card style — all KPI cards use the same background.
// Orange accent is applied only when accentWhenPositive is true and value > 0.
const NEUTRAL_CARD = "rounded-[10px] border bg-[var(--surface-2)] dark:bg-slate-900 shadow-sm transition-all duration-200 hover:shadow-md";
const ACCENT_CARD = "rounded-[10px] border shadow-sm transition-all duration-200 hover:shadow-md";
const ACCENT_BORDER = "var(--accent)";
const ACCENT_BG = "var(--accent-soft)";

export function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  variant = "light",
  trend,
  sparklineData,
  className,
  onClick,
  accentWhenPositive = false,
}: SummaryCardProps) {
  const isNumeric = typeof value === "number" || /^\d/.test(String(value).replace(/[^\d.-]/g, ""));
  const parsed = parseCountValue(value);
  const numericValue = typeof value === "number" ? value : parsed.end;
  const showAccent = accentWhenPositive && numericValue > 0;

  // Theme-aware value/icon tint for brand/orange variants
  const brandTint = variant === "brand" || variant === "orange" ? "var(--brand-primary)" : undefined;

  // Trend sub-text colour based on meaning
  const trendColor = trend
    ? trend.up
      ? brandTint ?? "#1D9E75"      // positive: theme brand if available, else green
      : showAccent
      ? "var(--accent-text)"  // warning / pending
      : "#E24B4A"      // negative
    : undefined;

  return (
    <div
      className={cn(
        showAccent ? ACCENT_CARD : NEUTRAL_CARD,
        onClick ? "cursor-pointer" : "",
        className
      )}
      style={showAccent
        ? { background: ACCENT_BG, borderColor: ACCENT_BORDER }
        : { borderColor: "var(--border-subtle)" }
      }
      onClick={onClick}
    >
      <div className="p-5 flex flex-col gap-3 h-full">
        {/* Label + icon */}
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] uppercase tracking-[0.04em]"
            style={{ color: showAccent ? "var(--accent-text)" : "var(--text-muted)" }}
          >
            {label}
          </p>
          {icon && (
            <span style={{ color: showAccent ? "var(--accent-text)" : brandTint ?? "var(--text-muted)" }}>
              {icon}
            </span>
          )}
        </div>

        {/* Value */}
        <p
          className="text-[22px] font-medium tracking-tight leading-normal"
          style={{ color: showAccent ? "var(--accent-text)" : brandTint ?? "var(--text-primary)" }}
        >
          {isNumeric ? (
            <CountUp
              end={parsed.end}
              prefix={parsed.prefix}
              suffix={parsed.suffix}
              decimals={parsed.decimals}
            />
          ) : (
            value
          )}
        </p>

        {/* Sub-text / trend */}
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className="text-[11px]"
              style={{ color: trendColor }}
            >
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span
              className="text-[11px]"
              style={{ color: showAccent ? "var(--accent-text)" : "var(--text-muted)" }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
