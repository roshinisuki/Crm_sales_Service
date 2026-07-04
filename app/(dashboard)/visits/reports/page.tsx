"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = { download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l-4 4m0 0l-4-4m4 4V4" };

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-amber-100 text-amber-700",
  CHECKED_OUT: "bg-teal-100 text-teal-700",
  COMPLETED: "bg-green-100 text-green-700",
  MISSED: "bg-red-100 text-red-700",
  NEEDS_REVIEW: "bg-orange-100 text-orange-700",
  NO_SHOW: "bg-red-100 text-red-700",
  CUSTOMER_UNAVAILABLE: "bg-slate-100 text-slate-700",
};

const statusLabels: Record<string, string> = {
  PLANNED: "Planned",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  COMPLETED: "Completed",
  MISSED: "Missed",
  NEEDS_REVIEW: "Needs Review",
  NO_SHOW: "No Show",
  CUSTOMER_UNAVAILABLE: "Unavailable",
};

export default function VisitReportsPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [visits, setVisits] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    planned: 0,
    checkedIn: 0,
    checkedOut: 0,
    completed: 0,
    missed: 0,
    needsReview: 0,
    noShow: 0,
    unavailable: 0,
    autoCheckedOut: 0,
    avgDuration: 0,
    completionRate: 0,
    fieldVisits: 0,
    officeVisits: 0,
    fieldAvgDuration: 0,
    officeAvgDuration: 0,
    gpsComplianceRate: 0,
    locationVerifiedRate: 0,
    keyAccountComplianceRate: 0,
    missedVisitRateByExecutive: [] as { executiveId: string; executiveName: string; totalPlanned: number; missed: number; missedRate: number }[],
    officeVisitsByHost: [] as { hostId: string; hostName: string; total: number }[],
  });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "All",
    hostedBy: "",
    customerId: "",
  });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
    fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.status) params.set("status", filters.status);
      if (filters.hostedBy) params.set("hostedBy", filters.hostedBy);
      if (filters.customerId) params.set("customerId", filters.customerId);
      const res = await fetch(`/api/reports/visits?${params}`);
      const data = await res.json();
      if (data.success) {
        setVisits(data.visits);
        setSummary(data.summary);
      }
    } catch { toast.error("Failed to load report"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReset = () => {
    setFilters({ startDate: "", endDate: "", status: "All", hostedBy: "", customerId: "" });
    setTimeout(loadReport, 100);
  };

  const handleExport = () => {
    const headers = ["Customer Name", "Customer Code", "Host", "Purpose", "Meeting Type", "Check-In", "Check-Out", "Duration (mins)", "Outcome", "Customer Decision", "Status"];
    const rows = visits.map((v) => [
      v.customerName, v.customerCode, v.hostName, v.purpose, v.meetingType,
      v.checkInTime ? new Date(v.checkInTime).toLocaleString() : "",
      v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : "",
      v.duration ?? "",
      v.outcome, v.customerDecision, v.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visit-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Visit Reports</h1><p className="text-sm text-slate-500 mt-0.5">Analyze customer visit data</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"><Ico d={icons.download} size={16} /> Export CSV</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary.total, color: "text-slate-800" },
          { label: "Planned", value: summary.planned, color: "text-blue-600" },
          { label: "Checked In", value: summary.checkedIn, color: "text-amber-600" },
          { label: "Checked Out", value: summary.checkedOut, color: "text-teal-600" },
          { label: "Completed", value: summary.completed, color: "text-green-600" },
          { label: "Missed", value: summary.missed, color: "text-red-600" },
          { label: "Needs Review", value: summary.needsReview, color: "text-orange-600" },
          { label: "No Show", value: summary.noShow, color: "text-red-600" },
          { label: "Auto Checked Out", value: summary.autoCheckedOut, color: "text-orange-600" },
          { label: "Completion Rate", value: `${summary.completionRate}%`, color: "text-emerald-600" },
          { label: "Avg Duration", value: `${summary.avgDuration} min`, color: "text-amber-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Visit Type Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Visit Type Breakdown</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700">Field Visits</p>
            <p className="text-2xl font-bold text-blue-800">{summary.fieldVisits}</p>
            <p className="text-xs text-blue-600 mt-1">Avg: {summary.fieldAvgDuration} min</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-700">Office Visits</p>
            <p className="text-2xl font-bold text-purple-800">{summary.officeVisits}</p>
            <p className="text-xs text-purple-600 mt-1">Avg: {summary.officeAvgDuration} min</p>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">GPS Compliance</h3>
          <p className="text-3xl font-bold text-emerald-600">{summary.gpsComplianceRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Field visits within 500m of registered site</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Auto Checked Out</h3>
          <p className="text-3xl font-bold text-orange-600">{summary.autoCheckedOut}</p>
          <p className="text-xs text-slate-500 mt-1">Reps forgetting to check out</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Location Verification</h3>
          <p className="text-3xl font-bold text-emerald-600">{summary.locationVerifiedRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Visits with verified GPS check-in</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Needs Review</h3>
          <p className="text-3xl font-bold text-orange-600">{summary.needsReview}</p>
          <p className="text-xs text-slate-500 mt-1">Visits active &gt; 12h without checkout</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">No Show</h3>
          <p className="text-3xl font-bold text-red-600">{summary.noShow}</p>
          <p className="text-xs text-slate-500 mt-1">Office visits where customer didn't arrive</p>
        </div>
      </div>

      {/* Missed Visit Rate by Executive */}
      {summary.missedVisitRateByExecutive.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Missed Visit Rate by Executive</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Executive</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Total Planned</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Missed</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Missed Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.missedVisitRateByExecutive.map((exec) => (
                  <tr key={exec.executiveId} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-700">{exec.executiveName}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 text-right">{exec.totalPlanned}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 text-right">{exec.missed}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 text-right">{exec.missedRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Office Visits by Host */}
      {summary.officeVisitsByHost.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Office Visits by Host</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {summary.officeVisitsByHost.map((host) => (
              <div key={host.hostId} className="bg-purple-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-purple-700">{host.hostName}</p>
                <p className="text-xl font-bold text-purple-800">{host.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Status</label><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"><option>All</option><option>Planned</option><option>Checked In</option><option>Checked Out</option><option>Completed</option><option>Missed</option><option>Needs Review</option><option>No Show</option><option>Unavailable</option></select></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Hosted By</label><select value={filters.hostedBy} onChange={(e) => setFilters({ ...filters, hostedBy: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"><option value="">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Customer</label>
            <input type="text" placeholder="Search..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 mb-1" />
            <select value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"><option value="">All Customers</option>{filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}</select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadReport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">Apply</button>
          <button onClick={handleReset} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Reset</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Host</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Purpose</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Check-In</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Check-Out</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Duration</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Outcome</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : visits.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No visits found</td></tr>
            : visits.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{v.customerName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.hostName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.purpose}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.checkInTime ? new Date(v.checkInTime).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{v.duration !== null ? `${v.duration} min` : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.outcome}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[v.status] || "bg-gray-100 text-gray-600"}`}>{statusLabels[v.status] || v.status.replace(/_/g, " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
