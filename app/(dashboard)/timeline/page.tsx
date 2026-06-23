"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";

const activityIcons: Record<string, { icon: string; color: string }> = {
  Call: { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", color: "text-blue-600 bg-blue-100" },
  Meeting: { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", color: "text-purple-600 bg-purple-100" },
  Email: { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "text-cyan-600 bg-cyan-100" },
  WhatsApp: { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "text-green-600 bg-green-100" },
  Note: { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", color: "text-amber-600 bg-amber-100" },
  Visit: { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", color: "text-red-600 bg-red-100" },
  FollowUp: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-indigo-600 bg-indigo-100" },
  Task: { icon: "M5 13l4 4L19 7", color: "text-emerald-600 bg-emerald-100" },
  StageChange: { icon: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4", color: "text-orange-600 bg-orange-100" },
  Reassignment: { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", color: "text-pink-600 bg-pink-100" },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const entityTypes = ["Lead", "Customer", "Deal"];
const activityTypes = ["Call", "Meeting", "Email", "WhatsApp", "Note", "Visit", "FollowUp", "Task", "StageChange", "Reassignment"];

export default function TimelinePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    entityType: "",
    activityType: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadTimeline = async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.activityType) params.set("activityType", filters.activityType);
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      params.set("page", String(pageNum));
      params.set("limit", "30");

      const res = await fetch(`/api/timeline?${params}`);
      const data = await res.json();
      if (data.success) {
        setItems(append ? [...items, ...data.items] : data.items);
        setHasMore(data.hasMore);
        setTotal(data.total);
        setPage(pageNum);
      }
    } catch {
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTimeline(1); }, [filters.entityType, filters.activityType, filters.userId, filters.startDate, filters.endDate]);

  const handleReset = () => {
    setFilters({ entityType: "", activityType: "", userId: "", startDate: "", endDate: "" });
  };

  return (
    <PageContainer className="p-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Timeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">Unified activity feed across all modules</p>
      </div>

      <div className="flex gap-4">
        {/* Left Panel - Filters */}
        <div className="w-60 flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4 h-fit sticky top-4">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Entity Type</p>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="entityType" checked={!filters.entityType} onChange={() => setFilters({ ...filters, entityType: "" })} className="accent-[#D44D4D]" /> All</label>
              {entityTypes.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="entityType" checked={filters.entityType === t} onChange={() => setFilters({ ...filters, entityType: t })} className="accent-[#D44D4D]" /> {t}</label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Activity Type</p>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="activityType" checked={!filters.activityType} onChange={() => setFilters({ ...filters, activityType: "" })} className="accent-[#D44D4D]" /> All</label>
              {activityTypes.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="activityType" checked={filters.activityType === t} onChange={() => setFilters({ ...filters, activityType: t })} className="accent-[#D44D4D]" /> {t.replace(/([A-Z])/g, " $1").trim()}</label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Date Range</p>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>

          {user?.role !== "SalesExecutive" && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">User</p>
              <select value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
                <option value="">All Users</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleReset} className="w-full py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Reset</button>
        </div>

        {/* Right Panel - Feed */}
        <div className="flex-1 space-y-2">
          {loading && items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center text-slate-400">Loading...</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center text-slate-400">No activities found</div>
          ) : (
            <>
              {items.map((item) => {
                const cfg = activityIcons[item.type] || activityIcons.Note;
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={cfg.icon} /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">{item.actor.name}</p>
                        <span className="text-xs text-slate-400" title={new Date(item.timestamp).toLocaleString()}>{timeAgo(item.timestamp)}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{item.description}</p>
                      {item.entity && (
                        <button
                          onClick={() => {
                            if (item.entity.type === "Lead") router.push(`/leads/${item.entity.id}`);
                            else if (item.entity.type === "Customer") router.push(`/customer-master/${item.entity.id}`);
                            else if (item.entity.type === "Deal") router.push(`/deals/${item.entity.id}`);
                          }}
                          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
                        >
                          {item.entity.type}: {item.entity.code || item.entity.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => loadTimeline(page + 1, true)} disabled={loading} className="w-full py-3 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  {loading ? "Loading..." : "Load More"}
                </button>
              )}
              <p className="text-center text-xs text-slate-400 pt-2">{total} total activities</p>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
