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

export default function SalesPerformanceReportPage() {
  const toast = useToast();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalDealsWon: 0, totalLeads: 0, avgRevenuePerExec: 0 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", assignedUserId: "" });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      const res = await fetch(`/api/reports/sales-performance?${params}`);
      const data = await res.json();
      if (data.success) { setRows(data.rows); setSummary(data.summary); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => { setFilters({ startDate: "", endDate: "", assignedUserId: "" }); };

  const handleExport = () => {
    const headers = ["Exec Name", "Leads", "Calls", "Meetings", "Visits", "RFQs", "Quotations Sent", "Won Deals", `Revenue (${preferredCurrency})`];
    const rowsData = rows.map(r => [r.name, r.leadsAssigned, r.callsMade, r.meetingsDone, r.visits, r.rfqs, r.quotationsSent, r.wonDeals, r.revenue]);
    const csv = [headers, ...rowsData].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sales-performance-report.csv"; a.click();
    toast.success("CSV exported");
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Sales Performance Report</h1><p className="text-sm text-slate-500 mt-0.5">Per-executive performance metrics</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.download} size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ l: "Total Revenue", v: formatCurrency(summary.totalRevenue), c: "text-[#D44D4D]" }, { l: "Total Deals Won", v: summary.totalDealsWon, c: "text-green-600" }, { l: "Total Leads", v: summary.totalLeads, c: "text-blue-600" }, { l: "Avg Revenue/Exec", v: formatCurrency(summary.avgRevenuePerExec), c: "text-amber-600" }].map(card => (
          <div key={card.l} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4"><p className="text-xs font-semibold text-slate-500 uppercase">{card.l}</p><p className={`text-xl font-bold mt-1 ${card.c}`}>{card.v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Executive</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer"><option value="">All</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        </div>
        <div className="flex gap-2"><button onClick={loadReport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer">Apply</button><button onClick={handleReset} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Reset</button></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Exec Name</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Leads</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Calls</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Meetings</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Visits</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">RFQs</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Quotations</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Won Deals</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Revenue ({preferredCurrency})</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-slate-400">No data found</td></tr>
            : rows.map(r => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.leadsAssigned}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.callsMade}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.meetingsDone}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.visits}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.rfqs}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.quotationsSent}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{r.wonDeals}</td>
                <td className="px-4 py-3 text-sm font-bold text-[#D44D4D] text-right">{formatCurrency(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
