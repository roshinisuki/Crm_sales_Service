"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, CompetitorPageHeader, EmptyState, LoadingState,
  getChartColor, ColorDot,
} from "@/components/competitors/CompetitorAnalytics";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import { Download, Trophy, Target, MapPin, ThumbsUp } from "lucide-react";
import { useCurrency } from "@/components/CurrencyProvider";

export default function WinLossPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await fetch(`/api/competitors/win-loss?${new URLSearchParams(params)}`);
      const d = await res.json();
      if (d.success) setData(d.data);
      else toast.error("Failed to load");
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to]);

  // ── Donut chart data: win/loss split ───────────────────────────────────────
  const winLossSplit = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Won", value: data.summary.wonCount, color: "#10B981" },
      { name: "Lost", value: data.summary.lostCount, color: "#EF4444" },
    ];
  }, [data]);

  // ── Win rate per competitor bar chart ──────────────────────────────────────
  const winRateByComp = useMemo(() => {
    if (!data) return [];
    return data.winRateByCompetitor.map((c: any) => ({
      ...c,
      color: getChartColor(c.competitorName),
    }));
  }, [data]);

  // ── 6-month trend line chart ───────────────────────────────────────────────
  const trendData = useMemo(() => data?.trend ?? [], [data]);

  // ── Deal-level table (client-side filtered by status) ──────────────────────
  const dealDetails = useMemo(() => {
    if (!data) return [];
    const deals = data.dealDetails;
    if (!statusFilter) return deals;
    return deals.filter((d: any) => d.status === statusFilter);
  }, [data, statusFilter]);

  const exportCSV = () => {
    if (!data?.dealDetails) return;
    const headers = ["Deal Name", "Status", "Value", "Customer", "Territory", "Competitors", "Date"];
    const rows = data.dealDetails.map((d: any) => [
      d.dealName, d.status, d.dealValue, d.customerName, d.territory,
      (d.competitors || []).join("; "), new Date(d.updatedAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "win-loss-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <CompetitorPageHeader title="Win / Loss Analysis" subtitle="Overall win rate, per-competitor performance, and deal-level breakdown">
        <button onClick={exportCSV} className="btn-secondary">
          <Download size={16} /> Export CSV
        </button>
      </CompetitorPageHeader>

      {/* Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-[12px] text-[var(--text-secondary)] mr-1.5">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field !w-auto" />
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-secondary)] mr-1.5">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field !w-auto" />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : !data ? (
        <EmptyState message="No data available." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Overall Win Rate" value={`${data.summary.winRate}%`} sublabel={`${data.summary.total} deals evaluated`} icon={<Trophy size={20} />} />
            <KPICard label="Total Deals" value={data.summary.total} sublabel={`${data.summary.wonCount} won / ${data.summary.lostCount} lost`} icon={<Target size={20} />} />
            <KPICard label="Best Territory" value={data.summary.bestTerritory} sublabel={data.summary.bestTerritoryWinRate > 0 ? `${data.summary.bestTerritoryWinRate}% win rate` : undefined} icon={<MapPin size={20} />} />
            <KPICard label="Top Win Reason" value={data.summary.mostCommonWinReason} icon={<ThumbsUp size={20} />} />
          </div>

          {/* Charts row 1: donut + win-rate-per-competitor */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Chart 1: Win/Loss donut */}
            <ChartCard title="Win / Loss Split" subtitle="Overall distribution of won vs lost deals">
              {winLossSplit.length > 0 && (winLossSplit[0].value > 0 || winLossSplit[1].value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={winLossSplit}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {winLossSplit.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    {winLossSplit.map((s) => (
                      <ColorDot key={s.name} color={s.color} label={`${s.name}: ${s.value}`} />
                    ))}
                  </div>
                </>
              ) : <EmptyState message="No data for chart." />}
            </ChartCard>

            {/* Chart 2: Win rate per competitor (the most important chart) */}
            <ChartCard title="Win Rate per Competitor" subtitle="How we perform against each competitor">
              {winRateByComp.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={winRateByComp} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="competitorName" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                      cursor={{ fill: "var(--surface-2)" }}
                      formatter={(v: any) => [`${v}%`, "Win Rate"]}
                    />
                    <Bar dataKey="winRate" radius={[6, 6, 0, 0]} name="Win Rate %">
                      {winRateByComp.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState message="No competitor involvement data yet." />}
            </ChartCard>
          </div>

          {/* Charts row 2: 6-month trend */}
          {trendData.length > 0 && (
            <ChartCard title="Win Rate Trend" subtitle="Last 6 months">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="winRate" stroke="#2090FF" strokeWidth={2.5} dot={{ r: 4 }} name="Win Rate %" />
                  <Line type="monotone" dataKey="won" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Won" />
                  <Line type="monotone" dataKey="lost" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Lost" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Deal-level table */}
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
              <h4 className="text-[15px] font-medium text-[var(--text-primary)]">Deal-Level Detail</h4>
              <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
                {["", "Won", "Lost"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      statusFilter === s
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>
            {dealDetails.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th className="crm-th">Deal</th>
                      <th className="crm-th">Status</th>
                      <th className="crm-th">Value</th>
                      <th className="crm-th">Customer</th>
                      <th className="crm-th">Territory</th>
                      <th className="crm-th">Competitors</th>
                      <th className="crm-th">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealDetails.map((d: any) => (
                      <tr key={d.id} className="crm-tr">
                        <td className="crm-td">
                          <Link href={`/deals/${d.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">
                            {d.dealName}
                          </Link>
                        </td>
                        <td className="crm-td">
                          <StatusPill status={d.status} />
                        </td>
                        <td className="crm-td">{formatCurrency(d.dealValue)}</td>
                        <td className="crm-td">{d.customerName}</td>
                        <td className="crm-td">{d.territory}</td>
                        <td className="crm-td">
                          <div className="flex flex-wrap gap-1">
                            {(d.competitors || []).map((name: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--surface-2)] text-[var(--text-secondary)]"
                              >
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getChartColor(name) }} />
                                {name}
                              </span>
                            ))}
                            {(!d.competitors || d.competitors.length === 0) && <span className="text-[var(--text-muted)]">—</span>}
                          </div>
                        </td>
                        <td className="crm-td text-[var(--text-secondary)]">{new Date(d.updatedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No deals match the filter." />
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
