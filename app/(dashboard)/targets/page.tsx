"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, AnalyticsPageHeader,
  EmptyState, LoadingState, UserAvatar, ComparisonBar,
} from "@/components/shared/AnalyticsComponents";
import { StatusPill } from "@/components/shared/StatusPill";
import { Target, DollarSign, Trophy, AlertTriangle, Plus, Pencil, Trash2, BarChart3 } from "lucide-react";

export default function TargetsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("type") as "Monthly" | "Quarterly" | "Yearly") || "Monthly";
  const [tab, setTab] = useState<"Monthly" | "Quarterly" | "Yearly">(initialTab);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/targets?targetType=${tab}`);
      const data = await res.json();
      if (data.success) setTargets(data.data);
    } catch {
      toast.error("Failed to load targets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const handleDelete = (t: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete target",
      message: `Delete ${t.targetType} target for ${t.period}?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/targets/${t.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Target deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  // Summary metrics from real records
  const summary = useMemo(() => {
    const totalTarget = targets.reduce((s, t) => s + t.targetAmount, 0);
    const totalAchieved = targets.reduce((s, t) => s + t.achievedAmount, 0);
    const overallPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    const atRiskCount = targets.filter(t => {
      const pct = t.targetAmount > 0 ? (t.achievedAmount / t.targetAmount) * 100 : 0;
      return pct < 50;
    }).length;
    return { totalTarget, totalAchieved, overallPct, atRiskCount };
  }, [targets]);

  // Chart data: group by user — fixed scale
  const chartData = useMemo(() => {
    const userMap = new Map<string, { target: number; achieved: number }>();
    targets.forEach(t => {
      const key = t.assignedUser?.name || "Unassigned";
      const existing = userMap.get(key) || { target: 0, achieved: 0 };
      existing.target += t.targetAmount;
      existing.achieved += t.achievedAmount;
      userMap.set(key, existing);
    });
    return Array.from(userMap.entries());
  }, [targets]);
  const maxChartVal = Math.max(...chartData.map(([, v]) => Math.max(v.target, v.achieved)), 1);

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Targets Overview" subtitle="Manage monthly, quarterly, and yearly sales targets">
        <div className="flex gap-2">
          <Link href="/targets/achievement" className="btn-secondary">
            <BarChart3 size={16} /> Achievement Tracking
          </Link>
          {canManage && (
            <Link href="/targets/new" className="btn-primary">
              <Plus size={16} /> Add Target
            </Link>
          )}
        </div>
      </AnalyticsPageHeader>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(["Monthly", "Quarterly", "Yearly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : targets.length === 0 ? (
        <EmptyState
          message={`No ${tab.toLowerCase()} targets found.`}
          action={canManage ? <Link href="/targets/new" className="btn-primary"><Plus size={16} /> Create your first target</Link> : undefined}
        />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Target" value={formatCurrency(summary.totalTarget)} icon={<Target size={20} />} />
            <KPICard label="Total Achieved" value={formatCurrency(summary.totalAchieved)} icon={<DollarSign size={20} />} />
            <KPICard label="Overall %" value={`${summary.overallPct}%`} icon={<Trophy size={20} />} iconColor={summary.overallPct >= 80 ? "var(--status-success-text)" : summary.overallPct >= 50 ? "var(--status-warning-text)" : "var(--status-danger-text)"} />
            <KPICard label="At Risk (<50%)" value={summary.atRiskCount} icon={<AlertTriangle size={20} />} iconColor={summary.atRiskCount > 0 ? "var(--status-danger-text)" : undefined} />
          </div>

          {/* Chart: Target vs Achieved per User */}
          {chartData.length > 0 && (
            <ChartCard title={`Target vs Achieved per User (${tab})`} subtitle="Both bars on the same scale for fair comparison">
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
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">Period</th>
                    <th className="crm-th">Assigned User</th>
                    <th className="crm-th">Territory</th>
                    <th className="crm-th text-right">Target Amount</th>
                    <th className="crm-th text-right">Achieved</th>
                    <th className="crm-th text-right">Achievement %</th>
                    <th className="crm-th">Status</th>
                    {canManage && <th className="crm-th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const pct = t.targetAmount > 0 ? Math.round((t.achievedAmount / t.targetAmount) * 100) : 0;
                    return (
                      <tr key={t.id} className="crm-tr">
                        <td className="crm-td font-medium text-[var(--text-primary)]">{t.period}</td>
                        <td className="crm-td">
                          <UserAvatar name={t.assignedUser?.name} role={t.assignedUser?.role} size="sm" />
                        </td>
                        <td className="crm-td text-[var(--text-secondary)]">{t.territory?.name || "—"}</td>
                        <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(t.targetAmount)}</td>
                        <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(t.achievedAmount)}</td>
                        <td className="crm-td text-right">
                          <StatusPill status={pct >= 80 ? "Achieved" : pct >= 50 ? "On Track" : "Behind"} />
                        </td>
                        <td className="crm-td">
                          <StatusPill status={pct >= 80 ? "On Track" : pct >= 50 ? "Behind" : "At Risk"} />
                        </td>
                        {canManage && (
                          <td className="crm-td text-right">
                            <div className="inline-flex gap-1.5">
                              <Link href={`/targets/${t.id}`} className="action-icon-btn" title="Edit"><Pencil size={16} /></Link>
                              <button onClick={() => handleDelete(t)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}
