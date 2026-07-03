import React from "react";
import { cn } from "@/lib/ui-utils";

type StatusType =
  | "New" | "Contacted" | "FollowUpDue" | "SQL" | "Qualified" | "Converted" | "Lost"
  | "Active" | "Inactive" | "Prospect" | "APPROVED" | "REJECTED" | "PENDING"
  | "Open" | "Won"
  | "Qualified" | "RequirementGathering" | "MeetingScheduled" | "DemoConducted" | "Rejected"
  | "Pending" | "Completed" | "Overdue" | "Cancelled"
  | "Low" | "Medium" | "High"
  | string;

const statusConfig: Record<string, { classes: string; dot: string; label?: string }> = {
  // Lead statuses
  New:         { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",         dot: "bg-blue-400" },
  Contacted:   { classes: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/50",          dot: "bg-cyan-400" },
  FollowUpDue: { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",       dot: "bg-amber-400" },
  SQL:         { classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50", dot: "bg-indigo-400" },
  Qualified:   { classes: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50",   dot: "bg-purple-400" },
  Converted:   { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400" },
  Lost:        { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",          dot: "bg-rose-400" },
  Active:      { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400" },
  Inactive:    { classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50",      dot: "bg-slate-400" },
  Prospect:    { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",       dot: "bg-amber-400" },
  APPROVED:    { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400" },
  REJECTED:    { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",          dot: "bg-rose-400" },
  PENDING:     { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",       dot: "bg-amber-400" },

  // Deal statuses (BRD Variant 1)
  Open:                  { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",           dot: "bg-blue-400" },
  Won:                   { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400" },
  OnHold:                { classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50", dot: "bg-slate-400", label: "On Hold" },

  // Opportunity stages (BRD Variant 1 + Variant 2 pipeline)
  RequirementGathering:  { classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50",     dot: "bg-indigo-400", label: "Req. Gathering" },
  MeetingScheduled:      { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",     dot: "bg-blue-400", label: "Meeting Scheduled" },
  TechnicalDiscussion:   { classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50",     dot: "bg-indigo-400", label: "Technical Discussion" },
  DemoConducted:         { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50", dot: "bg-amber-400", label: "Demo Conducted" },
  ProposalSent:          { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",                 dot: "bg-amber-400",   label: "Proposal" },
  Negotiation:           { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",     dot: "bg-amber-400", label: "Negotiation" },
  Rejected:              { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",                 dot: "bg-rose-400",   label: "Rejected" },
  // RFQ statuses
  UnderReview:           { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",                 dot: "bg-blue-400",   label: "Under Review" },
  CostingPending:        { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",           dot: "bg-amber-400",  label: "Costing Pending" },
  QuotationCreated:      { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400", label: "Quotation Created" },
  Closed:                { classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50",           dot: "bg-slate-400",  label: "Closed" },
  // Quotation statuses
  Draft:                 { classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50",           dot: "bg-slate-400",  label: "Draft" },
  Sent:                  { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",                 dot: "bg-blue-400",   label: "Sent" },
  Accepted:              { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400", label: "Accepted" },
  Expired:               { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",                 dot: "bg-rose-400",   label: "Expired" },

  // Follow-up statuses
  Pending:   { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",       dot: "bg-amber-400" },
  Completed: { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", dot: "bg-emerald-400" },
  Overdue:   { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",          dot: "bg-rose-400" },
  Cancelled: { classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50",      dot: "bg-slate-400" },

  // Priority levels - USE CSS VARIABLES FOR DARK MODE
  Low:    { classes: "bg-emerald-50 text-emerald-700 border-emerald-200", style: { "--badge-bg": "var(--status-success-bg)", "--badge-text": "var(--status-success-text)", "--badge-border": "var(--status-success-border)" }, dot: "bg-emerald-400" },
  Medium: { classes: "bg-amber-50 text-amber-700 border-amber-200", style: { "--badge-bg": "var(--status-warning-bg)", "--badge-text": "var(--status-warning-text)", "--badge-border": "var(--status-warning-border)" },       dot: "bg-amber-400" },
  High:   { classes: "bg-rose-50 text-rose-700 border-rose-200", style: { "--badge-bg": "var(--status-danger-bg)", "--badge-text": "var(--status-danger-text)", "--badge-border": "var(--status-danger-border)" },          dot: "bg-rose-400" },
};

const fallback = { classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50", dot: "bg-slate-400" };

interface StatusBadgeProps {
  status: StatusType;
  showDot?: boolean;
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = false, size = "sm", pulse = false, className }: StatusBadgeProps) {
  const config = statusConfig[status] || fallback;
  const label = config.label || status;

  // For Priority badges, use CSS variables for dark mode support
  const isPriority = status === "Low" || status === "Medium" || status === "High";
  const badgeStyle = isPriority && config.style ? config.style : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border font-semibold rounded-full",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        isPriority ? "dark:bg-[var(--badge-bg)] dark:text-[var(--badge-text)] dark:border-[var(--badge-border)]" : "",
        config.classes,
        className,
      )}
      style={badgeStyle}
    >
      {showDot && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dot, pulse ? "animate-pulse" : "")} />
      )}
      {label}
    </span>
  );
}

// Priority-specific badge - DEPRECATED: Use StatusBadge with status="Low"|"Medium"|"High" instead
export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  // Map priority to status values for StatusBadge
  const statusMap: Record<string, string> = {
    Low: "Low",
    Medium: "Medium",
    High: "High",
  };
  const status = statusMap[priority] || "Medium";
  return <StatusBadge status={status} className={className} />;
}

// ─── Stage Badge — consistent colour system across pipeline ──────────────────
const STAGE_BADGE_STYLES: Record<string, { classes: string; label: string }> = {
  Qualified:           { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", label: "Qualified" },
  RequirementGathering:{ classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50", label: "Req. gathering" },
  MeetingScheduled:    { classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50", label: "Meeting scheduled" },
  DemoConducted:       { classes: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50", label: "Demo Conducted" },
  Rejected:            { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50", label: "Rejected" },
  Negotiation:         { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50", label: "Negotiation" },
  OnHold:              { classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50", label: "On hold" },
  TechnicalDiscussion: { classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50", label: "Technical discussion" },
  ProposalSent:        { classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50", label: "Proposal" },
  Won:                 { classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50", label: "Deal won" },
  Lost:                { classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50", label: "Deal lost" },
  Expired:             { classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50", label: "Expired" },
};

const stageFallback = { classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50", label: "" };

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const style = STAGE_BADGE_STYLES[stage] || { ...stageFallback, label: stage };
  return (
    <span
      className={cn(
        "inline-flex items-center border font-medium rounded-full whitespace-nowrap",
        "px-2.5 py-0.5 text-[11px]",
        style.classes,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
