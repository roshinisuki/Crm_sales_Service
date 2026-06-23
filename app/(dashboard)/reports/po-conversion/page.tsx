"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { TrendingUp, FileText, Percent, CheckCircle, DollarSign, Download, Search } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Pending: "bg-amber-50 text-amber-600",
  Approved: "bg-emerald-50 text-emerald-600",
  Rejected: "bg-rose-50 text-rose-600",
  SentToERP: "bg-blue-50 text-blue-600",
  Synced: "bg-indigo-50 text-indigo-600",
};

export default function POConversionReportPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [pos, setPOs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [poRes, dealRes] = await Promise.all([
        fetch(`/api/purchase-orders?${statusFilter ? new URLSearchParams({ status: statusFilter }) : ""}`),
        fetch("/api/deals"),
      ]);
      const poData = await poRes.json();
      const dealData = await dealRes.json();
      if (poData.success) setPOs(poData.data || []);
      if (dealData.success) setDeals(dealData.data || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = pos.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.poCode?.toLowerCase().includes(q) || p.deal?.dealName?.toLowerCase().includes(q) || p.customer?.name?.toLowerCase().includes(q);
  });

  const totalDeals = deals.length;
  const totalPOs = pos.length;
  const conversionRate = totalDeals > 0 ? ((totalPOs / totalDeals) * 100).toFixed(1) : "0";
  const approvedPOs = pos.filter(p => p.status === "Approved" || p.status === "SentToERP" || p.status === "Synced").length;
  const totalPOValue = pos.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("No data to export"); return; }
    const headers = ["PO Code", "Deal", "Customer", "Status", "Total Amount", "Created Date", "Approved Date", "Synced Date"];
    const rows = filtered.map(p => [
      p.poCode || "",
      p.deal?.dealName || "",
      p.customer?.name || "",
      p.status || "",
      p.totalAmount || 0,
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
      p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "",
      p.syncedAt ? new Date(p.syncedAt).toLocaleDateString() : "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `po_conversion_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <PageShell
      title="PO Conversion Report"
      subtitle="Track deal-to-PO conversion rates and PO lifecycle"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "PO Conversion Report" }]}
      action={
        <button onClick={exportCSV} disabled={filtered.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Deals" value={totalDeals} icon={<TrendingUp size={20} />} variant="orange" subtitle="All deals" />
          <SummaryCard label="Total POs" value={totalPOs} icon={<FileText size={20} />} variant="blue" subtitle="Purchase orders" />
          <SummaryCard label="Conversion Rate" value={`${conversionRate}%`} icon={<Percent size={20} />} variant="amber" subtitle="Deals → POs" />
          <SummaryCard label="Approved" value={approvedPOs} icon={<CheckCircle size={20} />} variant="green" subtitle="Approved/Synced" />
          <SummaryCard label="Total Value" value={formatCurrency(totalPOValue)} icon={<DollarSign size={20} />} variant="indigo" subtitle="All POs" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter PO Conversion Report"
          stages={["Draft", "Pending", "Approved", "Rejected", "SentToERP", "Synced"]}
          activeStages={statusFilter ? [statusFilter] : []}
          onToggleStage={(s) => setStatusFilter(statusFilter === s ? "" : s)}
          stageLabel="Status"
          onApply={load}
          onReset={() => { setStatusFilter(""); setSearch(""); }}
          onRefresh={load}
          filters={[
            <FilterField label="Search" key="search">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></div>
                <input type="text" placeholder="Search by code, deal, or customer..." value={search} onChange={e => setSearch(e.target.value)} className={`${filterInputClass} pl-9`} />
              </div>
            </FilterField>,
          ]}
        />

        {/* Data Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">PO Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approved</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No purchase orders found</td></tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.poCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{p.deal?.dealName || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.customer?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{formatCurrency(Number(p.totalAmount || 0))}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.syncedAt ? new Date(p.syncedAt).toLocaleDateString() : "—"}</td>
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
