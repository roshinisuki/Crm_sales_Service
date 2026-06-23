"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
};

const statusColors: Record<string, string> = {
  Achieved: "bg-green-50 text-green-700",
  "On Track": "bg-blue-50 text-blue-700",
  Behind: "bg-amber-50 text-amber-700",
  "At Risk": "bg-red-50 text-red-700",
};

export default function TargetAchievementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [filters, setFilters] = useState({ targetType: "", year: String(new Date().getFullYear()), userId: "", territoryId: "" });

  const load = async () => {
    setLoading(true);
    try {
      // Trigger recalculation in dev
      if (process.env.NODE_ENV !== "production") {
        fetch("/api/cron/update-target-achievements", { method: "POST" }).catch(() => {});
      }

      const params = new URLSearchParams();
      if (filters.targetType) params.set("targetType", filters.targetType);
      if (filters.year) params.set("year", filters.year);
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.territoryId) params.set("territoryId", filters.territoryId);

      const res = await fetch(`/api/targets/achievement?${params}`);
      const data = await res.json();
      if (data.success) setData(data.data);
    } catch {
      toast.error("Failed to load achievement data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (d.success) setUsers(d.data || []); });
    fetch("/api/territories?isActive=true").then(r => r.json()).then(d => { if (d.success) setTerritories(d.data || []); });
  }, []);

  useEffect(() => { load(); }, [filters]);

  const exportCSV = () => {
    const headers = ["User", "Territory", "Target Type", "Period", "Target", "Achieved", "Gap", "Achievement %", "Status"];
    const rows = data.map(d => [
      d.assignedUser?.name || "—",
      d.territory?.name || "—",
      d.targetType,
      d.period,
      d.targetAmount,
      d.achievedAmount,
      d.gap,
      d.achievementPct,
      d.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "target-achievement.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary
  const totalTarget = data.reduce((s, d) => s + d.targetAmount, 0);
  const totalAchieved = data.reduce((s, d) => s + d.achievedAmount, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const onTrackCount = data.filter(d => d.achievementPct >= 80).length;

  // Chart data: group by user
  const userMap = new Map<string, { target: number; achieved: number }>();
  data.forEach(d => {
    const key = d.assignedUser?.name || "Unassigned";
    const existing = userMap.get(key) || { target: 0, achieved: 0 };
    existing.target += d.targetAmount;
    existing.achieved += d.achievedAmount;
    userMap.set(key, existing);
  });
  const chartData = Array.from(userMap.entries());
  const maxChartVal = Math.max(...chartData.map(([, v]) => Math.max(v.target, v.achieved)), 1);

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Target Achievement Tracking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Target vs achieved based on approved Purchase Orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={!data.length} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Ico d={icons.download} size={16} /> Export CSV
          </button>
          <Link href="/targets" className="text-sm text-blue-600 hover:underline self-center">← Back to targets</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Overall Achievement</p>
          <p className={`text-2xl font-bold mt-1 ${overallPct >= 80 ? "text-green-600" : overallPct >= 50 ? "text-amber-600" : "text-red-600"}`}>{overallPct}%</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Target</p>
          <p className="text-2xl font-bold mt-1 text-slate-800">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Achieved</p>
          <p className="text-2xl font-bold mt-1 text-slate-800">{formatCurrency(totalAchieved)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Users On Track (≥80%)</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{onTrackCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filters.targetType} onChange={(e) => setFilters({ ...filters, targetType: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          <option value="Monthly">Monthly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Yearly">Yearly</option>
        </select>
        <input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} placeholder="Year" className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-24" />
        <select value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Users</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.territoryId} onChange={(e) => setFilters({ ...filters, territoryId: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Territories</option>
          {territories.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Target vs Achieved per User</h4>
          <div className="space-y-3">
            {chartData.map(([userName, vals]) => (
              <div key={userName} className="flex items-center gap-3 text-sm">
                <div className="w-28 truncate text-gray-600">{userName}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-16">Target</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div className="bg-blue-500 rounded-full h-4" style={{ width: `${(vals.target / maxChartVal) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatCurrency(vals.target)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-16">Achieved</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div className="bg-green-500 rounded-full h-4" style={{ width: `${(vals.achieved / maxChartVal) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatCurrency(vals.achieved)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No achievement data found for the selected filters.</p>
          <Link href="/targets/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">Create a target</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Territory</th>
                <th className="px-4 py-3 font-semibold">Target Type</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold text-right">Target</th>
                <th className="px-4 py-3 font-semibold text-right">Achieved</th>
                <th className="px-4 py-3 font-semibold text-right">Gap</th>
                <th className="px-4 py-3 font-semibold text-right">Achievement %</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.assignedUser?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{d.territory?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{d.targetType}</td>
                  <td className="px-4 py-3 text-gray-600">{d.period}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(d.targetAmount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(d.achievedAmount)}</td>
                  <td className={`px-4 py-3 text-right ${d.gap < 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(Math.abs(d.gap))}{d.gap < 0 ? " surplus" : ""}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${d.achievementPct >= 80 ? "bg-green-50 text-green-700" : d.achievementPct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{d.achievementPct}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[d.status] || "bg-gray-100 text-gray-600"}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
