"use client";

import React from "react";

// ── Unified Status Pill — ONE badge component, ONE color mapping ─────────────
// Used across Key Accounts, Competitors, and future modules.

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Strategic Importance tiers
  Critical:    { bg: "var(--status-danger-bg)",  text: "var(--status-danger-text)",  border: "var(--status-danger-border)" },
  High:        { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },
  Medium:      { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },

  // Relationship status
  Strong:      { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  Growing:     { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },
  Developing:  { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },
  Stable:      { bg: "var(--surface-2)",         text: "var(--text-secondary)",      border: "var(--border)" },
  Neutral:     { bg: "var(--surface-2)",         text: "var(--text-secondary)",      border: "var(--border)" },

  // Target achievement statuses
  Achieved:    { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  "On Track":  { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },
  Behind:      { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },

  // Deal result
  Won:         { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  Lost:        { bg: "var(--status-danger-bg)",  text: "var(--status-danger-text)",  border: "var(--status-danger-border)" },

  // Threat levels (competitors)
  "High Risk":  { bg: "var(--status-danger-bg)",  text: "var(--status-danger-text)",  border: "var(--status-danger-border)" },

  // Legacy aliases (map old DB values to new visual scheme)
  Active:      { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  "At Risk":   { bg: "var(--status-danger-bg)",  text: "var(--status-danger-text)",  border: "var(--status-danger-border)" },
  Dormant:     { bg: "var(--surface-2)",         text: "var(--text-secondary)",      border: "var(--border)" },

  // Contact type badges
  Technical:   { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },
  Purchase:    { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },
  Finance:     { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  Management:  { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },

  // Generic
  Inactive:    { bg: "var(--surface-2)",         text: "var(--text-secondary)",      border: "var(--border)" },

  // SLA & Lead Statuses
  Met:         { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
  Breached:    { bg: "var(--status-danger-bg)",  text: "var(--status-danger-text)",  border: "var(--status-danger-border)" },
  New:         { bg: "var(--status-info-bg)",    text: "var(--status-info-text)",    border: "var(--status-info-border)" },
};

const fallback = { bg: "var(--surface-2)", text: "var(--text-secondary)", border: "var(--border)" };

export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const colors = STATUS_COLORS[status] || fallback;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap leading-none ${className ?? ""}`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontSize: size === "sm" ? "11px" : "12px",
        padding: size === "sm" ? "2px 8px" : "4px 12px",
      }}
    >
      {status}
    </span>
  );
}

// Normalize legacy relationship statuses to the new canonical set
export function normalizeRelationshipStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    Active: "Strong",
    "At Risk": "Critical",
    Dormant: "Stable",
  };
  return map[status] || status;
}
