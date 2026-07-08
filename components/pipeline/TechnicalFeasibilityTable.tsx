"use client";

import { cn } from "@/lib/ui-utils";

export type FeasibilityValue = "Feasible" | "FeasibleWithChanges" | "NotFeasible" | "";

export interface TechNoteRow {
  requirementItemId: string;
  productName: string;
  feasibility: FeasibilityValue;
  confirmedSpec: string;
  toolingRequired: string;
  saving?: boolean;
}

const FEASIBILITY_OPTIONS: { value: FeasibilityValue; label: string }[] = [
  { value: "", label: "Select…" },
  { value: "Feasible", label: "Feasible" },
  { value: "FeasibleWithChanges", label: "Feasible with changes" },
  { value: "NotFeasible", label: "Not feasible" },
];

const FEASIBILITY_PILL: Record<string, string> = {
  Feasible:             "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50",
  FeasibleWithChanges:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
  NotFeasible:          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50",
  pending:              "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const FEASIBILITY_LABEL: Record<string, string> = {
  Feasible:            "Feasible",
  FeasibleWithChanges: "Feasible with changes",
  NotFeasible:         "Not feasible",
};

interface TechnicalFeasibilityTableProps {
  rows: TechNoteRow[];
  onFieldChange: (itemId: string, field: keyof TechNoteRow, value: string) => void;
  onSaveRow: (itemId: string) => Promise<void>;
  readOnly?: boolean;
}

export function TechnicalFeasibilityTable({
  rows,
  onFieldChange,
  onSaveRow,
  readOnly = false,
}: TechnicalFeasibilityTableProps) {
  const cleared = rows.filter((r) => r.feasibility === "Feasible" || r.feasibility === "FeasibleWithChanges").length;
  const total = rows.length;

  return (
    <div className="space-y-3">
      {/* Aggregate progress line */}
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              cleared === total && total > 0 ? "bg-green-500" : "bg-[var(--primary)]"
            )}
            style={{ width: total > 0 ? `${(cleared / total) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {cleared} of {total} products cleared
        </span>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--border,rgba(0,0,0,0.08))]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {["Product", "Feasibility", "Confirmed spec", "Tooling required", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.requirementItemId}
                className={cn(
                  "border-t border-[var(--border,rgba(0,0,0,0.06))]",
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"
                )}
              >
                {/* Product name — read-only */}
                <td className="px-3 py-2.5">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{row.productName}</span>
                  <span className="ml-1.5 text-xs text-slate-400 italic">from Req. Gathering</span>
                </td>

                {/* Feasibility */}
                <td className="px-3 py-2.5">
                  {readOnly ? (
                    row.feasibility ? (
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL[row.feasibility])}>
                        {FEASIBILITY_LABEL[row.feasibility]}
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL.pending)}>
                        Review pending
                      </span>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {row.feasibility ? (
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL[row.feasibility])}>
                          {FEASIBILITY_LABEL[row.feasibility]}
                        </span>
                      ) : (
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL.pending)}>
                          Review pending
                        </span>
                      )}
                      <select
                        value={row.feasibility}
                        onChange={(e) => onFieldChange(row.requirementItemId, "feasibility", e.target.value)}
                        className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white dark:bg-slate-900 dark:border-slate-700 focus:border-[var(--primary)] focus:outline-none"
                      >
                        {FEASIBILITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </td>

                {/* Confirmed spec */}
                <td className="px-3 py-2.5">
                  {readOnly ? (
                    <span>{row.confirmedSpec || <span className="text-slate-400">—</span>}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.confirmedSpec}
                      onChange={(e) => onFieldChange(row.requirementItemId, "confirmedSpec", e.target.value)}
                      placeholder="e.g. Tolerance ±0.05mm"
                      className="w-full min-w-[160px] px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                    />
                  )}
                </td>

                {/* Tooling required */}
                <td className="px-3 py-2.5">
                  {readOnly ? (
                    <span>{row.toolingRequired || <span className="text-slate-400">—</span>}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.toolingRequired}
                      onChange={(e) => onFieldChange(row.requirementItemId, "toolingRequired", e.target.value)}
                      placeholder="e.g. New die required"
                      className="w-full min-w-[140px] px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                    />
                  )}
                </td>

                {/* Save button */}
                {!readOnly && (
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSaveRow(row.requirementItemId)}
                      disabled={!row.feasibility || row.saving}
                      className="px-2 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
                    >
                      {row.saving ? "Saving…" : "Save"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: stacked cards ── */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.requirementItemId} className="rounded-lg border border-[var(--border,rgba(0,0,0,0.08))] bg-white dark:bg-slate-900 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.productName}</p>
                <p className="text-[10px] text-slate-400 italic">from Req. Gathering</p>
              </div>
              {row.feasibility ? (
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL[row.feasibility])}>
                  {FEASIBILITY_LABEL[row.feasibility]}
                </span>
              ) : (
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FEASIBILITY_PILL.pending)}>
                  Review pending
                </span>
              )}
            </div>
            {!readOnly && (
              <select
                value={row.feasibility}
                onChange={(e) => onFieldChange(row.requirementItemId, "feasibility", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white dark:bg-slate-900 dark:border-slate-700"
              >
                {FEASIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            {!readOnly && (
              <input type="text" value={row.confirmedSpec} onChange={(e) => onFieldChange(row.requirementItemId, "confirmedSpec", e.target.value)} placeholder="Confirmed spec" className="w-full px-2 py-1.5 rounded border border-slate-200 text-sm bg-transparent" />
            )}
            {!readOnly && (
              <button type="button" onClick={() => onSaveRow(row.requirementItemId)} disabled={!row.feasibility || row.saving} className="w-full py-1.5 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40">
                {row.saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
