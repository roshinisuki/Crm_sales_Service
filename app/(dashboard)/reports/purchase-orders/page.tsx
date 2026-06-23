"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { getCustomersAction } from "@/app/actions/customers";
import { PackageCheck, Clock, CheckCircle, XCircle, Download, DollarSign } from "lucide-react";
import { ReportFilterLayout, FilterField, filterInputClass } from "@/components/reports/ReportFilterLayout";

const poStatuses = ["Draft", "Pending", "Approved", "Rejected", "SentToERP", "Synced"];

export default function PurchaseOrderReportPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [pos, setPOs] = useState<any[]>([]);
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
      const params = new URLSearchParams();
      if (filters.statuses.length === 1) params.set("status", filters.statuses[0]);
      if (filters.customerId) params.set("customerId", filters.customerId);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);

      const firstRes = await fetch(`/api/purchase-orders?${params}&page=1`);
      const firstData = await firstRes.json();
      if (!firstData.success) { toast.error("Failed to load"); return; }

      let allPOs = [...(firstData.data || [])];
      const totalPages = firstData.totalPages || 1;

      if (totalPages > 1) {
        const remaining = [];
        for (let p = 2; p <= totalPages; p++) {
          remaining.push(fetch(`/api/purchase-orders?${params}&page=${p}`).then(r => r.json()));
        }
        const results = await Promise.all(remaining);
        results.forEach(d => { if (d.success) allPOs = [...allPOs, ...(d.data || [])]; });
      }

      const filtered = filters.statuses.length > 1
        ? allPOs.filter(p => filters.statuses.includes(p.status))
        : allPOs;

      setPOs(filtered);
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
  const total = pos.length;
  const approved = pos.filter(p => ["Approved", "SentToERP", "Synced"].includes(p.status)).length;
  const pending = pos.filter(p => p.status === "Pending").length;
  const rejected = pos.filter(p => p.status === "Rejected").length;
  const synced = pos.filter(p => p.status === "Synced").length;
  const totalValue = pos.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const handleExport = () => {
    if (pos.length === 0) { toast.error("No data to export"); return; }
    const headers = ["PO Code", "Customer", "Deal", "Status", "Total Amount", "Items", "Assigned To", "Created Date"];
    const rows = pos.map(p => [
      p.poCode || "",
      p.customer?.name || "",
      p.deal?.dealName || "",
      p.status || "",
      p.totalAmount || 0,
      p._count?.items || 0,
      p.assignedUser?.name || "Unassigned",
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_order_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <PageShell
      title="Purchase Order Report"
      subtitle="PO lifecycle, approval status & ERP sync tracking"
      breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Purchase Order Report" }]}
      action={
        <button
          onClick={handleExport}
          disabled={pos.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Export to CSV
        </button>
      }
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total POs" value={total} icon={<PackageCheck size={20} />} variant="orange" subtitle="All purchase orders" />
          <SummaryCard label="Approved" value={approved} icon={<CheckCircle size={20} />} variant="green" subtitle="Approved / Sent / Synced" />
          <SummaryCard label="Pending" value={pending} icon={<Clock size={20} />} variant="amber" subtitle="Awaiting approval" />
          <SummaryCard label="Rejected" value={rejected} icon={<XCircle size={20} />} variant="light" subtitle="Declined POs" />
          <SummaryCard label="Total Value" value={formatCurrency(totalValue)} icon={<DollarSign size={20} />} variant="dark" subtitle={`Synced: ${synced}`} />
        </div>

        {/* Filters Panel */}
        <ReportFilterLayout
          title="Filter PO Report"
          stages={poStatuses}
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
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">PO Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Loading...</td></tr>
                ) : pos.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No purchase orders found</td></tr>
                ) : (
                  pos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-xs text-slate-600">{p.poCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.customer?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.deal?.dealName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "Synced" ? "bg-purple-50 text-purple-600" :
                          p.status === "Approved" || p.status === "SentToERP" ? "bg-emerald-50 text-emerald-600" :
                          p.status === "Rejected" ? "bg-rose-50 text-rose-600" :
                          p.status === "Pending" ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-600"
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right font-semibold">{formatCurrency(Number(p.totalAmount || 0))}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">{p._count?.items || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.assignedUser?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
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
