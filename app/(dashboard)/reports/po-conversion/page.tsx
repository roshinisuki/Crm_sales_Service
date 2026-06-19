"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
};

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  SentToERP: "bg-blue-100 text-blue-700",
  Synced: "bg-purple-100 text-purple-700",
};

export default function POConversionReportPage() {
  const { user } = useAuth();
  const toast = useToast();
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

  // Conversion stats
  const totalDeals = deals.length;
  const totalPOs = pos.length;
  const conversionRate = totalDeals > 0 ? ((totalPOs / totalDeals) * 100).toFixed(1) : "0";
  const approvedPOs = pos.filter(p => p.status === "Approved" || p.status === "SentToERP" || p.status === "Synced").length;
  const syncedPOs = pos.filter(p => p.status === "Synced").length;
  const totalPOValue = pos.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const exportCSV = () => {
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
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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
    <PageContainer>
      <Link href="/reports" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <Ico d={icons.back} size={16} /> Back to Reports
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PO Conversion Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track deal-to-PO conversion rates and PO lifecycle</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          <Ico d={icons.download} size={16} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Deals</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalDeals}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total POs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalPOs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{conversionRate}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{approvedPOs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Value</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">₹{(totalPOValue / 100000).toFixed(1)}L</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {["", "Draft", "Pending", "Approved", "Rejected", "SentToERP", "Synced"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{s || "All"}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Ico d={icons.search} size={16} /></div>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">PO Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Deal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Created</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Approved</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No purchase orders found</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.poCode}</td>
                    <td className="px-4 py-3 text-gray-900">{p.deal?.dealName || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{p.customer?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-gray-100 text-gray-700"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{Number(p.totalAmount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.approvedAt ? new Date(p.approvedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.syncedAt ? new Date(p.syncedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
