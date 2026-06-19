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
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-amber-100 text-amber-700",
  Closed: "bg-green-100 text-green-700",
  OnHold: "bg-gray-100 text-gray-700",
};

export default function NegotiationReportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await fetch(`/api/negotiations?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setNegotiations(data.data || []);
    } catch {
      toast.error("Failed to load negotiations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = negotiations.filter((n: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.negoCode?.toLowerCase().includes(q) || n.deal?.dealName?.toLowerCase().includes(q) || n.customer?.name?.toLowerCase().includes(q);
  });

  // Summary stats
  const totalNegotiations = filtered.length;
  const closedCount = filtered.filter(n => n.status === "Closed").length;
  const inProgressCount = filtered.filter(n => n.status === "InProgress").length;
  const avgDiscount = filtered.length > 0
    ? (filtered.reduce((sum, n) => sum + (n.finalDiscountPercent || 0), 0) / filtered.length).toFixed(1)
    : "0";

  const exportCSV = () => {
    const headers = ["Code", "Deal", "Customer", "Status", "Initial Price", "Final Price", "Discount %", "Created Date", "Closed Date"];
    const rows = filtered.map(n => [
      n.negoCode || "",
      n.deal?.dealName || "",
      n.customer?.name || "",
      n.status || "",
      n.initialPrice || 0,
      n.finalPrice || 0,
      n.finalDiscountPercent || 0,
      n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "",
      n.closedAt ? new Date(n.closedAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negotiations_report_${new Date().toISOString().split("T")[0]}.csv`;
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
          <h1 className="text-2xl font-bold text-gray-900">Negotiation Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analyze negotiation outcomes and discount trends</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          <Ico d={icons.download} size={16} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Negotiations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalNegotiations}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inProgressCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Closed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{closedCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Discount</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{avgDiscount}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {["", "Open", "InProgress", "Closed", "OnHold"].map(s => (
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
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Deal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Initial Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Final Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Discount %</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No negotiations found</td></tr>
              ) : (
                filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{n.negoCode}</td>
                    <td className="px-4 py-3 text-gray-900">{n.deal?.dealName || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{n.customer?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[n.status] || "bg-gray-100 text-gray-700"}`}>{n.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{Number(n.initialPrice || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{Number(n.finalPrice || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">{n.finalDiscountPercent || 0}%</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
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
