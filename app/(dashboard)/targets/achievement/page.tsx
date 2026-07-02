"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, AnalyticsPageHeader, FilterSelect,
  EmptyState, LoadingState, UserAvatar, ComparisonBar,
} from "@/components/shared/AnalyticsComponents";
import { StatusPill } from "@/components/shared/StatusPill";
import { Target, DollarSign, Trophy, Users, Download, ArrowLeft } from "lucide-react";

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
  const atRiskCount = data.filter(d => d.achievementPct < 50).length;

  // Chart data: group by user — fixed scale across all users
  const userMap = useMemo(() => {
    const m = new Map<string, { target: number; achieved: number }>();
    data.forEach(d => {
      const key = d.assignedUser?.name || "Unassigned";
      const existing = m.get(key) || { target: 0, achieved: 0 };
      existing.target += d.targetAmount;
      existing.achieved += d.achievedAmount;
      m.set(key, existing);
    });
    return m;
  }, [data]);

  const chartData = Array.from(userMap.entries());
  const maxChartVal = Math.max(...chartData.map(([, v]) => Math.max(v.target, v.achieved)), 1);

  // Overall achievement status color
  const overallColor = overallPct >= 80 ? "var(--status-success-text)" : overallPct >= 50 ? "var(--status-warning-text)" : "var(--status-danger-text)";

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Target Achievement Tracking" subtitle="Target vs achieved based on approved Purchase Orders">
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} disabled={!data.length} className="btn-secondary disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
          <Link href="/targets" className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to targets
          </Link>
        </div>
      </AnalyticsPageHeader>

      {/* Summary KPI cards with icons + status-tied colors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Overall Achievement" value={`${overallPct}%`} icon={<Target size={20} />} iconColor={overallColor} />
        <KPICard label="Total Target" value={formatCurrency(totalTarget)} icon={<DollarSign size={20} />} />
        <KPICard label="Total Achieved" value={formatCurrency(totalAchieved)} icon={<Trophy size={20} />} iconColor="var(--status-success-text)" />
        <KPICard label="Users On Track (≥80%)" value={onTrackCount} sublabel={atRiskCount > 0 ? `${atRiskCount} at risk` : undefined} icon={<Users size={20} />} />
      </div>

      {/* Filters — styled, not OS-default */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={filters.targetType}
          onChange={(v) => setFilters({ ...filters, targetType: v })}
          options={[
            { value: "Monthly", label: "Monthly" },
            { value: "Quarterly", label: "Quarterly" },
            { value: "Yearly", label: "Yearly" },
          ]}
          placeholder="All Types"
        />
        <input
          type="number"
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          placeholder="Year"
          className="input-field w-24"
        />
        <FilterSelect
          value={filters.userId}
          onChange={(v) => setFilters({ ...filters, userId: v })}
          options={users.map((u: any) => ({ value: u.id, label: u.name }))}
          placeholder="All Users"
        />
        <FilterSelect
          value={filters.territoryId}
          onChange={(v) => setFilters({ ...filters, territoryId: v })}
          options={territories.map((t: any) => ({ value: t.id, label: t.name }))}
          placeholder="All Territories"
        />
      </div>

      {/* Chart: Target vs Achieved per User — fixed-scale dual bars */}
      {chartData.length > 0 && (
        <ChartCard title="Target vs Achieved per User" subtitle="Both bars on the same scale for fair comparison">
          <div className="space-y-3">
            {chartData.map(([userName, vals]) => (
              <ComparisonBar
                key={userName}
                label={userName}
                valueA={vals.target}
                valueB={vals.achieved}
                labelA="Target"
                labelB="Achieved"
                formatValue={(v) => formatCurrency(v)}
                maxScale={maxChartVal}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState
          message="No achievement data found for the selected filters."
          action={
            <Link href="/targets/new" className="btn-primary">
              Create a target
            </Link>
          }
        />
      ) : (
        <div className="analytics-chart-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th">User</th>
                  <th className="crm-th">Territory</th>
                  <th className="crm-th">Type</th>
                  <th className="crm-th">Period</th>
                  <th className="crm-th text-right">Target</th>
                  <th className="crm-th text-right">Achieved</th>
                  <th className="crm-th text-right">Gap</th>
                  <th className="crm-th text-right">%</th>
                  <th className="crm-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className="crm-tr">
                    <td className="crm-td">
                      <UserAvatar name={d.assignedUser?.name} role={d.assignedUser?.role} size="sm" />
                    </td>
                    <td className="crm-td text-[var(--text-secondary)]">{d.territory?.name || "—"}</td>
                    <td className="crm-td text-[var(--text-secondary)]">{d.targetType}</td>
                    <td className="crm-td text-[var(--text-secondary)]">{d.period}</td>
                    <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(d.targetAmount)}</td>
                    <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(d.achievedAmount)}</td>
                    <td className="crm-td text-right" style={{ color: d.gap < 0 ? "var(--status-success-text)" : "var(--status-danger-text)" }}>
                      {formatCurrency(Math.abs(d.gap))}{d.gap < 0 ? " surplus" : ""}
                    </td>
                    <td className="crm-td text-right">
                      <StatusPill status={d.achievementPct >= 80 ? "Achieved" : d.achievementPct >= 50 ? "On Track" : "Behind"} />
                    </td>
                    <td className="crm-td">
                      <StatusPill status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
