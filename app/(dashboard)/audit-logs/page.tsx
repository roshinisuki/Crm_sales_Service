"use client";

import { useState, useEffect } from "react";
import { getAuditLogsAction } from "@/app/actions/auditLogs";
import { AuditLog } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  log: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

const MODULE_COLORS: Record<string, string> = {
  auth:         "bg-blue-100 text-blue-700",
  user:         "bg-indigo-100 text-indigo-700",
  customer:     "bg-amber-100 text-amber-700",
  subscription: "bg-violet-100 text-violet-700",
  visit:        "bg-emerald-100 text-emerald-700",
  visitor:      "bg-cyan-100 text-cyan-700",
  "follow-up":  "bg-rose-100 text-rose-700",
  audit:        "bg-slate-100 text-slate-600",
};

const ACTION_ICONS: Record<string, string> = {
  login:   "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
  create:  "M12 4v16m8-8H4",
  update:  "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  delete:  "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  logout:  "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  checkin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
  checkout:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params: any = {};
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      params.limit = 100; // default from old code

      const res = await getAuditLogsAction(params);
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setErrorMsg(res.message || "Failed to load audit logs.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role !== "Admin") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "Admin") {
      loadLogs();
    }
  }, [search, moduleFilter, user]);

  if (authLoading || user?.role !== "Admin") return null;

  const modules = Array.from(new Set(logs.map((l) => l.module)));

  const getActionColor = (action: string) => {
    if (action === "delete") return "text-red-600 bg-red-50";
    if (action === "create") return "text-emerald-700 bg-emerald-50";
    if (action === "login" || action === "checkin") return "text-blue-700 bg-blue-50";
    if (action === "logout" || action === "checkout") return "text-slate-600 bg-slate-100";
    return "text-amber-700 bg-amber-50";
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Full trail of every system action for security and compliance.</p>
        </div>
        <button
          onClick={() => loadLogs()}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-medium hover:bg-[#1a365d] transition-colors shadow-sm"
        >
          <Ico d={icons.refresh} size={16} />
          Refresh Logs
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Ico d={icons.log} size={20} className="text-slate-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{logs.length}</p>
            <p className="text-xs font-semibold text-slate-500">Total Events</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Ico d="M12 4v16m8-8H4" size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {logs.filter((l) => l.action === "create").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Create Events</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {logs.filter((l) => l.action === "update").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Update Events</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Ico d={icons.shield} size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {logs.filter((l) => l.action === "login").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Login Events</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Ico d={icons.search} size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by user or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">All Modules</option>
              {(modules.length > 0 ? modules : ["auth","user","customer","subscription","visit","visitor","follow-up"]).map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="m-5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Module</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Performed By</th>
                <th className="px-6 py-4">Target / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-[#0D2137] border-t-transparent animate-spin" />
                      Loading audit events...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Ico d={icons.log} size={32} className="text-slate-300" />
                      <span>No audit events recorded yet.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.createdAt || log.timestamp || "").toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${MODULE_COLORS[log.module] || "bg-slate-100 text-slate-600"}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${getActionColor(log.action)}`}>
                          <Ico d={ACTION_ICONS[log.action] || icons.log} size={11} />
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {(log.userEmail || log.performedBy || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">
                          {log.userEmail || log.performedBy || "System"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-[280px] truncate">
                      {log.details || log.entityId || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && logs.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">Showing {logs.length} audit event{logs.length !== 1 ? "s" : ""}</span>
            <span className="text-xs text-slate-400 font-mono">Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
