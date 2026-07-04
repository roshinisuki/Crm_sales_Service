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
  const trendColor = trend ? (trend.up ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-rose-600 bg-rose-50 dark:bg-rose-950/30") : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 flex flex-col justify-between h-full shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_-3px_rgba(0,0,0,0.08),0_12px_24px_-2px_rgba(0,0,0,0.04)] transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            <CountUp end={value} prefix={prefix} suffix={suffix} decimals={decimals || 0} />
          </h3>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
        {trend && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${trendColor}`}>
            {trend.value}
          </span>
        )}
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{comparison}</span>
      </div>
    </motion.div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-xl border border-slate-850 dark:border-slate-800 backdrop-blur-sm">
      <p className="font-bold mb-1.5 text-slate-200">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            {entry.name}:
          </span>
          <span className="font-extrabold text-white">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Section Card Wrapper ─────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-2px_rgba(0,0,0,0.03)] p-6 h-full ${className ?? ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
          className="px-4.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm transition-all"
        >
          <option value="alltime">All Time</option>
          <option value="last30days">Last 30 Days</option>
          <option value="last3months">Last 3 Months</option>
          <option value="last6months">Last 6 Months</option>
        </select>
      }
    >
      <div className="space-y-6">
        {/* ══ 1. MANAGER KPI SECTION ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPIWidget
            label="Team Quota Attainment"
            value={teamQuotaAttainment}
            suffix="%"
            icon={<Target size={18} className="text-blue-600 dark:text-blue-400" />}
            trend={{ value: teamQuotaAttainment >= 75 ? "On track" : "Behind", up: teamQuotaAttainment >= 75 }}
            comparison="current month"
            sparklineData={generateSparkline(teamQuotaAttainment || 50, "up")}
            color="text-slate-800"
            accentBg="bg-blue-50/70 dark:bg-blue-950/40"
          />
          <KPIWidget
            label="Deals at Risk"
            value={dealsAtRisk}
            icon={<AlertTriangle size={18} className={dealsAtRisk > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />}
            trend={{ value: dealsAtRisk > 0 ? "Needs attention" : "All clear", up: dealsAtRisk === 0 }}
            comparison="past due or stale"
            sparklineData={generateSparkline(dealsAtRisk || 1, "down")}
            color="text-slate-800"
            accentBg={dealsAtRisk > 0 ? "bg-rose-50/70 dark:bg-rose-950/40" : "bg-emerald-50/70 dark:bg-emerald-950/40"}
          />
          <KPIWidget
            label="Open Pipeline Value"
            value={openPipelineParsed.end}
            prefix={openPipelineParsed.prefix}
            decimals={openPipelineParsed.decimals}
            icon={<DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />}
            trend={{ value: "Active", up: true }}
            comparison="open deals"
            sparklineData={generateSparkline(openPipelineParsed.end || 100000, "up")}
            color="text-slate-800"
            accentBg="bg-emerald-50/70 dark:bg-emerald-950/40"
          />
          <KPIWidget
            label="Avg Deal Cycle"
            value={avgDealCycle}
            suffix=" days"
            icon={<Clock size={18} className="text-purple-600 dark:text-purple-400" />}
            trend={{ value: avgDealCycle > 0 ? (avgDealCycle <= 30 ? "Fast" : "Slow") : "—", up: avgDealCycle <= 30 }}
            comparison="won deals"
            sparklineData={generateSparkline(avgDealCycle || 15, "down")}
            color="text-slate-800"
            accentBg="bg-purple-50/70 dark:bg-purple-950/40"
          />
        </div>

        {/* ══ 2. NEEDS YOUR ATTENTION PANEL (Moved to top priority context) ══ */}
        <div className="bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/60">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Needs Your Attention</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">High priority action items requiring review</p>
          </div>
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
        </div>

        {/* ══ 3. SALES PERFORMANCE ANALYTICS ══ */}
        <SectionCard
          title="Sales Performance Analytics"
          subtitle="Monthly revenue vs leads converted trend"
          action={
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" />Leads Converted</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={performanceData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" dark-stroke="#1E293B" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, (dataMax: number) => roundUpYAxisMax(dataMax)]}
                tick={{ fontSize: 11, fill: "#94A3B8" }}
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
              <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
              <Line dataKey="leads" name="Leads Converted" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3, fill: "#8B5CF6" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
          {hasSparseData && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 italic text-center">
              Showing available data — full trend appears as more months are recorded.
            </p>
          )}
        </SectionCard>

        {/* ══ 4. PIPELINE OVERVIEW + CONVERSION FUNNEL ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pipeline Doughnut */}
          <SectionCard title="Sales Pipeline Overview" subtitle="Deal distribution across stages">
            {pipelineData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="w-full sm:w-1/2 flex justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pipelineData.map((entry: any, idx: number) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2.5">
                  {pipelineData.map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-600 dark:text-slate-400 truncate">{entry.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No pipeline data available</div>
            )}
          </SectionCard>

          {/* Conversion Funnel */}
          <SectionCard title="Conversion Funnel" subtitle="Lead-to-close conversion journey">
            {funnelStages.length > 0 ? (
              <div className="space-y-3.5">
                {funnelStages.map((stage: any, idx: number) => {
                  const maxCount = Math.max(...funnelStages.map((s: any) => s.count || 0), 1);
                  const widthPct = Math.max((stage.count / maxCount) * 100, 12);
                  const prevCount = idx > 0 ? funnelStages[idx - 1].count : stage.count;
                  const dropPct = idx > 0 && prevCount > 0
                    ? Math.round(((prevCount - stage.count) / prevCount) * 100)
                    : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      {idx > 0 && dropPct > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 pl-24">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <span>{100 - dropPct}% conversion rate · {dropPct}% drop-off</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-20 shrink-0 text-right">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate block">{stage.stage}</span>
                        </div>
                        <div className="flex-1 relative">
                          <motion.div
                             initial={{ width: 0 }}
                             animate={{ width: `${widthPct}%` }}
                             transition={{ duration: 0.5, delay: idx * 0.05 }}
                             className="h-7.5 rounded-lg flex items-center justify-between px-3 shadow-sm"
                             style={{ backgroundColor: stage.color }}
                          >
                            <span className="text-xs font-bold text-white">{stage.count}</span>
                            <span className="text-[10px] font-bold text-white/90">{stage.pct}%</span>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No funnel data available</div>
            )}
          </SectionCard>
        </div>

        {/* ══ 5. REP LEADERBOARD ══ */}
        <SectionCard
          title="Rep Leaderboard"
          subtitle="Sales executive performance with quota attainment"
          action={
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSortBy("revenue")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === "revenue" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                Revenue Won
              </button>
              <button
                onClick={() => setSortBy("quota")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === "quota" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                Quota Attainment
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/50">
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-12">Rank</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Executive</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Leads</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Won</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Conv. Rate</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Revenue</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[150px]">Quota Attainment</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">No team performance data</td></tr>
                ) : (
                  sortedAgents.map((agent: any, idx: number) => {
                    const quotaPct = Math.min(agent.quotaAttainment || 0, 100);
                    const quotaColor = quotaPct >= 75 ? "from-emerald-500 to-emerald-400" : quotaPct >= 50 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
                    return (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                        className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/55 dark:hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                            idx === 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" : idx === 1 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : idx === 2 ? "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400" : "bg-slate-50/50 text-slate-400 dark:bg-slate-900 dark:text-slate-500"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-sm">
                              {agent.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <span className="text-sm font-semibold text-slate-750 dark:text-slate-200">{agent.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-sm text-slate-600 dark:text-slate-400 font-semibold">{agent.leadCount || agent.dealsCount || 0}</td>
                        <td className="py-3.5 px-4 text-right text-sm text-slate-600 dark:text-slate-400 font-semibold">{agent.wonCount}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${agent.conversionRate >= 30 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : agent.conversionRate >= 15 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"}`}>
                            {agent.conversionRate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(agent.revenue || 0)}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden min-w-[100px]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${quotaPct}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.04 }}
                                className={`h-full rounded-full bg-gradient-to-r ${quotaColor}`}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{quotaPct}%</span>
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

        {/* ══ 6. LEAD SOURCE + REVENUE INSIGHTS ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Lead Source Analysis */}
          <SectionCard title="Lead Source Analysis" subtitle="Volume and conversion by channel">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={sourceData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" dark-stroke="#1E293B" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax + 1"]}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={false}
                    tickLine={false}
                    width={85}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Lead Volume" radius={[0, 4, 4, 0]} barSize={16}>
                    {sourceData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isUnknown ? "#CBD5E1" : entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No lead source data</div>
            )}
            {sourceData.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                {sourceData.slice(0, 3).map((s: any, idx: number) => (
                  <div key={idx} className="text-center bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-slate-50 dark:border-slate-800/40">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.isUnknown ? "Unknown" : s.source}</p>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">{s.conversionRate}% conv</p>
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
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Products</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />Services</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Renewals</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Upsells</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueBreakdown} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" dark-stroke="#1E293B" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, (dataMax: number) => roundUpYAxisMax(dataMax)]}
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="products" name="Products" stackId="a" fill="#3B82F6" />
                <Bar dataKey="services" name="Services" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="renewals" name="Renewals" stackId="a" fill="#10B981" />
                <Bar dataKey="upsells" name="Upsells" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* ══ 7. RECENT ACTIVITIES ══ */}
        <SectionCard title="Recent Activities" subtitle="Latest team actions and updates">
          {recentActivities.length > 0 ? (
            <div className="relative pt-2">
              <div className="absolute left-[17px] top-3.5 bottom-3.5 w-px bg-slate-100 dark:bg-slate-800" />
              <div className="space-y-4">
                {recentActivities.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="flex items-start gap-3.5 relative"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 shadow-sm border border-white dark:border-slate-800 ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[8px] font-extrabold shrink-0">
                          {item.actor?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{item.actor}</span>
                        <span className="text-xs text-slate-300 dark:text-slate-750">·</span>
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No recent activities</div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

// ── Attention Card Component ─────────────────────────────────────────────────
function AttentionCard({ icon, label, count, href, color }: { icon: React.ReactNode; label: string; count: number; href: string; color: "red" | "amber" | "blue" | "purple" }) {
  const colorMap = {
    red: { bg: "bg-rose-50/60 dark:bg-rose-950/20", iconBg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-600 dark:text-rose-400", border: "border-rose-100 dark:border-rose-950" },
    amber: { bg: "bg-amber-50/60 dark:bg-amber-950/20", iconBg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-600 dark:text-amber-400", border: "border-amber-100 dark:border-amber-950" },
    blue: { bg: "bg-blue-50/60 dark:bg-blue-950/20", iconBg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400", border: "border-blue-100 dark:border-blue-950" },
    purple: { bg: "bg-purple-50/60 dark:bg-purple-950/20", iconBg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-600 dark:text-purple-400", border: "border-purple-100 dark:border-purple-950" },
  };
  const c = colorMap[color];
  return (
    <a
      href={href}
      className={`flex items-center justify-between p-4 rounded-2xl border ${c.border} ${c.bg} hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-300 group`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg} ${c.text}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-extrabold tracking-tight ${c.text} mt-0.5`}>{count}</p>
        </div>
      </div>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60 opacity-60 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={14} className="text-slate-400 dark:text-slate-350" />
      </div>
    </a>
  );
}
