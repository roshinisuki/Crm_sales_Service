"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { StatusPill, normalizeRelationshipStatus } from "@/components/shared/StatusPill";
import {
  KPICard, ChartCard, AnalyticsPageHeader,
  EmptyState, LoadingState, getChartColor, MiniBar,
} from "@/components/shared/AnalyticsComponents";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type SortField = "customer" | "revenue" | "achieved" | "importance";
type SortDir = "asc" | "desc";

export default function RevenuePotentialPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/key-accounts?view=revenue");
      const data = await res.json();
      if (data.success) setAccounts(data.data);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Summary metrics ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalPipeline = accounts.reduce((s, a) => s + (a.revenuePotential ?? 0), 0);
    const avgRevenue = accounts.length > 0 ? totalPipeline / accounts.length : 0;

    // Top account by revenue
    let topAccount = "—";
    let topRevenue = 0;
    for (const a of accounts) {
      if ((a.revenuePotential ?? 0) > topRevenue) { topRevenue = a.revenuePotential ?? 0; topAccount = a.customer?.name ?? "—"; }
    }

    return { totalPipeline, avgRevenue, topAccount, topRevenue, count: accounts.length };
  }, [accounts]);

  // ── Chart: top 10-15 accounts by revenue ───────────────────────────────────
  const chartData = useMemo(() => {
    return accounts
      .map((a) => ({
        name: a.customer?.name ?? "—",
        revenue: a.revenuePotential ?? 0,
        color: getChartColor(a.customer?.name ?? "—"),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
  }, [accounts]);

  const maxRevenue = useMemo(() => Math.max(...chartData.map((d) => d.revenue), 1), [chartData]);

  // ── Sort table ─────────────────────────────────────────────────────────────
  const sortedAccounts = useMemo(() => {
    const arr = [...accounts];
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "customer") { av = a.customer?.name ?? ""; bv = b.customer?.name ?? ""; }
      else if (sortField === "revenue") { av = a.revenuePotential ?? 0; bv = b.revenuePotential ?? 0; }
      else if (sortField === "achieved") { av = a.achievedRevenue ?? 0; bv = b.achievedRevenue ?? 0; }
      else {
        const order = { Critical: 0, High: 1, Medium: 2 };
        av = order[a.strategicImportance as keyof typeof order] ?? 3;
        bv = order[b.strategicImportance as keyof typeof order] ?? 3;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [accounts, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1 text-[9px] leading-none">
      <span className={sortField === field && sortDir === "asc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▲</span>
      <span className={sortField === field && sortDir === "desc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▼</span>
    </span>
  );

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Revenue Potential" subtitle="Key accounts ranked by revenue potential and achieved revenue">
        <Link href="/key-accounts" className="text-[13px] text-[var(--accent)] hover:underline">← Back to key accounts</Link>
      </AnalyticsPageHeader>

      {loading ? (
        <LoadingState />
      ) : accounts.length === 0 ? (
        <EmptyState message="No key accounts with revenue data." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Pipeline Value" value={formatCurrency(summary.totalPipeline)} />
            <KPICard label="Avg Revenue / Account" value={formatCurrency(summary.avgRevenue)} />
            <KPICard label="Top Account" value={summary.topAccount} sublabel={formatCurrency(summary.topRevenue)} />
            <KPICard label="Total Accounts" value={summary.count} />
          </div>

          {/* Chart: top accounts by revenue */}
          <ChartCard title="Top Accounts by Revenue Potential" subtitle="Ranked from highest to lowest">
            <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 32)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={140} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                  cursor={{ fill: "var(--surface-2)" }}
                  formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} name="Revenue Potential">
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sortable table */}
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("customer")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Customer <SortIcon field="customer" />
                      </button>
                    </th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("revenue")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Revenue Potential <SortIcon field="revenue" />
                      </button>
                    </th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("achieved")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Achieved <SortIcon field="achieved" />
                      </button>
                    </th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("importance")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Importance <SortIcon field="importance" />
                      </button>
                    </th>
                    <th className="crm-th">Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((ka) => (
                    <tr key={ka.id} className="crm-tr">
                      <td className="crm-td">
                        <Link href={`/key-accounts/${ka.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{ka.customer?.name}</Link>
                      </td>
                      <td className="crm-td">
                        <div className="flex items-center gap-2">
                          <MiniBar value={ka.revenuePotential ?? 0} max={maxRevenue} />
                          <span className="text-[12px] font-medium text-[var(--text-primary)] whitespace-nowrap w-24 text-right">{formatCurrency(ka.revenuePotential ?? 0)}</span>
                        </div>
                      </td>
                      <td className="crm-td text-[var(--text-secondary)]">{formatCurrency(ka.achievedRevenue ?? 0)}</td>
                      <td className="crm-td"><StatusPill status={ka.strategicImportance} /></td>
                      <td className="crm-td"><StatusPill status={normalizeRelationshipStatus(ka.relationshipStatus)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
