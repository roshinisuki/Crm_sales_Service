import React from "react";
import { cn, formatDateTime } from "@/lib/ui-utils";

interface TimelineEvent {
  id: string | number;
  title: string;
  description?: string;
  timestamp?: string | Date | null;
  icon?: React.ReactNode;
  color?: "brand" | "green" | "amber" | "red" | "slate";
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  emptyMessage?: string;
}

const colorMap = {
  brand: "bg-orange-100 text-orange-600 border-orange-200",
  green: "bg-emerald-100 text-emerald-600 border-emerald-200",
  amber: "bg-amber-100 text-amber-600 border-amber-200",
  red:   "bg-rose-100 text-rose-600 border-rose-200",
  slate: "bg-slate-100 text-slate-500 border-slate-200",
};

const lineDot = {
  brand: "bg-[var(--primary)]",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red:   "bg-rose-500",
  slate: "bg-slate-400",
};

export function Timeline({ events, className, emptyMessage = "No activity yet." }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-10 text-slate-400 text-sm", className)}>
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {events.map((event, idx) => {
        const color = event.color || "brand";
        return (
          <div key={event.id} className="flex gap-3 relative">
            {/* Line */}
            <div className="flex flex-col items-center shrink-0">
              <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", lineDot[color])} />
              {idx < events.length - 1 && (
                <div className="w-px flex-1 bg-slate-100 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-snug">{event.title}</p>
              {event.description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{event.description}</p>
              )}
              {event.timestamp && (
                <p className="text-[11px] text-slate-400 font-medium mt-1.5">{formatDateTime(event.timestamp)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
