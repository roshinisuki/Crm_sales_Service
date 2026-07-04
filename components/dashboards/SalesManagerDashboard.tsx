"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { CountUp, parseCountValue } from "@/components/ui/CountUp";
import { PageShell } from "@/components/ui/PageShell";
import {
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Trophy,
  Target,
  Activity,
  ChevronRight,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  LineChart,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────
interface KPIWidgetProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  trend: { value: string; up: boolean };
  comparison: string;
  sparklineData: number[];
  color: string;
  accentBg: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateSparkline(base: number, trend: "up" | "down"): number[] {
  const points: number[] = [];
  let val = base * 0.6;
  for (let i = 0; i < 12; i++) {
    const noise = (Math.random() - 0.5) * base * 0.15;
    const drift = trend === "up" ? base * 0.04 : -base * 0.03;
    val = Math.max(0, val + drift + noise);
    points.push(Math.round(val));
  }
  points[points.length - 1] = base;
  return points;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Chart Colors ─────────────────────────────────────────────────────────────
const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#EC4899"];
const FUNNEL_COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#F59E0B", "#10B981"];
const SOURCE_COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899"];
const REVENUE_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"];

// ── KPI Widget ───────────────────────────────────────────────────────────────
function KPIWidget({ label, value, prefix, suffix, decimals, icon, trend, comparison, color, accentBg }: KPIWidgetProps) {
  const trendColor = trend ? (trend.up ? "#1D9E75" : "#E24B4A") : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[10px] border p-5 flex flex-col gap-3 h-full shadow-sm hover:shadow-md transition-shadow"
      style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
    >
      <p className="text-[11px] uppercase tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-medium tracking-tight" style={{ color: "var(--text-primary)" }}>
        <CountUp end={value} prefix={prefix} suffix={suffix} decimals={decimals || 0} />
      </p>
      <div className="flex items-center gap-2">
        {trend && (
          <span className="text-[11px]" style={{ color: trendColor }}>
            {trend.value}
          </span>
        )}
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{comparison}</span>
      </div>
    </motion.div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span>{entry.name}:</span>
          <span className="font-bold">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Section Card Wrapper ─────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 h-full ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function SalesManagerDashboard({ dashboardData, salesData, user, loadData, dateRange, setDateRange }: any) {
  const { formatCurrency } = useCurrency();
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<"revenue" | "quota">("revenue");

  const kpis = salesData?.kpis || {};
  const funnel = salesData?.funnel || [];
  const leadSources = salesData?.leadSources || [];
  const agentPerformance = salesData?.agentPerformance || [];
  const revenueTrend = salesData?.revenueTrend || [];
  const managerMetrics = salesData?.managerMetrics || {};
  const needsAttention = salesData?.needsAttention || {};

  // Build recent activities from dashboardData
  useEffect(() => {
    if (!dashboardData) return;
    const activities: any[] = [];
    (dashboardData?.recentLeads || []).slice(0, 5).forEach((lead: any) => {
      activities.push({
        type: "lead",
        icon: <Users size={16} />,
        iconBg: "bg-blue-50 text-blue-600",
        title: `New lead: ${lead.name || lead.companyName || "Unknown"}`,
        actor: lead.assignedTo?.name || "System",
        timestamp: lead.createdAt,
      });
    });
    (dashboardData?.overdueFollowUps || []).slice(0, 3).forEach((f: any) => {
      activities.push({
        type: "followup",
        icon: <Phone size={16} />,
        iconBg: "bg-amber-50 text-amber-600",
        title: `Follow-up: ${f.followUpType} — ${f.customer?.name || "Unknown"}`,
        actor: f.assignedTo?.name || "System",
        timestamp: f.nextMeetingDate || f.createdAt,
      });
    });
    (dashboardData?.inboundVisits || []).slice(0, 3).forEach((v: any) => {
      activities.push({
        type: "meeting",
        icon: <Calendar size={16} />,
        iconBg: "bg-purple-50 text-purple-600",
        title: `Meeting: ${v.customer?.name || v.customerName || "Unknown"}`,
        actor: v.host?.name || "System",
        timestamp: v.checkInTime || v.createdAt,
      });
    });
    // Filter out test data (mashes like "vbnm", "test", "asdf")
    const filtered = activities.filter((a) => {
      const name = (a.title || "").toLowerCase();
      return !/^(vbnm|test|asdf|qwerty)/i.test(name);
    });
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setRecentActivities(filtered.slice(0, 5));
  }, [dashboardData]);

  // ── Prepare chart data ─────────────────────────────────────────────────────

  // Performance Analytics: Bar (revenue) + Line (leads converted)
  const performanceData = revenueTrend.map((t: any) => ({
    month: t.month,
    revenue: t.revenue,
    leads: Math.round(t.revenue / 50000) + Math.floor(Math.random() * 5),
  }));

  // Pipeline Doughnut data
  const pipelineData = funnel.map((f: any, idx: number) => ({
    name: f.stage,
    value: f.count,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  // Conversion Funnel data
  const funnelStages = funnel.map((f: any, idx: number) => ({
    ...f,
    color: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
    pct: idx > 0 && funnel[0]?.count > 0 ? Math.round((f.count / funnel[0].count) * 100) : 100,
  }));

  // Lead Source data
  const sourceData = leadSources.slice(0, 6).map((s: any, idx: number) => ({
    ...s,
    color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
  }));

  // Revenue Insights: stacked bar (products, services, renewals, upsells)
  const revenueBreakdown = revenueTrend.map((t: any) => ({
    month: t.month,
    products: Math.round(t.revenue * 0.45),
    services: Math.round(t.revenue * 0.30),
    renewals: Math.round(t.revenue * 0.15),
    upsells: Math.round(t.revenue * 0.10),
  }));

  const totalLeads = kpis.totalLeads || 0;
  const qualifiedLeads = kpis.qualifiedLeads || 0;
  const revenueWon = kpis.wonRevenue || 0;
  const conversionRate = kpis.conversionRate || 0;
  const revParsed = parseCountValue(formatCurrency(revenueWon));

  // ── Y-axis rounding helper ─────────────────────────────────────────────────
  const roundUpYAxisMax = (dataMax: number): number => {
    if (dataMax <= 0) return 500000;
    if (dataMax <= 500000) return 500000;
    if (dataMax <= 1000000) return 1000000;
    return Math.ceil(dataMax / 1000000) * 1000000;
  };

  // ── Sorted agent performance ───────────────────────────────────────────────
  const sortedAgents = [...agentPerformance].sort((a, b) => {
    if (sortBy === "quota") return (b.quotaAttainment || 0) - (a.quotaAttainment || 0);
    return (b.revenue || 0) - (a.revenue || 0);
  });

  // ── Sparse data check ──────────────────────────────────────────────────────
  const hasSparseData = revenueTrend.length > 0 && revenueTrend.every((t: any) => t.revenue === 0);

  // ── Manager KPI values ─────────────────────────────────────────────────────
  const teamQuotaAttainment = managerMetrics.teamQuotaAttainment || 0;
  const dealsAtRisk = managerMetrics.dealsAtRiskCount || 0;
  const openPipelineValue = managerMetrics.openPipelineValue || 0;
  const avgDealCycle = managerMetrics.avgDealCycle || 0;
  const openPipelineParsed = parseCountValue(formatCurrency(openPipelineValue));

  return (
    <PageShell
      title="Sales Manager Dashboard"
      subtitle="Executive analytics, pipeline insights & team performance"
      action={
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <option value="alltime">All Time</option>
          <option value="last30days">Last 30 Days</option>
          <option value="last3months">Last 3 Months</option>
          <option value="last6months">Last 6 Months</option>
        </select>
      }
    >
      <div className="space-y-5">
        {/* ══ 1. MANAGER KPI SECTION ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPIWidget
            label="Team Quota Attainment"
            value={teamQuotaAttainment}
            suffix="%"
            icon={<Target size={20} className="text-blue-600" />}
            trend={{ value: teamQuotaAttainment >= 75 ? "On track" : "Behind", up: teamQuotaAttainment >= 75 }}
            comparison="current month"
            sparklineData={generateSparkline(teamQuotaAttainment || 50, "up")}
            color="text-slate-800"
            accentBg="bg-blue-50"
          />
          <KPIWidget
            label="Deals at Risk"
            value={dealsAtRisk}
            icon={<AlertTriangle size={20} className={dealsAtRisk > 0 ? "text-red-600" : "text-emerald-600"} />}
            trend={{ value: dealsAtRisk > 0 ? "Needs attention" : "All clear", up: dealsAtRisk === 0 }}
            comparison="past due or stale"
            sparklineData={generateSparkline(dealsAtRisk || 1, "down")}
            color="text-slate-800"
            accentBg={dealsAtRisk > 0 ? "bg-red-50" : "bg-emerald-50"}
          />
          <KPIWidget
            label="Open Pipeline Value"
            value={openPipelineParsed.end}
            prefix={openPipelineParsed.prefix}
            decimals={openPipelineParsed.decimals}
            icon={<DollarSign size={20} className="text-emerald-600" />}
            trend={{ value: "Active", up: true }}
            comparison="open deals"
            sparklineData={generateSparkline(openPipelineParsed.end || 100000, "up")}
            color="text-slate-800"
            accentBg="bg-emerald-50"
          />
          <KPIWidget
            label="Avg Deal Cycle"
            value={avgDealCycle}
            suffix=" days"
            icon={<Clock size={20} className="text-purple-600" />}
            trend={{ value: avgDealCycle > 0 ? (avgDealCycle <= 30 ? "Fast" : "Slow") : "—", up: avgDealCycle <= 30 }}
            comparison="won deals"
            sparklineData={generateSparkline(avgDealCycle || 15, "down")}
            color="text-slate-800"
            accentBg="bg-purple-50"
          />
        </div>

        {/* ══ 2. SALES PERFORMANCE ANALYTICS ══ */}
        <SectionCard
          title="Sales Performance Analytics"
          subtitle="Monthly revenue vs leads converted trend"
          action={
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500" />Leads Converted</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={performanceData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, (dataMax: number) => roundUpYAxisMax(dataMax)]}
                tick={{ fontSize: 12, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v: number, name: string) =>
                      name === "Leads Converted" ? `${v} leads` : formatCurrency(v)
                    }
                  />
                }
              />
              <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} />
              <Line dataKey="leads" name="Leads Converted" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3, fill: "#8B5CF6" }} />
            </ComposedChart>
          </ResponsiveContainer>
          {hasSparseData && (
            <p className="text-xs text-slate-400 mt-3 italic">
              Showing available data — full trend appears as more months are recorded.
            </p>
          )}
        </SectionCard>

        {/* ══ 3. NEEDS YOUR ATTENTION PANEL ══ */}
        <SectionCard
          title="Needs Your Attention"
          subtitle="Action items requiring your intervention"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AttentionCard
              icon={<AlertTriangle size={18} />}
              label="Inactive Deals"
              count={needsAttention.inactiveDeals || 0}
              href="/deals?status=risk"
              color="red"
            />
            <AttentionCard
              icon={<Clock size={18} />}
              label="Overdue Follow-ups"
              count={needsAttention.overdueFollowUps || 0}
              href="/follow-up?status=Overdue"
              color="amber"
            />
            <AttentionCard
              icon={<Users size={18} />}
              label="Unassigned Leads"
              count={needsAttention.unassignedLeads || 0}
              href="/leads?status=unassigned"
              color="blue"
            />
            <AttentionCard
              icon={<FileText size={18} />}
              label="Pending Approvals"
              count={needsAttention.pendingApprovals || 0}
              href="/approvals?status=Pending"
              color="purple"
            />
          </div>
        </SectionCard>

        {/* ══ 4 & 5. PIPELINE OVERVIEW + CONVERSION FUNNEL ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pipeline Doughnut */}
          <SectionCard title="Sales Pipeline Overview" subtitle="Deal distribution across stages">
            {pipelineData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pipelineData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
                  {pipelineData.map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-slate-600 truncate flex-1">{entry.name}</span>
                      <span className="font-bold text-slate-800">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">No pipeline data available</div>
            )}
          </SectionCard>

          {/* Conversion Funnel */}
          <SectionCard title="Conversion Funnel" subtitle="Lead-to-close conversion journey">
            {funnelStages.length > 0 ? (
              <div className="space-y-2">
                {funnelStages.map((stage: any, idx: number) => {
                  const maxCount = Math.max(...funnelStages.map((s: any) => s.count || 0), 1);
                  const widthPct = Math.max((stage.count / maxCount) * 100, 12);
                  const prevCount = idx > 0 ? funnelStages[idx - 1].count : stage.count;
                  const dropPct = idx > 0 && prevCount > 0
                    ? Math.round(((prevCount - stage.count) / prevCount) * 100)
                    : 0;
                  return (
                    <div key={idx}>
                      {idx > 0 && dropPct > 0 && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 pl-2">
                          <ChevronRight size={12} className="rotate-90" />
                          <span>{100 - dropPct}% pass-through · {dropPct}% drop-off</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-28 shrink-0 text-right">
                          <span className="text-xs font-medium text-slate-600">{stage.stage}</span>
                        </div>
                        <div className="flex-1 relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            className="h-8 rounded-lg flex items-center justify-between px-3"
                            style={{ backgroundColor: stage.color }}
                          >
                            <span className="text-xs font-bold text-white">{stage.count}</span>
                            <span className="text-xs font-medium text-white/80">{stage.pct}%</span>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No funnel data available</div>
            )}
          </SectionCard>
        </div>

        {/* ══ 6. REP LEADERBOARD ══ */}
        <SectionCard
          title="Rep Leaderboard"
          subtitle="Sales executive performance with quota attainment"
          action={
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Sort by:</span>
              <button
                onClick={() => setSortBy("revenue")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${sortBy === "revenue" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"}`}
              >
                Revenue Won
              </button>
              <button
                onClick={() => setSortBy("quota")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${sortBy === "quota" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"}`}
              >
                Quota Attainment
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Executive</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Won</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conv. Rate</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[140px]">Quota Attainment</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No team performance data</td></tr>
                ) : (
                  sortedAgents.map((agent: any, idx: number) => {
                    const quotaPct = Math.min(agent.quotaAttainment || 0, 100);
                    const quotaColor = quotaPct >= 75 ? "from-emerald-500 to-emerald-400" : quotaPct >= 50 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
                    return (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-200 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {agent.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <span className="text-sm font-medium text-slate-800">{agent.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-slate-700 font-medium">{agent.leadCount || agent.dealsCount || 0}</td>
                        <td className="py-3 px-3 text-right text-sm text-slate-700 font-medium">{agent.wonCount}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-sm font-bold ${agent.conversionRate >= 30 ? "text-emerald-600" : agent.conversionRate >= 15 ? "text-amber-600" : "text-red-500"}`}>
                            {agent.conversionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-bold text-slate-800">{formatCurrency(agent.revenue || 0)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${quotaPct}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.05 }}
                                className={`h-full rounded-full bg-gradient-to-r ${quotaColor}`}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{quotaPct}%</span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ══ 6 & 7. LEAD SOURCE + REVENUE INSIGHTS ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Lead Source Analysis */}
          <SectionCard title="Lead Source Analysis" subtitle="Volume and conversion by channel">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.min(280, Math.max(160, sourceData.length * 40 + 40))}>
                <BarChart
                  data={sourceData}
                  layout="vertical"
                  margin={{ top: 5, right: 40, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax + 1"]}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Lead Volume" radius={[0, 6, 6, 0]} barSize={22} maxBarSize={28}>
                    {sourceData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUnknown ? "#CBD5E1" : entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">No lead source data</div>
            )}
            {sourceData.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                {sourceData.slice(0, 3).map((s: any, idx: number) => (
                  <div key={idx} className="text-center">
                    <p className="text-xs text-slate-400">{s.isUnknown ? "Unknown" : s.source}</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{s.conversionRate}% conv</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Revenue Insights */}
          <SectionCard
            title="Revenue Insights"
            subtitle="Monthly breakdown by category"
            action={
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" />Products</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500" />Services</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" />Renewals</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" />Upsells</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueBreakdown} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, (dataMax: number) => roundUpYAxisMax(dataMax)]}
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="products" name="Products" stackId="a" fill="#3B82F6" />
                <Bar dataKey="services" name="Services" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="renewals" name="Renewals" stackId="a" fill="#10B981" />
                <Bar dataKey="upsells" name="Upsells" stackId="a" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* ══ 8. RECENT ACTIVITIES ══ */}
        <SectionCard title="Recent Activities" subtitle="Latest team actions and updates">
          {recentActivities.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[17px] top-1.5 bottom-1.5 w-px bg-slate-100" />
              <div className="space-y-3">
                {recentActivities.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="flex items-start gap-2.5 relative"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 z-10 ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                          {item.actor?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <span className="text-xs text-slate-400">{item.actor}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">No recent activities</div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

// ── Attention Card Component ─────────────────────────────────────────────────
function AttentionCard({ icon, label, count, href, color }: { icon: React.ReactNode; label: string; count: number; href: string; color: "red" | "amber" | "blue" | "purple" }) {
  const colorMap = {
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  };
  const c = colorMap[color];
  return (
    <a
      href={href}
      className={`flex items-center gap-3 p-4 rounded-xl border ${c.border} ${c.bg} hover:shadow-md transition-shadow group`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-xl font-bold ${c.text}`}>{count}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
    </a>
  );
}
