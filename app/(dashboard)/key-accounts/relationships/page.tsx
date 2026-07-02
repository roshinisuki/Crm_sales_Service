"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { StatusPill, normalizeRelationshipStatus } from "@/components/shared/StatusPill";
import {
  KPICard, ChartCard, AnalyticsPageHeader, FilterSelect,
  EmptyState, LoadingState, getChartColor, ColorDot,
} from "@/components/shared/AnalyticsComponents";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
};

const STATUS_COLORS: Record<string, string> = {
  Strong: "#10B981",
  Growing: "#2090FF",
  Developing: "#F59E0B",
  Stable: "#94A3B8",
};

export default function KeyAccountRelationshipsPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterManager, setFilterManager] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      // Use the dedicated relationships API (avoids N+1)
      const res = await fetch("/api/key-accounts/relationships");
      const data = await res.json();
      if (data.success) setAccounts(data.data);
    } catch {
      toast.error("Failed to load relationships");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Extract unique account managers for filter ─────────────────────────────
  const managers = useMemo(() => {
    const set = new Map<string, string>();
    for (const a of accounts) {
      if (a.accountManager && a.accountManager !== "—") set.set(a.accountManager, a.accountManager);
    }
    return Array.from(set.entries()).map(([name, label]) => ({ value: name, label }));
  }, [accounts]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterStatus) {
        const normalized = normalizeRelationshipStatus(a.relationshipStatus);
        if (normalized !== filterStatus) return false;
      }
      if (filterManager && a.accountManager !== filterManager) return false;
      return true;
    });
  }, [accounts, filterStatus, filterManager]);

  // ── Summary metrics ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const total = accounts.length;
    const withContacts = accounts.filter((a) => {
      const contacts = a.contacts;
      if (!contacts) return false;
      return Object.keys(contacts).length > 0;
    }).length;
    const mappedPct = total > 0 ? Math.round((withContacts / total) * 100) : 0;

    // Count per relationship status
    const statusCounts: Record<string, number> = {};
    for (const a of accounts) {
      const status = normalizeRelationshipStatus(a.relationshipStatus);
      if (status !== "—") statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    return { total, withContacts, mappedPct, statusCounts };
  }, [accounts]);

  // ── Donut chart: relationship status distribution ──────────────────────────
  const chartData = useMemo(() => {
    return Object.entries(summary.statusCounts)
      .map(([name, count]) => ({
        name,
        count,
        color: STATUS_COLORS[name] || "#94A3B8",
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary.statusCounts]);

  // ── Count contacts for an account ──────────────────────────────────────────
  const getContactCount = (a: any): number => {
    if (!a.contacts) return 0;
    return Object.values(a.contacts).reduce((s: number, arr: any) => s + arr.length, 0);
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Relationship Mapping" subtitle="Key account contacts by role and relationship status">
        <Link href="/key-accounts" className="text-[13px] text-[var(--accent)] hover:underline">← Back to key accounts</Link>
      </AnalyticsPageHeader>

      {loading ? (
        <LoadingState />
      ) : accounts.length === 0 ? (
        <EmptyState message="No key accounts found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Mapped Accounts" value={summary.total} />
            <KPICard label="With Contacts Mapped" value={`${summary.mappedPct}%`} sublabel={`${summary.withContacts} of ${summary.total} accounts`} />
            <KPICard label="Strong Relationships" value={summary.statusCounts.Strong ?? 0} />
            <KPICard label="Growing" value={summary.statusCounts.Growing ?? 0} />
          </div>

          {/* Chart + filters row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Donut chart */}
            <div className="lg:col-span-1">
              <ChartCard title="Relationship Status" subtitle="Distribution across all accounts">
                {chartData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {chartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                      {chartData.map((s) => (
                        <ColorDot key={s.name} color={s.color} label={`${s.name}: ${s.count}`} />
                      ))}
                    </div>
                  </>
                ) : <EmptyState message="No relationship data." />}
              </ChartCard>
            </div>

            {/* Filters */}
            <div className="lg:col-span-2 flex flex-wrap items-start gap-3 pt-2">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Relationship Status</label>
                <FilterSelect
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { value: "Strong", label: "Strong" },
                    { value: "Growing", label: "Growing" },
                    { value: "Developing", label: "Developing" },
                    { value: "Stable", label: "Stable" },
                  ]}
                  placeholder="All statuses"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Account Manager</label>
                <FilterSelect
                  value={filterManager}
                  onChange={setFilterManager}
                  options={managers}
                  placeholder="All managers"
                />
              </div>
              {(filterStatus || filterManager) && (
                <button
                  onClick={() => { setFilterStatus(""); setFilterManager(""); }}
                  className="btn-secondary mt-6"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ka) => {
              const contacts = ka.contacts || {};
              const contactCount = getContactCount(ka);
              const hasContacts = contactCount > 0;
              const normalizedStatus = normalizeRelationshipStatus(ka.relationshipStatus);

              return (
                <div key={ka.id} className="analytics-chart-card">
                  {/* Header */}
                  <div className="mb-3">
                    <Link href={`/key-accounts/${ka.id}`} className="text-[16px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">
                      {ka.customerName}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] mt-0.5">
                      <Ico d={icons.user} size={12} />
                      {ka.accountManager}
                    </div>
                  </div>

                  {/* Status + revenue */}
                  <div className="flex items-center gap-2 mb-3">
                    {normalizedStatus !== "—" && <StatusPill status={normalizedStatus} />}
                    <span className="text-[13px] text-[var(--text-secondary)]">{formatCurrency(ka.revenuePotential ?? 0)}</span>
                  </div>

                  {/* Contacts by type */}
                  <div className="space-y-2">
                    {["Technical", "Purchase", "Finance", "Management"].map((type) => {
                      const typeContacts = contacts[type];
                      return typeContacts?.length ? (
                        <div key={type} className="text-[13px]">
                          <StatusPill status={type} />
                          <div className="ml-2 mt-1 text-[var(--text-secondary)]">
                            {typeContacts.map((c: any) => (
                              <div key={c.id} className="py-0.5">
                                {c.name}
                                {c.designation && <span className="text-[var(--text-muted)]"> — {c.designation}</span>}
                                {c.isPrimary && <span className="ml-1 text-[11px] text-[var(--accent)]">★ Primary</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })}

                    {/* Empty state for no contacts */}
                    {!hasContacts && (
                      <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed border-[var(--border)] rounded-lg">
                        <Ico d={icons.user} size={24} className="text-[var(--text-muted)] mb-2" />
                        <p className="text-[12px] text-[var(--text-muted)] mb-2">No contacts mapped yet</p>
                        <Link
                          href={`/key-accounts/${ka.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-[var(--accent)] border border-[var(--accent)] rounded-lg hover:bg-[var(--accent)] hover:text-white transition-colors"
                        >
                          <Ico d={icons.plus} size={12} /> Map a contact
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <EmptyState message="No accounts match the selected filters." />
          )}
        </>
      )}
    </PageContainer>
  );
}
