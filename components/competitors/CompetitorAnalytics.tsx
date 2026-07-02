"use client";

import React from "react";

// ── Chart color palette (matches CSS variables --chart-1 through --chart-8) ──
export const CHART_COLORS = [
  "#2090FF", "#FF6901", "#10B981", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6",
];

// Stable color mapping: same competitor name → same color across all charts
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
        {icon && <span style={iconColor ? { color: iconColor } : undefined} className={iconColor ? undefined : "text-[var(--text-muted)]"}>{icon}</span>}
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

// ── Threat-level badge ────────────────────────────────────────────────────────
export function ThreatBadge({ level }: { level: string }) {
  const cls =
    level === "High"
      ? "badge-threat-high"
      : level === "Medium"
      ? "badge-threat-medium"
      : "badge-threat-low";
  return <span className={cls}>{level}</span>;
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

// ── Page header for competitor sub-modules ────────────────────────────────────
export function CompetitorPageHeader({
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
export function EmptyState({ message }: { message: string }) {
  return <div className="py-16 text-center text-[14px] text-[var(--text-muted)]">{message}</div>;
}

// ── Loading state ─────────────────────────────────────────────────────────────
export function LoadingState() {
  return (
    <div className="py-16 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
    </div>
  );
}

// ── Price range mini bar ──────────────────────────────────────────────────────
export function PriceRangeBar({ priceRange }: { priceRange?: string | null }) {
  if (!priceRange) return <span className="text-[var(--text-muted)]">—</span>;

  // Parse price range strings like "$500 - $800" or "500-800" or "$500–$800"
  const nums = priceRange.match(/[\d,]+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) {
    return <span className="text-[13px] text-[var(--text-secondary)]">{priceRange}</span>;
  }

  const min = parseFloat(nums[0].replace(/,/g, ""));
  const max = parseFloat(nums[1].replace(/,/g, ""));
  if (isNaN(min) || isNaN(max) || max < min) {
    return <span className="text-[13px] text-[var(--text-secondary)]">{priceRange}</span>;
  }

  // Use a fixed scale 0 to max*1.2 for the bar width
  const scaleMax = max * 1.2;
  const startPct = (min / scaleMax) * 100;
  const widthPct = ((max - min) / scaleMax) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="price-range-track flex-1 min-w-[80px]">
        <div
          className="price-range-fill"
          style={{ marginLeft: `${startPct}%`, width: `${widthPct}%` }}
        />
      </div>
      <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">{priceRange}</span>
    </div>
  );
}
