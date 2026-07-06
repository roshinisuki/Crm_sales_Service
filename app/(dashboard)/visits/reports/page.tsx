"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { cn } from "@/lib/ui-utils";
import { Download, BarChart3, MapPin, Clock, AlertTriangle, CheckCircle, X, TrendingUp } from "lucide-react";

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
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Visit Reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Analyze customer visit data</p>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md cursor-pointer"><Download size={16} /> Export CSV</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary.total, color: "text-slate-800 dark:text-slate-100", tint: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400", icon: BarChart3 },
          { label: "Planned", value: summary.planned, color: "text-blue-600", tint: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400", icon: Clock },
          { label: "Checked In", value: summary.checkedIn, color: "text-amber-600", tint: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400", icon: MapPin },
          { label: "Checked Out", value: summary.checkedOut, color: "text-teal-600", tint: "bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400", icon: CheckCircle },
          { label: "Completed", value: summary.completed, color: "text-green-600", tint: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400", icon: CheckCircle },
          { label: "Missed", value: summary.missed, color: "text-red-600", tint: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400", icon: X },
          { label: "Needs Review", value: summary.needsReview, color: "text-orange-600", tint: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400", icon: AlertTriangle },
          { label: "No Show", value: summary.noShow, color: "text-red-600", tint: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400", icon: X },
          { label: "Auto Checked Out", value: summary.autoCheckedOut, color: "text-orange-600", tint: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400", icon: AlertTriangle },
          { label: "Completion Rate", value: `${summary.completionRate}%`, color: "text-emerald-600", tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400", icon: TrendingUp },
          { label: "Avg Duration", value: `${summary.avgDuration} min`, color: "text-amber-600", tint: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400", icon: Clock },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="crm-card p-4 flex items-center gap-3">
              <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", card.tint)}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{card.label}</p>
                <p className={cn("text-lg font-bold tabular-nums leading-tight", card.color)}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visit Type Breakdown */}
      <div className="crm-card p-5">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Visit Type Breakdown</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50/80 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Field Visits</p>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{summary.fieldVisits}</p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Avg: {summary.fieldAvgDuration} min</p>
          </div>
          <div className="bg-purple-50/80 dark:bg-purple-950/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/50">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Office Visits</p>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{summary.officeVisits}</p>
            <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">Avg: {summary.officeAvgDuration} min</p>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: "GPS Compliance", value: `${summary.gpsComplianceRate}%`, sub: "Field visits within 500m of registered site", color: "text-emerald-600", icon: MapPin },
          { title: "Auto Checked Out", value: summary.autoCheckedOut, sub: "Reps forgetting to check out", color: "text-orange-600", icon: AlertTriangle },
          { title: "Location Verification", value: `${summary.locationVerifiedRate}%`, sub: "Visits with verified GPS check-in", color: "text-emerald-600", icon: CheckCircle },
          { title: "Needs Review", value: summary.needsReview, sub: "Visits active > 12h without checkout", color: "text-orange-600", icon: Clock },
          { title: "No Show", value: summary.noShow, sub: "Office visits where customer didn't arrive", color: "text-red-600", icon: X },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="crm-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{metric.title}</h3>
                <Icon size={15} className="text-slate-300" />
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", metric.color)}>{metric.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{metric.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Missed Visit Rate by Executive */}
      {summary.missedVisitRateByExecutive.length > 0 && (
        <div className="crm-card p-5">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Missed Visit Rate by Executive</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Executive</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Total Planned</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Missed</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Missed Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.missedVisitRateByExecutive.map((exec) => (
                  <tr key={exec.executiveId} className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">{exec.executiveName}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 text-right tabular-nums">{exec.totalPlanned}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 text-right tabular-nums">{exec.missed}</td>
                    <td className="px-3 py-2.5 text-sm text-right tabular-nums">
                      <span className={cn("font-bold", exec.missedRate > 20 ? "text-red-600" : exec.missedRate > 10 ? "text-orange-600" : "text-emerald-600")}>{exec.missedRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Office Visits by Host */}
      {summary.officeVisitsByHost.length > 0 && (
        <div className="crm-card p-5">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Office Visits by Host</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {summary.officeVisitsByHost.map((host) => (
              <div key={host.hostId} className="bg-purple-50/80 dark:bg-purple-950/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800/50">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">{host.hostName}</p>
                <p className="text-xl font-bold text-purple-800 dark:text-purple-300">{host.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="crm-card p-4 space-y-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">Filters</h3>
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
          <button onClick={loadReport} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md cursor-pointer">Apply</button>
          <button onClick={handleReset} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer">Reset</button>
        </div>
      </div>

      {/* Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Host</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Purpose</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Check-In</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Check-Out</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Outcome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Status</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                  <p className="text-sm">Loading...</p>
                </div>
              </td></tr>
              : visits.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">No visits found</td></tr>
              : visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{v.customerName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.hostName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.purpose}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.checkInTime ? new Date(v.checkInTime).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right tabular-nums">{v.duration !== null ? `${v.duration} min` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.outcome}</td>
                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[v.status] || "bg-gray-100 text-gray-600"}`}>{statusLabels[v.status] || v.status.replace(/_/g, " ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
