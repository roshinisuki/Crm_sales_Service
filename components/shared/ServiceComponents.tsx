"use client";

import React from "react";
import { 
  AlertCircle, Clock, ShieldAlert, Award, Calendar, CreditCard, 
  ArrowRight, Users, CheckCircle, TrendingUp, Inbox 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

// ─── SLA COUNTDOWN BADGE ───────────────────────────────────────────────────
interface SLACountdownBadgeProps {
  dueDate: string | Date;
  status: string;
}

export function SLACountdownBadge({ dueDate, status }: SLACountdownBadgeProps) {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    if (["Resolved", "Closed"].includes(status)) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [status]);

  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (["Resolved", "Closed"].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
        <CheckCircle size={12} /> SLA Met
      </span>
    );
  }

  const isOverdue = diffHrs < 0;
  const absHrs = Math.abs(diffHrs);
  const displayTime = absHrs < 1 
    ? `${Math.round(absHrs * 60)}m` 
    : `${Math.round(absHrs)}h`;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all",
      isOverdue 
        ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" 
        : diffHrs <= 4 
          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" 
          : "bg-blue-500/10 text-blue-500 border-blue-500/20"
    )}>
      <Clock size={12} />
      {isOverdue ? `Overdue by ${displayTime}` : `${displayTime} left`}
    </span>
  );
}

// ─── ESCALATION BANNER ─────────────────────────────────────────────────────
interface EscalationBannerProps {
  level: number;
  reason: string;
}

export function EscalationBanner({ level, reason }: EscalationBannerProps) {
  if (level <= 0) return null;

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-red-500/10 text-red-500 border-red-500/25 shadow-sm animate-pulse mb-4">
      <ShieldAlert className="shrink-0" size={20} />
      <div className="flex-1 text-xs">
        <span className="font-bold uppercase tracking-wider block">Escalation Level {level} Active</span>
        <span className="opacity-90">{reason}</span>
      </div>
    </div>
  );
}

// ─── WARRANTY & AMC CONTEXT CARD ──────────────────────────────────────────
interface WarrantyAMCContextCardProps {
  purchaseDate?: string | Date;
  warrantyExpiry?: string | Date;
  amcExpiry?: string | Date;
  amcContract?: {
    planTier?: string | null;
    preventiveVisitsIncluded?: number;
    preventiveVisitsUsed?: number;
    breakdownCallsUnlimited?: boolean;
    breakdownCallsIncluded?: number;
    breakdownCallsUsed?: number;
    sparesCoverage?: string | null;
  } | null;
}

export function WarrantyAMCContextCard({ purchaseDate, warrantyExpiry, amcExpiry, amcContract }: WarrantyAMCContextCardProps) {
  const getStatus = (expiryDate?: string | Date) => {
    if (!expiryDate) return { label: "N/A", style: "text-gray-400" };
    const date = new Date(expiryDate);
    const isExpired = date.getTime() < new Date().getTime();
    return {
      label: isExpired ? "Expired" : "Active",
      style: isExpired ? "text-red-500 font-semibold" : "text-green-500 font-semibold",
    };
  };

  const warranty = getStatus(warrantyExpiry);
  const amc = getStatus(amcExpiry);

  // Entitlement usage warnings
  const pvUsed = amcContract?.preventiveVisitsUsed ?? 0;
  const pvIncluded = amcContract?.preventiveVisitsIncluded ?? 0;
  const bdUsed = amcContract?.breakdownCallsUsed ?? 0;
  const bdIncluded = amcContract?.breakdownCallsIncluded ?? 0;
  const bdUnlimited = amcContract?.breakdownCallsUnlimited ?? false;

  const pvExceeded = pvIncluded > 0 && pvUsed >= pvIncluded;
  const bdExceeded = !bdUnlimited && bdIncluded > 0 && bdUsed >= bdIncluded;
  const pvWarning = pvIncluded > 0 && pvUsed >= pvIncluded * 0.8 && !pvExceeded;
  const bdWarning = !bdUnlimited && bdIncluded > 0 && bdUsed >= bdIncluded * 0.8 && !bdExceeded;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Award size={16} className="text-yellow-500" /> Coverage Details
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-[var(--text-secondary)] block">Warranty Status</span>
          <span className={warranty.style}>{warranty.label}</span>
          {warrantyExpiry && (
            <span className="text-[10px] text-[var(--text-muted)] block">
              Exp: {new Date(warrantyExpiry).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-[var(--text-secondary)] block">AMC Contract</span>
          <span className={amc.style}>{amc.label}</span>
          {amcExpiry && (
            <span className="text-[10px] text-[var(--text-muted)] block">
              Exp: {new Date(amcExpiry).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {amcContract && (
        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">AMC Entitlements</span>
            {amcContract.planTier && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {amcContract.planTier}
              </span>
            )}
            {amcContract.sparesCoverage && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                Spares: {amcContract.sparesCoverage}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[var(--text-secondary)] block">Preventive Visits</span>
              <span className={cn(
                "font-bold",
                pvExceeded ? "text-red-500" : pvWarning ? "text-amber-500" : "text-[var(--text-primary)]"
              )}>
                {pvUsed} / {pvIncluded}
              </span>
              {pvExceeded && (
                <span className="text-[9px] text-red-500 block">⚠ Limit exceeded — billable</span>
              )}
              {pvWarning && (
                <span className="text-[9px] text-amber-500 block">⚠ Approaching limit</span>
              )}
            </div>

            <div className="space-y-0.5">
              <span className="text-[var(--text-secondary)] block">Breakdown Calls</span>
              <span className={cn(
                "font-bold",
                bdExceeded ? "text-red-500" : bdWarning ? "text-amber-500" : "text-[var(--text-primary)]"
              )}>
                {bdUnlimited ? "Unlimited" : `${bdUsed} / ${bdIncluded}`}
              </span>
              {bdExceeded && (
                <span className="text-[9px] text-red-500 block">⚠ Limit exceeded — billable</span>
              )}
              {bdWarning && (
                <span className="text-[9px] text-amber-500 block">⚠ Approaching limit</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ASSET HISTORY PANEL ───────────────────────────────────────────────────
interface AssetEvent {
  id: string;
  type: string;
  description: string;
  date: string | Date;
  engineerName?: string;
}

export function AssetHistoryPanel({ events }: { events: AssetEvent[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4 backdrop-blur-md">
      <h4 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
        <Calendar size={16} className="text-blue-400" /> Asset Service History
      </h4>

      {events.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">No service history recorded for this asset.</p>
      ) : (
        <div className="relative pl-4 space-y-4 border-l border-[var(--border)] ml-2">
          {events.map((event) => (
            <div key={event.id} className="relative space-y-1">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-[var(--bg)]" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[var(--text-primary)]">{event.type}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{new Date(event.date).toLocaleDateString()}</span>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)]">{event.description}</p>
              {event.engineerName && (
                <span className="text-[10px] text-[var(--text-muted)] block">Engineer: {event.engineerName}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VISIT SCHEDULER PANEL ─────────────────────────────────────────────────
export function VisitSchedulerPanel({ onSchedule }: { onSchedule: (date: Date, notes: string) => void }) {
  const [date, setDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    onSchedule(new Date(date), notes);
    setDate("");
    setNotes("");
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3.5 backdrop-blur-md">
      <h4 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
        <Calendar size={16} className="text-green-400" /> Schedule Engineer Visit
      </h4>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Visit Date & Time</label>
          <input 
            type="datetime-local" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Instructions / Notes</label>
          <textarea 
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add visit notes..."
            className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>

        <button 
          type="submit"
          className="w-full py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          Schedule Visit <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
}

// ─── SERVICE QUEUE CARD ────────────────────────────────────────────────────
interface ServiceQueueCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  onClick?: () => void;
}

export function ServiceQueueCard({ title, count, icon, onClick }: ServiceQueueCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 flex items-center justify-between gap-4 transition-all duration-300",
        onClick ? "cursor-pointer hover:bg-[var(--surface-2)] hover:border-[var(--border)] active:scale-[0.98]" : ""
      )}
    >
      <div className="space-y-1 min-w-0">
        <span className="text-[11.5px] uppercase tracking-wider font-bold text-[var(--text-secondary)] block truncate">{title}</span>
        <span className="text-2xl font-black text-[var(--text-primary)] block">{count}</span>
      </div>
      <div className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
        {icon}
      </div>
    </div>
  );
}

// ─── SERVICE KPI CARD ──────────────────────────────────────────────────────
interface ServiceKpiCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  isPositive?: boolean;
  icon: React.ReactNode;
}

export function ServiceKpiCard({ title, value, change, isPositive, icon }: ServiceKpiCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4 backdrop-blur-md">
      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">{title}</span>
        <span className="text-xl font-extrabold text-[var(--text-primary)] block">{value}</span>
        {change && (
          <span className={cn(
            "text-[10px] font-semibold block",
            isPositive ? "text-green-500" : "text-red-500"
          )}>
            {isPositive ? "+" : ""}{change} from last period
          </span>
        )}
      </div>
      <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
        {icon}
      </div>
    </div>
  );
}

// ─── LINKED VISITS PANEL ───────────────────────────────────────────────────
interface LinkedVisitsPanelProps {
  visits: any[];
}

export function LinkedVisitsPanel({ visits }: LinkedVisitsPanelProps) {
  if (!visits || visits.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Calendar size={16} className="text-blue-500" /> Linked Visits
        </h4>
        <span className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
          {visits.length}
        </span>
      </div>

      <div className="space-y-3">
        {visits.map((visit: any, idx: number) => (
          <div key={idx} className="border border-[var(--border)] rounded-lg p-3 bg-[var(--surface-2)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">{visit.title}</span>
              <span className="text-[10px] bg-[var(--surface-3)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-primary)]">
                {visit.status?.name || "Scheduled"}
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex flex-col gap-1">
              <span>Date: {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleString() : "Not scheduled"}</span>
              <span>Engineer: {visit.engineer?.user?.name || "Unassigned"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

