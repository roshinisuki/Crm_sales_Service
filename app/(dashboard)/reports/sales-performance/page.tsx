"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { DollarSign, Trophy, Users, TrendingUp, Download } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

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
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Exec Name", "Leads", "Calls", "Meetings", "Visits", "RFQs", "Quotations Sent", "Won Deals", `Revenue (${preferredCurrency})`];
    const rowsData = rows.map(r => [r.name, r.leadsAssigned, r.callsMade, r.meetingsDone, r.visits, r.rfqs, r.quotationsSent, r.wonDeals, r.revenue]);
    const csv = "\uFEFF" + [headers, ...rowsData].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sales_performance_report_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    toast.success("CSV exported");
  };

  return (
    <PageShell
      title="Sales Performance Report"
      subtitle="Per-executive performance metrics"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Sales Performance Report" }]}
      action={
        <button onClick={handleExport} disabled={rows.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={<DollarSign size={20} />} variant="orange" subtitle="All won deals" />
          <SummaryCard label="Total Deals Won" value={summary.totalDealsWon} icon={<Trophy size={20} />} variant="green" subtitle="Closed won" />
          <SummaryCard label="Total Leads" value={summary.totalLeads} icon={<Users size={20} />} variant="blue" subtitle="Assigned leads" />
          <SummaryCard label="Avg Revenue/Exec" value={formatCurrency(summary.avgRevenuePerExec)} icon={<TrendingUp size={20} />} variant="amber" subtitle="Per executive" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter Performance"
          onApply={loadReport}
          onReset={handleReset}
          onRefresh={loadReport}
          filters={[
            <FilterField label="Start Date" key="start">
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
            <FilterField label="End Date" key="end">
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
            <FilterField label="Executive" key="exec">
              <select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className={filterInputClass}>
                <option value="">All Executives</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FilterField>,
          ]}
        />

        {/* Data Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exec Name</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Leads</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Calls</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Meetings</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visits</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">RFQs</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotations</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Won Deals</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Revenue ({preferredCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No data found</td></tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.leadsAssigned}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.callsMade}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.meetingsDone}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.visits}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.rfqs}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.quotationsSent}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{r.wonDeals}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[var(--accent)] text-right">{formatCurrency(r.revenue)}</td>
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
