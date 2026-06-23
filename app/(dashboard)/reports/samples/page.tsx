"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { getCustomersAction } from "@/app/actions/customers";
import { Stethoscope, PackageCheck, Clock, AlertCircle, Download } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

const sampleStatuses = ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"];

export default function SampleReportPage() {
  const toast = useToast();
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [filters, setFilters] = useState({
    statuses: [] as string[],
    customerId: "",
    assignedUserId: "",
  });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
    getCustomersAction().then(res => { if (res?.success && res.data) setCustomers(res.data); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Fetch all pages to build complete report
      const params = new URLSearchParams();
      if (filters.statuses.length === 1) params.set("status", filters.statuses[0]);
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);

      const firstRes = await fetch(`/api/samples?${params}&page=1`);
      const firstData = await firstRes.json();
      if (!firstData.success) { toast.error("Failed to load"); return; }

      let allSamples = [...(firstData.data || [])];
      const totalPages = firstData.totalPages || 1;

      if (totalPages > 1) {
        const remaining = [];
        for (let p = 2; p <= totalPages; p++) {
          remaining.push(fetch(`/api/samples?${params}&page=${p}`).then(r => r.json()));
        }
        const results = await Promise.all(remaining);
        results.forEach(d => { if (d.success) allSamples = [...allSamples, ...(d.data || [])]; });
      }

      // Client-side filter for multiple statuses
      const filtered = filters.statuses.length > 1
        ? allSamples.filter(s => filters.statuses.includes(s.status))
        : allSamples;

      setSamples(filtered);
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => {
    setFilters({ statuses: [], customerId: "", assignedUserId: "" });
    setCustomerSearch("");
  };

  const toggleStatus = (s: string) =>
    setFilters(f => ({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s] }));

  // KPIs
  const total = samples.length;
  const approved = samples.filter(s => s.status === "Approved").length;
  const pending = samples.filter(s => ["New", "UnderReview", "SentToCustomer", "Revision"].includes(s.status)).length;
  const rejected = samples.filter(s => s.status === "Rejected").length;
  const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : "0";

  const handleExport = () => {
    if (samples.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Sample Code", "Customer", "Product", "Quantity", "Status", "Assigned To", "Created Date"];
    const rows = samples.map(s => [
      s.sampleCode || "",
      s.customer?.name || "",
      s.product?.name || "",
      s.quantity || 0,
      s.status || "",
      s.assignedUser?.name || "Unassigned",
      s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sample_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <PageShell
      title="Sample Report"
      subtitle="Sample dispatch tracking, approval status & conversion analysis"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Sample Report" }]}
      action={
        <button
          onClick={handleExport}
          disabled={samples.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Samples" value={total} icon={<Stethoscope size={20} />} variant="orange" subtitle="All sample requests" />
          <SummaryCard label="Approved" value={approved} icon={<PackageCheck size={20} />} variant="green" subtitle={`Approval rate: ${approvalRate}%`} />
          <SummaryCard label="Pending" value={pending} icon={<Clock size={20} />} variant="amber" subtitle="Awaiting decision" />
          <SummaryCard label="Rejected" value={rejected} icon={<AlertCircle size={20} />} variant="light" subtitle="Declined samples" />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter Sample Report"
          stages={sampleStatuses}
          activeStages={filters.statuses}
          onToggleStage={toggleStatus}
          stageLabel="Status"
          onApply={loadReport}
          onReset={handleReset}
          onRefresh={loadReport}
          filters={[
            <FilterField label="Customer" key="customer">
              <input type="text" placeholder="Search..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className={`${filterInputClass} mb-1.5`} />
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
          ]}
        />

        {/* Data Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sample Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : samples.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No samples found</td></tr>
                ) : (
                  samples.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-xs text-slate-600">{s.sampleCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{s.customer?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{s.product?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{s.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === "Approved" ? "bg-emerald-50 text-emerald-600" :
                          s.status === "Rejected" ? "bg-rose-50 text-rose-600" :
                          s.status === "SentToCustomer" ? "bg-purple-50 text-purple-600" :
                          s.status === "Revision" ? "bg-orange-50 text-orange-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{s.assignedUser?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
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
