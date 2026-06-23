"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { TrendingUp, Trophy, XCircle, Activity, Percent, Download } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

export default function OpportunitiesReportPage() {
  const toast = useToast();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const [deals, setDeals] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, won: 0, lost: 0, active: 0, winRate: 0 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [filters, setFilters] = useState({ stages: [] as string[], assignedUserId: "", startDate: "", endDate: "" });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
    fetch("/api/settings/pipeline-stages").then(res => res.json()).then(data => { if (data.success) setStageOptions((data.data || []).map((s: any) => s.name)); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.stages.length > 0) params.set("stage", filters.stages.join(","));
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      const res = await fetch(`/api/reports/opportunities?${params}`);
      const data = await res.json();
      if (data.success) { setDeals(data.deals); setSummary(data.summary); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => { setFilters({ stages: [], assignedUserId: "", startDate: "", endDate: "" }); };

  const handleExport = () => {
    if (deals.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Deal Name", "Customer", "Stage", `Deal Value (${preferredCurrency})`, "Expected Close", "Assigned To", "Created Date"];
    const rows = deals.map(d => [d.dealName, d.customerName, d.stage, d.dealValue, d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "", d.assignedTo, new Date(d.createdDate).toLocaleDateString()]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opportunities_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exported");
  };

  const toggleStage = (stage: string) => {
    setFilters(f => ({ ...f, stages: f.stages.includes(stage) ? f.stages.filter(s => s !== stage) : [...f.stages, stage] }));
  };

  return (
    <PageShell
      title="Opportunities Report"
      subtitle="Analyze deal pipeline and win rates"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Opportunities Report" }]}
      action={
        <button onClick={handleExport} disabled={deals.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Deals" value={summary.total} icon={<TrendingUp size={20} />} variant="orange" subtitle="All opportunities" />
          <SummaryCard label="Won" value={summary.won} icon={<Trophy size={20} />} variant="green" subtitle="Closed won" />
          <SummaryCard label="Lost" value={summary.lost} icon={<XCircle size={20} />} variant="light" subtitle="Closed lost" />
          <SummaryCard label="Active" value={summary.active} icon={<Activity size={20} />} variant="blue" subtitle="In pipeline" />
          <SummaryCard label="Win Rate" value={`${summary.winRate}%`} icon={<Percent size={20} />} variant="amber" subtitle="Won / Total" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter Opportunities"
          stages={stageOptions}
          activeStages={filters.stages}
          onToggleStage={toggleStage}
          stageLabel="Stages"
          onApply={loadReport}
          onReset={handleReset}
          onRefresh={loadReport}
          filters={[
            <FilterField label="Assigned To" key="assigned">
              <select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className={filterInputClass}>
                <option value="">All Executives</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FilterField>,
            <FilterField label="Start Date" key="start">
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
            <FilterField label="End Date" key="end">
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
          ]}
        />

        {/* Data Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stage</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal Value ({preferredCurrency})</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Close</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : deals.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No deals found</td></tr>
                ) : (
                  deals.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{d.dealName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{d.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{d.stage}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right font-semibold">{formatCurrency(d.dealValue)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{d.assignedTo}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(d.createdDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </PageShell>
  );
}
