"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { PIPELINE_STATUS } from "@/lib/module-status-config";
import { formatDate, cn } from "@/lib/ui-utils";
import {
  Search, AlertTriangle,
  Download, Zap,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  Qualified: "Qualified",
  RequirementGathering: "Req. Gathering",
  MeetingScheduled: "Meeting Scheduled",
  DemoConducted: "Demo Conducted",
  Lost: "Lost",
  Rejected: "Rejected",
};

const STAGE_PILL_COLORS: Record<string, string> = {
  Qualified: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50",
  RequirementGathering: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50",
  MeetingScheduled: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50",
  DemoConducted: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
  Lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
  Rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50",
};

function SalesPipelineListContent() {
  const router = useRouter();
  const activeTab = useStatusFromUrl("stage");
  const toast = useToast();
  const { formatCurrency } = useCurrency();

  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab && activeTab !== "overdue") {
      params.set("stage", activeTab);
    }
    if (activeTab === "overdue") params.set("overdue", "true");
    if (searchQuery) params.set("search", searchQuery);

    const res = await fetch(`/api/opportunities?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setDeals(json.data || []);
    } else {
      toast.error("Failed to load opportunities");
    }
    setLoading(false);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Build a label lookup from the status config
  const STATUS_LABELS: Record<string, string> = {
    "": "All Opportunities",
    overdue: "Overdue",
    ...Object.fromEntries(PIPELINE_STATUS.map((s) => [s.value, s.label])),
  };

  // KPIs
  const kpiTotal = deals.filter((d) => d.status !== "Lost" && d.status !== "Won").length;
  const kpiValue = deals.filter((d) => d.status !== "Lost" && d.status !== "Won").reduce((s, d) => s + d.dealValue, 0);
  const kpiOverdue = deals.filter((d) => d.isOverdue).length;

  const handleExport = () => {
    const headers = ["Code", "Name", "Account", "Stage", "Value", "Probability", "Close Date", "Assigned To", "Overdue"];
    const rows = deals.map((d) => [
      d.opportunityCode || "",
      d.dealName,
      d.customer?.name || "",
      STAGE_LABELS[d.status] || d.status,
      d.dealValue,
      `${d.probabilityPercent}%`,
      formatDate(d.expectedCloseDate),
      d.assignedUser?.name || "",
      d.isOverdue ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Pipeline"
      subtitle="Track and manage your opportunities through the sales cycle."
      action={
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input
              type="text"
              placeholder="Search opportunity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Download size={15} /> Export
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ─── Status Filter Bar ─── */}
        <StatusFilterBar
          statuses={PIPELINE_STATUS}
          paramKey="stage"
          basePath="/sales-pipeline/pipeline-list"
        />

        {/* ─── Hero Summary Card ─── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[var(--primary)]/10 via-white to-slate-50 p-6 shadow-sm">
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className={cn(
                "inline-flex px-2.5 py-1 text-xs font-bold rounded-full border mb-2",
                !activeTab ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50" :
                activeTab === "overdue" || activeTab === "Lost" ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50" :
                (STAGE_PILL_COLORS[activeTab] || "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50")
              )}>
                {STATUS_LABELS[activeTab] || activeTab}
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {STATUS_LABELS[activeTab] || activeTab}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                <span className="font-medium">{kpiTotal} active</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-[var(--primary)]">{formatCurrency(kpiValue)}</span>
                {!activeTab && kpiOverdue > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-bold text-rose-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> {kpiOverdue} overdue
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Detailed Pipeline Content ─── */}
        <div className="crm-card overflow-hidden">
          {/* Opportunities Table */}
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr className="crm-tr border-b border-slate-200/60">
                  <th className="crm-th">Code</th>
                  <th className="crm-th">Name</th>
                  <th className="crm-th">Account</th>
                  <th className="crm-th">Stage</th>
                  <th className="crm-th text-right">Value</th>
                  <th className="crm-th">Progress</th>
                  <th className="crm-th">Close Date</th>
                  <th className="crm-th">Assigned To</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="crm-td text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                        <p className="text-sm text-slate-400">Loading opportunities...</p>
                      </div>
                    </td>
                  </tr>
                ) : deals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="crm-td text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-sm font-semibold text-slate-500">No opportunities in {STATUS_LABELS[activeTab] || "this filter"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  deals.map((deal) => {
                    const isOverdue = deal.isOverdue || (deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date() && !["Won", "Lost"].includes(deal.status));
                    return (
                      <tr
                      key={deal.id}
                      className="crm-tr table-row-clickable"
                      onClick={() => router.push(`/sales-pipeline/${deal.id}/opportunity-detail`)}
                    >
                        <td className="crm-td">
                          <span className="text-xs font-bold text-slate-500 font-mono">{deal.opportunityCode || "—"}</span>
                        </td>
                        <td className="crm-td">
                          <span className="row-primary-link">{deal.dealName}</span>
                        </td>
                        <td className="crm-td">
                          <p className="font-semibold text-slate-700 text-sm">{deal.customer?.name || "—"}</p>
                          <p className="text-[11px] text-slate-400">{deal.customer?.customerCode}</p>
                        </td>
                        <td className="crm-td">
                          <span className={cn("px-2.5 py-1 text-xs font-bold rounded-lg border", STAGE_PILL_COLORS[deal.status] || "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50")}>
                            {STAGE_LABELS[deal.status] || deal.status}
                          </span>
                        </td>
                        <td className="crm-td text-right font-bold text-[var(--primary)] text-sm">
                          {formatCurrency(deal.dealValue)}
                        </td>
                        <td className="crm-td">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[60px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                role="progressbar"
                                aria-valuenow={deal.probabilityPercent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${deal.dealName}, ${deal.probabilityPercent}% complete, ${STAGE_LABELS[deal.status] || deal.status} stage`}
                                className={cn(
                                  "h-full rounded-full transition-all duration-[350ms] ease-out",
                                  deal.status === "Won" ? "bg-emerald-500" : deal.status === "Lost" ? "bg-rose-500" : "bg-[var(--primary)]"
                                )}
                                style={{ width: `${deal.probabilityPercent}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-slate-600 shrink-0">{deal.probabilityPercent}%</span>
                          </div>
                        </td>
                        <td className="crm-td">
                          <span className={cn("text-sm font-medium", isOverdue ? "text-rose-600 font-bold" : "text-slate-600")}>
                            {formatDate(deal.expectedCloseDate)}
                          </span>
                          {isOverdue && <AlertTriangle size={11} className="inline ml-1 text-rose-500" />}
                        </td>
                        <td className="crm-td">
                          <span className="text-sm text-slate-600">{deal.assignedUser?.name || "—"}</span>
                        </td>
                        <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => router.push(`/sales-pipeline/${deal.id}/opportunity-detail`)}
                              className="row-action-btn text-[var(--primary)]"
                              title="Workflow"
                            >
                              <Zap size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </PageShell>
  );
}

export default function SalesPipelineListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <SalesPipelineListContent />
    </Suspense>
  );
}
