"use client";

import { useState, useEffect, useMemo } from "react";
import { getAuditLogsAction } from "@/app/actions/auditLogs";
import { useAuth } from "@/components/AuthProvider";
import PageContainer from "@/components/PageContainer";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui-utils";
import {
  Shield, RefreshCw, Download, Search, ChevronDown, ChevronUp,
  Monitor, Globe, AlertTriangle, Info, Flame, Zap,
} from "lucide-react";

// ─── Severity Config ─────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string; row: string }> = {
  INFO:     { label: "INFO",     icon: <Info     size={11} />, badge: "bg-slate-100 text-slate-600",     row: "" },
  WARN:     { label: "WARN",     icon: <AlertTriangle size={11} />, badge: "bg-amber-100 text-amber-700",     row: "bg-amber-50/40" },
  HIGH:     { label: "HIGH",     icon: <Flame    size={11} />, badge: "bg-red-100 text-red-700",         row: "bg-red-50/30" },
  CRITICAL: { label: "CRITICAL", icon: <Zap      size={11} />, badge: "bg-purple-100 text-purple-700",   row: "bg-purple-50/30" },
};

const MODULE_COLORS: Record<string, string> = {
  auth: "bg-red-100 text-red-800", user: "bg-slate-100 text-slate-700",
  customer: "bg-amber-100 text-amber-700", subscription: "bg-violet-100 text-violet-700",
  visit: "bg-emerald-100 text-emerald-700", visitor: "bg-cyan-100 text-cyan-700",
  "follow-up": "bg-rose-100 text-rose-700", lead: "bg-blue-100 text-blue-700",
  LEADS: "bg-blue-100 text-blue-700", Customer: "bg-amber-100 text-amber-700",
  Deal: "bg-orange-100 text-orange-700", follow_up: "bg-rose-100 text-rose-700",
};

const ACTION_COLORS: Record<string, string> = {
  create:        "bg-emerald-50 text-emerald-700",
  CREATE_LEAD:   "bg-emerald-50 text-emerald-700",
  Create:        "bg-emerald-50 text-emerald-700",
  update:        "bg-amber-50  text-amber-700",
  UPDATE_LEAD:   "bg-amber-50  text-amber-700",
  Update:        "bg-amber-50  text-amber-700",
  delete:        "bg-red-50    text-red-700",
  DELETE_LEAD:   "bg-red-50    text-red-700",
  login:         "bg-blue-50   text-blue-700",
  logout:        "bg-slate-50  text-slate-600",
  checkin:       "bg-teal-50   text-teal-700",
  checkout:      "bg-slate-50  text-slate-600",
  CONVERT_LEAD:  "bg-purple-50 text-purple-700",
};

function DiffViewer({ label, data }: { label: string; data: string }) {
  let parsed: Record<string, any> | null = null;
  try { parsed = JSON.parse(data); } catch { parsed = null; }
  if (!parsed || Object.keys(parsed).length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
        {Object.entries(parsed).map(([key, val]) => (
          <div key={key} className="flex items-baseline gap-2 text-xs">
            <span className="font-mono text-slate-400 shrink-0 w-28 truncate">{key}:</span>
            <span className={cn(
              "font-semibold break-all",
              label === "Before" ? "text-red-600" : "text-emerald-700"
            )}>
              {val === null ? <em className="opacity-50">null</em> : String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const severity = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.INFO;
  const hasDiff  = log.previousState || log.newState;
  const hasContext = log.ipAddress || log.userAgent;
  const isExpandable = hasDiff || hasContext;

  const actionKey = log.action;
  const actionColor = ACTION_COLORS[actionKey] || "bg-slate-50 text-slate-600";

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 transition-colors group",
          severity.row,
          isExpandable ? "cursor-pointer hover:brightness-95" : "hover:bg-slate-50/70"
        )}
        onClick={() => isExpandable && setExpanded((e) => !e)}
      >
        {/* Severity */}
        <td className="px-4 py-3 w-24">
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", severity.badge)}>
            {severity.icon} {severity.label}
          </span>
        </td>

        {/* Timestamp */}
        <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
          {new Date(log.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" })}
        </td>

        {/* Module */}
        <td className="px-4 py-3">
          <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-md", MODULE_COLORS[log.module] || "bg-slate-100 text-slate-600")}>
            {log.module}
          </span>
        </td>

        {/* Action */}
        <td className="px-4 py-3">
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", actionColor)}>
            {log.action}
          </span>
        </td>

        {/* Performed By */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
              {(log.performedBy || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 truncate max-w-[130px]">{log.performedBy || "System"}</p>
              {log.performedRole && log.performedRole !== "System" && (
                <p className="text-[10px] text-slate-400">{log.performedRole}</p>
              )}
            </div>
          </div>
        </td>

        {/* Details */}
        <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px]">
          <p className="truncate">{log.details || "—"}</p>
          {log.resourceId && (
            <p className="text-[10px] font-mono text-slate-300 mt-0.5 truncate">{log.resourceId}</p>
          )}
        </td>

        {/* IP */}
        <td className="px-4 py-3 text-xs font-mono text-slate-400">
          {log.ipAddress || <span className="text-slate-200">—</span>}
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-right w-10">
          {isExpandable && (
            <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </td>
      </tr>

      {/* Expanded state-diff + context row */}
      {expanded && isExpandable && (
        <tr className={cn("border-b border-slate-100", severity.row)}>
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* State diff */}
              {hasDiff && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">🔁 State Change</p>
                  {log.previousState && <DiffViewer label="Before" data={log.previousState} />}
                  {log.newState && <DiffViewer label="After" data={log.newState} />}
                </div>
              )}

              {/* Request context */}
              {hasContext && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">🌐 Request Context</p>
                  {log.ipAddress && (
                    <div className="flex items-start gap-2">
                      <Globe size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">IP Address</p>
                        <p className="text-xs font-mono text-slate-700">{log.ipAddress}</p>
                      </div>
                    </div>
                  )}
                  {log.userAgent && (
                    <div className="flex items-start gap-2">
                      <Monitor size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">User Agent</p>
                        <p className="text-[11px] text-slate-600 break-all leading-relaxed">{log.userAgent}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs,           setLogs]           = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [moduleFilter,   setModuleFilter]   = useState("");
  const [actionFilter,   setActionFilter]   = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [startDate,      setStartDate]      = useState("");
  const [endDate,        setEndDate]        = useState("");
  const [errorMsg,       setErrorMsg]       = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params: any = { limit: 300 };
      if (moduleFilter)   params.module   = moduleFilter;
      if (actionFilter)   params.action   = actionFilter;
      if (severityFilter) params.severity = severityFilter;
      if (startDate)      params.startDate = startDate;
      if (endDate)        params.endDate   = endDate;

      const res = await getAuditLogsAction(params);
      if (res.success && res.data) setLogs(res.data as any);
      else setErrorMsg(res.message || "Failed to load audit logs.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role !== "Admin") router.replace("/dashboard");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "Admin") loadLogs();
  }, [moduleFilter, actionFilter, severityFilter, startDate, endDate, user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      l.performedBy?.toLowerCase().includes(q) ||
      l.module?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q) ||
      l.ipAddress?.includes(q) ||
      l.resourceId?.includes(q)
    );
  }, [logs, search]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["Timestamp", "Severity", "Module", "Action", "Performed By", "Role", "IP Address", "Resource ID", "Details"];
    const rows = filtered.map((l) => [
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.severity}"`,
      `"${l.module}"`,
      `"${l.action}"`,
      `"${l.performedBy || "System"}"`,
      `"${l.performedRole || ""}"`,
      `"${l.ipAddress || ""}"`,
      `"${l.resourceId || ""}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (authLoading || user?.role !== "Admin") return null;

  const kpiCritical = logs.filter((l) => l.severity === "CRITICAL").length;
  const kpiHigh     = logs.filter((l) => l.severity === "HIGH").length;
  const kpiCreates  = logs.filter((l) => l.action?.toLowerCase().includes("create")).length;
  const kpiLogins   = logs.filter((l) => l.action?.toLowerCase() === "login").length;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield size={28} className="text-[var(--primary)]" /> Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Full state-diff trail of every CRM action — with IP tracking, severity classification, and field-level change records.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#151515] text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Events</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{logs.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">All logged events</p>
        </div>
        <div className="bg-purple-50 rounded-2xl border border-purple-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Critical</p>
          <p className="text-3xl font-black text-purple-800 mt-1">{kpiCritical}</p>
          <p className="text-[10px] text-purple-400 mt-0.5">Security & export events</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider">High Risk</p>
          <p className="text-3xl font-black text-red-800 mt-1">{kpiHigh}</p>
          <p className="text-[10px] text-red-400 mt-0.5">Deletions & deal closes</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Creates</p>
          <p className="text-3xl font-black text-emerald-800 mt-1">{kpiCreates}</p>
          <p className="text-[10px] text-emerald-400 mt-0.5">New records created</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search events, user, IP, resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all text-slate-700"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Severity</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>

            {/* Module filter */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Modules</option>
              {["auth","user","customer","Customer","lead","LEADS","Deal","subscription","visit","visitor","follow-up"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="checkin">Check-in</option>
              <option value="checkout">Check-out</option>
            </select>

            {/* Date range */}
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
          </div>
        </div>

        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Details / Resource</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                      Loading audit events...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-sm text-slate-400">
                    <Shield size={32} className="mx-auto mb-2 text-slate-200" />
                    No audit events found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => <AuditRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing <strong>{filtered.length}</strong> of <strong>{logs.length}</strong> audit event{logs.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-slate-400 font-mono">Last updated: {new Date().toLocaleTimeString("en-IN")}</span>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
