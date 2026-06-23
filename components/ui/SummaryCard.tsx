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
}

function SparklineBars({ data, variant }: { data: number[], variant: string }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isSolid = variant === "brand-solid" || variant === "orange";
  
  return (
    <div className="flex items-end gap-[3px] h-[32px] w-[90px] min-w-[90px] opacity-90">
      {data.map((val, idx) => {
        const pct = ((val - min) / range) * 80 + 20; // 20% to 100%
        let barColorClass = "bg-[var(--accent)]/15";
        if (isSolid) {
          barColorClass = idx === data.length - 1 ? "bg-[var(--accent-contrast)]" : "bg-[var(--accent-contrast)]/40";
        } else {
          barColorClass = idx === data.length - 1 ? "bg-[var(--accent)]" : "bg-[var(--accent)]/15";
        }
        return (
          <div
            key={idx}
            className={cn("w-[6px] rounded-[1.5px] transition-all duration-300", barColorClass)}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

const variantMap = {
  orange: {
    card: "bg-[var(--accent)] border-transparent text-[var(--accent-contrast)] shadow-md shadow-[var(--accent-soft)]",
    label: "text-[var(--accent-contrast)]/80",
    value: "text-[var(--accent-contrast)]",
    pill: "bg-[var(--accent-contrast)]/20 text-[var(--accent-contrast)] border-transparent",
    sub: "text-[var(--accent-contrast)]/70",
  },
  "brand-solid": {
    card: "bg-[var(--accent)] border-transparent text-[var(--accent-contrast)] shadow-md shadow-[var(--accent-soft)]",
    label: "text-[var(--accent-contrast)]/80",
    value: "text-[var(--accent-contrast)]",
    pill: "bg-[var(--accent-contrast)]/20 text-[var(--accent-contrast)] border-transparent",
    sub: "text-[var(--accent-contrast)]/70",
  },
  dark: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  light: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  red: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  brand: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  blue: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  green: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  amber: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  },
  slate: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800",
    sub: "text-slate-400 dark:text-slate-500",
  },
  indigo: {
    card: "crm-card border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-slate-100",
    pill: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/30",
    sub: "text-slate-400 dark:text-slate-500",
  }
};

// Some realistic looking random sparklines based on trend
const generateMockData = (up: boolean) => {
  const base = [10, 15, 12, 18, 14, 25, 20, 30, 28, 40];
  return up ? base : base.slice().reverse();
};

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
}: SummaryCardProps) {
  const v = variantMap[variant] || variantMap.light;
  const isUp = trend ? trend.up : true;
  const data = sparklineData || generateMockData(isUp);
  const isNumeric = typeof value === "number" || /^\d/.test(String(value).replace(/[^\d.-]/g, ""));
  const parsed = parseCountValue(value);

  return (
    <div
      className={cn(
        "p-5 rounded-[18px] flex flex-col justify-between relative overflow-hidden min-h-[150px] h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border",
        v.card,
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
    >
      {/* Top Row: Info + Icon */}
      <div className="z-10 relative flex justify-between items-start">
        <div>
          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5", v.label)}>{label}</p>
          <p className={cn("text-3xl font-bold tracking-tight", v.value)}>
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
        </div>
        {icon && (
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            variant === "brand-solid" || variant === "orange" 
              ? "bg-[var(--accent-contrast)]/20 text-[var(--accent-contrast)]" 
              : variant === "dark"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              : variant === "light"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
              : variant === "red"
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
              : "bg-[var(--accent-soft)] text-[var(--accent)]"
          )}>
            {icon}
          </div>
        )}
      </div>
      
      {/* Bottom Row: Trend/Subtitle + Sparkline */}
      <div className="z-10 relative mt-6 flex justify-between items-end gap-2">
        <div className="flex flex-col items-start">
          {trend && (
            <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1.5 border", v.pill)}>
              {trend.value}
            </span>
          )}
          {subtitle && (
            <p className={cn("text-[11px] font-bold leading-[1.3] opacity-80", v.sub)}>
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Sparkline Bars */}
        <SparklineBars data={data} variant={variant} />
      </div>
    </div>
  );
}
