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
    gpsIssues: 0,
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
    <PageContainer className="space-y-6 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
      {/* Row 1: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Visit Reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Operations dashboard and visit analytics</p>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-md hover:shadow-lg cursor-pointer">
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Row 2: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Visits", value: summary.total, icon: MapPin },
          { label: "Completed", value: summary.completed, icon: CheckCircle },
          { label: "Missed", value: summary.missed, icon: X },
          { label: "Avg Duration", value: `${summary.avgDuration}m`, icon: Clock },
          { label: "GPS Compliance", value: `${summary.gpsComplianceRate}%`, icon: MapPin },
          { label: "Loc Verified", value: `${summary.locationVerifiedRate}%`, icon: CheckCircle },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
                <Icon size={14} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Row 3: Exception Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Needs Review", value: summary.needsReview, icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
          { label: "Auto Checked Out", value: summary.autoCheckedOut, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800" },
          { label: "No Show", value: summary.noShow, icon: X, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800" },
          { label: "GPS Issues", value: summary.gpsIssues || 0, icon: MapPin, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={cn("rounded-2xl p-4 border flex items-center gap-4", card.bg, card.border)}>
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 shadow-sm shrink-0", card.color)}>
                <Icon size={18} />
              </div>
              <div>
                <p className={cn("text-[11px] font-extrabold uppercase tracking-widest mb-1 opacity-80", card.color)}>{card.label}</p>
                <p className={cn("text-xl font-black tabular-nums leading-none", card.color)}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 4: Compact Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-2 flex flex-col md:flex-row items-center gap-2">
        <div className="flex-1 flex flex-wrap md:flex-nowrap items-center gap-2 w-full">
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" title="Start Date" />
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" title="End Date" />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
            <option value="All">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="Checked In">Checked In</option>
            <option value="Checked Out">Checked Out</option>
            <option value="Completed">Completed</option>
            <option value="Missed">Missed</option>
            <option value="Needs Review">Needs Review</option>
            <option value="No Show">No Show</option>
            <option value="Unavailable">Unavailable</option>
          </select>
          <select value={filters.hostedBy} onChange={(e) => setFilters({ ...filters, hostedBy: e.target.value })} className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
            <option value="">All Hosts</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="flex-1 flex min-w-[140px] items-center gap-1">
            <input type="text" placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-1/2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            <select value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })} className="w-1/2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
              <option value="">All Customers</option>
              {filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-2 md:pt-0 md:pl-2">
          <button onClick={loadReport} className="flex-1 md:flex-none px-5 py-2 rounded-xl text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md cursor-pointer">Apply</button>
          <button onClick={handleReset} className="flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">Reset</button>
        </div>
      </div>

      {/* Row 5 & 6: Strict Reports Table & Empty State */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Host</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Purpose</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Check-In</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Check-Out</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">Duration</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Outcome</th>
                <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Visits...</p>
                    </div>
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                        <MapPin size={32} />
                      </div>
                      <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Visits Found</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-500">There are no visit records matching your current filter criteria. Try adjusting the date range or status.</p>
                      <button onClick={handleReset} className="mt-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Clear Filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{v.customerName}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{v.hostName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={v.purpose}>{v.purpose}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap">{v.checkInTime ? new Date(v.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "—"}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap text-right tabular-nums">{v.duration !== null ? `${v.duration} min` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-[150px] truncate">{v.outcome || "—"}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={cn("inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", statusColors[v.status] || "bg-slate-100 text-slate-600")}>
                        {statusLabels[v.status] || v.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Insights (Preserved) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-80 hover:opacity-100 transition-opacity">
        {/* Missed Visit Rate by Executive */}
        {summary.missedVisitRateByExecutive?.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Missed Visit Rate by Executive</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <th className="text-left px-2 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Executive</th>
                    <th className="text-right px-2 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Planned</th>
                    <th className="text-right px-2 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Missed</th>
                    <th className="text-right px-2 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Missed Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {summary.missedVisitRateByExecutive.map((exec) => (
                    <tr key={exec.executiveId}>
                      <td className="px-2 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">{exec.executiveName}</td>
                      <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 text-right tabular-nums">{exec.totalPlanned}</td>
                      <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 text-right tabular-nums">{exec.missed}</td>
                      <td className="px-2 py-2 text-xs text-right tabular-nums">
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
        {summary.officeVisitsByHost?.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Office Visits by Host</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {summary.officeVisitsByHost.map((host) => (
                <div key={host.hostId} className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">{host.hostName}</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{host.total}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
