"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { getCustomersAction } from "@/app/actions/customers";
import { FileText, Eye, Calculator, CheckCircle, Archive, Download, Search } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

const rfqStatuses = ["New", "UnderReview", "CostingPending", "QuotationCreated", "Closed"];

export default function RFQReportPage() {
  const toast = useToast();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, underReview: 0, costingPending: 0, converted: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [filters, setFilters] = useState({ statuses: [] as string[], customerId: "", assignedUserId: "", startDate: "", endDate: "" });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
    getCustomersAction().then(res => { if (res?.success && res.data) setCustomers(res.data); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.statuses.length > 0) params.set("status", filters.statuses.join(","));
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      const res = await fetch(`/api/reports/rfq?${params}`);
      const data = await res.json();
      if (data.success) { setRfqs(data.rfqs); setSummary(data.summary); }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => { setFilters({ statuses: [], customerId: "", assignedUserId: "", startDate: "", endDate: "" }); setCustomerSearch(""); };
  const toggleStatus = (s: string) => setFilters(f => ({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s] }));

  const handleExport = () => {
    if (rfqs.length === 0) { toast.error("No data to export"); return; }
    const headers = ["RFQ Code", "Customer", "Product", "Quantity", "Status", "Assigned To", "Received Date"];
    const rows = rfqs.map(r => [r.rfqCode, r.customerName, r.productName, r.quantity, r.status, r.assignedTo, r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : ""]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rfq_report_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase()));

  return (
    <PageShell
      title="RFQ Report"
      subtitle="Track RFQ pipeline and conversions"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "RFQ Report" }]}
      action={
        <button onClick={handleExport} disabled={rfqs.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total RFQs" value={summary.total} icon={<FileText size={20} />} variant="orange" subtitle="All requests" />
          <SummaryCard label="Under Review" value={summary.underReview} icon={<Eye size={20} />} variant="amber" subtitle="Being reviewed" />
          <SummaryCard label="Costing Pending" value={summary.costingPending} icon={<Calculator size={20} />} variant="red" subtitle="Awaiting costing" />
          <SummaryCard label="Converted" value={summary.converted} icon={<CheckCircle size={20} />} variant="green" subtitle="Quotation created" />
          <SummaryCard label="Closed" value={summary.closed} icon={<Archive size={20} />} variant="blue" subtitle="Closed RFQs" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter RFQ Report"
          stages={rfqStatuses}
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
            <FilterField label="Assigned To" key="assigned">
              <select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className={filterInputClass}>
                <option value="">All Executives</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">RFQ Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : rfqs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No RFQs found</td></tr>
                ) : (
                  rfqs.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-xs text-slate-600">{r.rfqCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.productName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{r.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === "QuotationCreated" ? "bg-emerald-50 text-emerald-600" :
                          r.status === "Closed" ? "bg-blue-50 text-blue-600" :
                          r.status === "CostingPending" ? "bg-orange-50 text-orange-600" :
                          r.status === "UnderReview" ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-600"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.assignedTo}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : "—"}</td>
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
