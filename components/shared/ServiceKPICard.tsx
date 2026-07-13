"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";

interface ServiceKPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: (filter: string) => void;
  active?: boolean;
}

export function ServiceKPICard({ label, value, icon, color, onClick, active }: ServiceKPICardProps) {
  return (
    <button
      onClick={() => onClick?.(active ? "" : label)}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
        active
          ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-500/40"
      )}
    >
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-black text-[var(--text-primary)]">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</div>
      </div>
    </button>
  );
}

export function ServiceKPIGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {children}
    </div>
  );
}
