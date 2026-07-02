"use client";

import React from "react";
import { getInitials } from "@/lib/ui-utils";

// ── Chart color palette (matches CSS variables --chart-1 through --chart-8) ──
export const CHART_COLORS = [
  "#2090FF", "#FF6901", "#10B981", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6",
];

// Stable color mapping: same name → same color across all charts
const colorCache = new Map<string, string>();
export function getChartColor(name: string): string {
  if (!name) return CHART_COLORS[0];
  if (colorCache.has(name)) return colorCache.get(name)!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  const color = CHART_COLORS[hash % CHART_COLORS.length];
  colorCache.set(name, color);
  return color;
}

// ── KPI Summary Card ──────────────────────────────────────────────────────────
export function KPICard({
  label,
  value,
  sublabel,
  icon,
  iconColor,
  trend,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
}) {
  return (
    <div className="analytics-kpi">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</span>
        {icon && <span style={iconColor ? { color: iconColor } : undefined} className="text-[var(--text-muted)]">{icon}</span>}
      </div>
      <div className="text-[28px] font-bold text-[var(--text-primary)] leading-tight">{value}</div>
      <div className="flex items-center gap-2">
        {trend && (
          <span
            className={`text-[12px] font-medium inline-flex items-center gap-0.5 ${
              trend.direction === "up"
                ? "text-[var(--status-success-text)]"
                : trend.direction === "down"
                ? "text-[var(--status-danger-text)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "■"} {trend.value}
          </span>
        )}
        {sublabel && <span className="text-[12px] text-[var(--text-muted)]">{sublabel}</span>}
      </div>
    </div>
  );
}

// ── Chart Card Wrapper ────────────────────────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="analytics-chart-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-[15px] font-medium text-[var(--text-primary)]">{title}</h4>
          {subtitle && <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Color dot for chart legends ───────────────────────────────────────────────
export function ColorDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

// ── Page header for analytics sub-modules ─────────────────────────────────────
export function AnalyticsPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[24px] font-medium text-[var(--text-primary)]">{title}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

// ── Filter select (styled, not OS-default) ────────────────────────────────────
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select-field min-w-[160px] max-w-[220px]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Filter pills (All/High/Medium/Critical etc.) ──────────────────────────────
export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
            value === opt
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── View toggle (grid/table) ──────────────────────────────────────────────────
export function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "table";
  onChange: (v: "grid" | "table") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => onChange("grid")}
        className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
          view === "grid"
            ? "bg-[var(--primary)] text-white"
            : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        }`}
      >
        Grid
      </button>
      <button
        onClick={() => onChange("table")}
        className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
          view === "table"
            ? "bg-[var(--primary)] text-white"
            : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        }`}
      >
        Table
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[14px] text-[var(--text-muted)] mb-3">{message}</p>
      {action}
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────
export function LoadingState() {
  return (
    <div className="py-16 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
    </div>
  );
}

// ── Mini horizontal bar (for inline revenue comparison in table rows) ─────────
export function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="price-range-track flex-1 min-w-[60px]">
      <div
        className="price-range-fill"
        style={{ width: `${pct}%`, background: color || "var(--accent)" }}
      />
    </div>
  );
}

// ── UserAvatar: deterministic color from name, initials, optional role tag ────
// Replaces the "<Role> Suki Software Solutions Pvt. Ltd." pattern across modules.
export function UserAvatar({
  name,
  role,
  size = "sm",
  showRoleTag = true,
}: {
  name?: string | null;
  role?: string | null;
  size?: "sm" | "md" | "lg";
  showRoleTag?: boolean;
}) {
  if (!name) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${size === "sm" ? "w-6 h-6 text-[10px]" : size === "md" ? "w-8 h-8 text-[12px]" : "w-10 h-10 text-[14px]"}`}
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          ?
        </span>
        {showRoleTag && <span className="text-[12px] text-[var(--text-muted)]">Unassigned</span>}
      </div>
    );
  }

  // Strip company-name suffix if it still exists in DB data (legacy seed bug)
  const cleanName = name.replace(/\s+Suki Software Solutions Pvt\. Ltd\.?\s*$/i, "").trim();
  const initials = getInitials(cleanName);
  const color = getChartColor(cleanName);

  // Derive short role tag from role
  const roleTag = role === "SalesExecutive" ? "Exec" : role === "SalesManager" ? "Mgr" : role === "Admin" ? "Admin" : role || "";

  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : size === "md" ? "w-8 h-8 text-[12px]" : "w-10 h-10 text-[14px]";

  return (
    <div className="inline-flex items-center gap-2 min-w-0">
      <span
        className={`inline-flex items-center justify-center rounded-full flex-shrink-0 font-medium text-white ${sizeClass}`}
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">{cleanName}</div>
        {showRoleTag && roleTag && (
          <div className="text-[11px] text-[var(--text-muted)] leading-tight">{roleTag}</div>
        )}
      </div>
    </div>
  );
}

// ── ComparisonBar: fixed-scale dual-value bar (Target vs Achieved, etc.) ───────
// Always renders both bars on the same fixed scale so zero values show as
// visibly empty bars, not missing bars. Uses consistent colors across all instances.
export function ComparisonBar({
  label,
  valueA,
  valueB,
  labelA = "Target",
  labelB = "Achieved",
  formatValue,
  maxScale,
}: {
  label: string;
  valueA: number;
  valueB: number;
  labelA?: string;
  labelB?: string;
  formatValue?: (v: number) => string;
  maxScale?: number;
}) {
  const max = maxScale || Math.max(valueA, valueB, 1);
  const pctA = max > 0 ? (valueA / max) * 100 : 0;
  const pctB = max > 0 ? (valueB / max) * 100 : 0;
  const fmt = formatValue || ((v: number) => String(v));

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-28 truncate text-[var(--text-secondary)]">{label}</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--text-muted)] w-16">{labelA}</span>
          <div className="flex-1 rounded-full h-3" style={{ background: "var(--surface-2)" }}>
            <div className="rounded-full h-3 transition-all" style={{ width: `${pctA}%`, background: "var(--chart-1)" }} />
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] w-24 text-right">{fmt(valueA)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--text-muted)] w-16">{labelB}</span>
          <div className="flex-1 rounded-full h-3" style={{ background: "var(--surface-2)" }}>
            <div className="rounded-full h-3 transition-all" style={{ width: `${pctB}%`, background: "var(--chart-3)" }} />
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] w-24 text-right">{fmt(valueB)}</span>
        </div>
      </div>
    </div>
  );
}
