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
    fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
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

  const handleReset = () => { setFilters({ statuses: [], customerId: "", startDate: "", endDate: "" }); };
  const toggleStatus = (s: string) => setFilters(f => ({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s] }));

  const handleExport = () => {
    const headers = ["QUO Code", "Customer", "Grand Total", "Discount %", "Final Amount", "Status", "Sent At", "Valid Until"];
    const rows = quotations.map(q => [q.quotationCode, q.customerName, q.totalAmount, q.discountPercent, q.finalAmount, q.status, q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "", new Date(q.validUntil).toLocaleDateString()]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "quotations-report.csv"; a.click();
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase()));

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Quotations Report</h1><p className="text-sm text-slate-500 mt-0.5">Track quotation performance and acceptance rates</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.download} size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ l: "Total Sent", v: summary.totalSent, c: "text-slate-800" }, { l: "Accepted", v: summary.accepted, c: "text-green-600" }, { l: "Rejected", v: summary.rejected, c: "text-red-600" }, { l: "Expired", v: summary.expired, c: "text-gray-600" }, { l: "Acceptance Rate", v: `${summary.acceptanceRate}%`, c: "text-amber-600" }].map(card => (
          <div key={card.l} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4"><p className="text-xs font-semibold text-slate-500 uppercase">{card.l}</p><p className={`text-xl font-bold mt-1 ${card.c}`}>{card.v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Status</label><div className="flex flex-wrap gap-1">{quotationStatuses.map(s => <button key={s} onClick={() => toggleStatus(s)} className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${filters.statuses.includes(s) ? "bg-[#D44D4D] text-white" : "bg-slate-100 text-slate-700"}`}>{s}</button>)}</div></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Customer</label><input type="text" placeholder="Search..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm mb-1 block" /><select value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer"><option value="">All</option>{filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm" /></div>
        </div>
        <div className="flex gap-2"><button onClick={loadReport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer">Apply</button><button onClick={handleReset} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Reset</button></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">QUO Code</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Grand Total ({preferredCurrency})</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Discount %</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Final Amount ({preferredCurrency})</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Sent At</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Valid Until</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : quotations.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No quotations found</td></tr>
            : quotations.map(q => (
              <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{q.quotationCode}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.customerName}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(q.totalAmount)}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{q.discountPercent}%</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{formatCurrency(q.finalAmount)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.status}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{new Date(q.validUntil).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
