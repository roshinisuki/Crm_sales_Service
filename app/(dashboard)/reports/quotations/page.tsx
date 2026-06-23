"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { getCustomersAction } from "@/app/actions/customers";
import { FileText, CheckCircle, XCircle, Clock, Percent, Download, Search } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

const quotationStatuses = ["Sent", "UnderReview", "Accepted", "Rejected", "Expired"];

export default function QuotationsReportPage() {
  const toast = useToast();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalSent: 0, accepted: 0, rejected: 0, expired: 0, acceptanceRate: 0 });
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [filters, setFilters] = useState({ statuses: [] as string[], customerId: "", startDate: "", endDate: "" });

  useEffect(() => {
    getCustomersAction().then(res => { if (res?.success && res.data) setCustomers(res.data); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.statuses.length > 0) params.set("status", filters.statuses.join(","));
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      const res = await fetch(`/api/reports/quotations?${params}`);
      const data = await res.json();
      if (data.success) { setQuotations(data.quotations); setSummary(data.summary); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => { setFilters({ statuses: [], customerId: "", startDate: "", endDate: "" }); setCustomerSearch(""); };
  const toggleStatus = (s: string) => setFilters(f => ({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s] }));

  const handleExport = () => {
    if (quotations.length === 0) { toast.error("No data to export"); return; }
    const headers = ["QUO Code", "Customer", `Grand Total (${preferredCurrency})`, "Discount %", `Final Amount (${preferredCurrency})`, "Status", "Sent At", "Valid Until"];
    const rows = quotations.map(q => [q.quotationCode, q.customerName, q.totalAmount, q.discountPercent, q.finalAmount, q.status, q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "", new Date(q.validUntil).toLocaleDateString()]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `quotations_report_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase()));

  return (
    <PageShell
      title="Quotations Report"
      subtitle="Track quotation performance and acceptance rates"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Quotations Report" }]}
      action={
        <button onClick={handleExport} disabled={quotations.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Sent" value={summary.totalSent} icon={<FileText size={20} />} variant="orange" subtitle="All quotations" />
          <SummaryCard label="Accepted" value={summary.accepted} icon={<CheckCircle size={20} />} variant="green" subtitle="Customer accepted" />
          <SummaryCard label="Rejected" value={summary.rejected} icon={<XCircle size={20} />} variant="light" subtitle="Customer declined" />
          <SummaryCard label="Expired" value={summary.expired} icon={<Clock size={20} />} variant="slate" subtitle="Past validity" />
          <SummaryCard label="Acceptance Rate" value={`${summary.acceptanceRate}%`} icon={<Percent size={20} />} variant="amber" subtitle="Accepted / Total" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter Quotations"
          stages={quotationStatuses}
          activeStages={filters.statuses}
          onToggleStage={toggleStatus}
          stageLabel="Status"
          onApply={loadReport}
          onReset={handleReset}
          onRefresh={loadReport}
          filters={[
            <FilterField label="Customer" key="customer">
              <select value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })} className={filterInputClass}>
                <option value="">All Customers</option>
                {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
              </select>
            </FilterField>,
            <FilterField label="Start Date" key="start">
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
            <FilterField label="End Date" key="end">
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className={filterInputClass} />
            </FilterField>,
          ]}
        >
          <div className="relative max-w-xs pt-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></div>
            <input type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20" />
          </div>
        </ReportFilterLayout>

        {/* Data Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">QUO Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Grand Total ({preferredCurrency})</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount %</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Final Amount ({preferredCurrency})</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sent At</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valid Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : quotations.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No quotations found</td></tr>
                ) : (
                  quotations.map(q => (
                    <tr key={q.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-xs text-slate-600">{q.quotationCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{q.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(q.totalAmount)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{q.discountPercent}%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{formatCurrency(q.finalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          q.status === "Accepted" ? "bg-emerald-50 text-emerald-600" :
                          q.status === "Rejected" ? "bg-rose-50 text-rose-600" :
                          q.status === "Expired" ? "bg-slate-100 text-slate-600" :
                          q.status === "UnderReview" ? "bg-amber-50 text-amber-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>{q.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(q.validUntil).toLocaleDateString()}</td>
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
