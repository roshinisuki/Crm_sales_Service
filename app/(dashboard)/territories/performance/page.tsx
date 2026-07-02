"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, AnalyticsPageHeader,
  EmptyState, LoadingState, UserAvatar, ComparisonBar,
} from "@/components/shared/AnalyticsComponents";
import { StatusPill } from "@/components/shared/StatusPill";
import { MapPin, Users, Trophy, DollarSign, Download, ArrowLeft, Target } from "lucide-react";

export default function TerritoryPerformancePage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/territories/performance");
      const data = await res.json();
      if (data.success) setData(data.data);
    } catch {
      toast.error("Failed to load performance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    const headers = ["Territory", "Assigned User", "Leads", "Visits", "Follow-Ups Done", "Deals Won", "Revenue", "Target", "Achieved", "Target vs Achieved"];
    const rows = data.map(d => [
      d.name,
      d.assignedUser?.name || "—",
      d.leads,
      d.visits,
      d.followUpsDone,
      d.dealsWon,
      d.revenue,
      d.targetAmount,
      d.achievedAmount,
      d.targetVsAchieved,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "territory-performance.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary metrics
  const summary = useMemo(() => {
    const totalRevenue = data.reduce((s, d) => s + (d.revenue || 0), 0);
    const totalTarget = data.reduce((s, d) => s + (d.targetAmount || 0), 0);
    const totalAchieved = data.reduce((s, d) => s + (d.achievedAmount || 0), 0);
    const overallPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    const totalLeads = data.reduce((s, d) => s + (d.leads || 0), 0);
    return { totalRevenue, totalTarget, totalAchieved, overallPct, totalLeads };
  }, [data]);

  // Fixed scale across all territories
  const maxChartVal = useMemo(() => {
    return Math.max(...data.map(d => Math.max(d.targetAmount || 0, d.achievedAmount || 0)), 1);
  }, [data]);

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Territory Performance" subtitle="Aggregated performance metrics per territory">
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} disabled={!data.length} className="btn-secondary disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
          <Link href="/territories" className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </AnalyticsPageHeader>

      {/* Summary KPI row */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={<DollarSign size={20} />} />
          <KPICard label="Total Target" value={formatCurrency(summary.totalTarget)} icon={<Target size={20} />} />
          <KPICard label="Overall Achievement" value={`${summary.overallPct}%`} icon={<Trophy size={20} />} iconColor={summary.overallPct >= 80 ? "var(--status-success-text)" : summary.overallPct >= 50 ? "var(--status-warning-text)" : "var(--status-danger-text)"} />
          <KPICard label="Total Leads" value={summary.totalLeads} icon={<Users size={20} />} />
        </div>
      )}

      {/* Chart: Target vs Achieved per Territory — fixed scale */}
      {data.length > 0 && (
        <ChartCard title="Target vs Achieved per Territory" subtitle="Both bars on the same scale for fair comparison">
          <div className="space-y-3">
            {data.map((d) => (
              <ComparisonBar
                key={d.id}
                label={d.name}
                valueA={d.targetAmount || 0}
                valueB={d.achievedAmount || 0}
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
        <EmptyState message="No performance data found." />
      ) : (
        <div className="analytics-chart-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th">Territory</th>
                  <th className="crm-th">Assigned User</th>
                  <th className="crm-th text-right">Leads</th>
                  <th className="crm-th text-right">Visits</th>
                  <th className="crm-th text-right">Follow-Ups</th>
                  <th className="crm-th text-right">Deals Won</th>
                  <th className="crm-th text-right">Revenue</th>
                  <th className="crm-th text-right">Target</th>
                  <th className="crm-th text-right">vs Achieved</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => {
                  const pct = d.targetVsAchieved !== "—" ? parseInt(d.targetVsAchieved) : 0;
                  return (
                    <tr key={d.id} className="crm-tr">
                      <td className="crm-td">
                        <Link href={`/territories/${d.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{d.name}</Link>
                      </td>
                      <td className="crm-td">
                        <UserAvatar name={d.assignedUser?.name} role={d.assignedUser?.role} size="sm" />
                      </td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{d.leads}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{d.visits}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{d.followUpsDone}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{d.dealsWon}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(d.revenue)}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(d.targetAmount)}</td>
                      <td className="crm-td text-right">
                        <StatusPill status={pct >= 80 ? "Achieved" : pct >= 50 ? "On Track" : "Behind"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
