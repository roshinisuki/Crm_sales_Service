"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const icons = { download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l-4 4m0 0l-4-4m4 4V4" };

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
    const headers = ["Deal Name", "Customer", "Stage", "Deal Value", "Expected Close", "Assigned To", "Created Date"];
    const rows = deals.map(d => [d.dealName, d.customerName, d.stage, d.dealValue, d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "", d.assignedTo, new Date(d.createdDate).toLocaleDateString()]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "opportunities-report.csv";
    a.click();
    toast.success("CSV exported");
  };

  const toggleStage = (stage: string) => {
    setFilters(f => ({ ...f, stages: f.stages.includes(stage) ? f.stages.filter(s => s !== stage) : [...f.stages, stage] }));
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Opportunities Report</h1><p className="text-sm text-slate-500 mt-0.5">Analyze deal pipeline and win rates</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.download} size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ l: "Total", v: summary.total, c: "text-slate-800" }, { l: "Won", v: summary.won, c: "text-green-600" }, { l: "Lost", v: summary.lost, c: "text-red-600" }, { l: "Active", v: summary.active, c: "text-blue-600" }, { l: "Win Rate %", v: `${summary.winRate}%`, c: "text-amber-600" }].map(card => (
          <div key={card.l} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4"><p className="text-xs font-semibold text-slate-500 uppercase">{card.l}</p><p className={`text-xl font-bold mt-1 ${card.c}`}>{card.v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]"><label className="block text-xs font-semibold text-slate-600 mb-1">Stages</label><div className="flex flex-wrap gap-1">{stageOptions.map(s => <button key={s} onClick={() => toggleStage(s)} className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${filters.stages.includes(s) ? "bg-[#D44D4D] text-white" : "bg-slate-100 text-slate-700"}`}>{s}</button>)}</div></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Assigned To</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer"><option value="">All</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
        </div>
        <div className="flex gap-2"><button onClick={loadReport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer">Apply</button><button onClick={handleReset} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Reset</button></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Deal Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Stage</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Deal Value ({preferredCurrency})</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Expected Close</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Assigned To</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Created Date</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : deals.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No deals found</td></tr>
            : deals.map(d => (
              <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{d.dealName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{d.customerName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{d.stage}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(d.dealValue)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{d.assignedTo}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{new Date(d.createdDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
