"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import {
  Users, TrendingUp, DollarSign, Clock, CalendarCheck,
  ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

// Modals
import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import { SalesFunnelChart, RecentLeadsTableWidget, AgentLeaderboard, CrossModuleBentoGrid, OverallCRMHealthScore, RecentActivityFeed, LeadSourceDoughnut, WinLossSummaryWidget, ForecastVsTargetWidget, FollowUpTrendWidget } from "./SalesWidgets";
import { CountUp } from "@/components/ui/CountUp";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

// ─── Mini KPI Strip ─────────────────────────────────────────────────────────
function KpiStrip({ dashboardData, salesData, formatCurrency }: any) {
  const kpis = [
    {
      label: "Total Pipeline",
      value: salesData?.kpis?.pipelineRevenue ?? 0,
      display: salesData?.kpis?.pipelineRevenue ? <CountUp end={salesData.kpis.pipelineRevenue} prefix="₹" /> : "₹0",
      trend: "Revenue at stake",
      up: true,
      icon: <DollarSign size={20} />,
      color: "var(--accent)",
      bg: "var(--accent-soft)",
    },
    {
      label: "Total Leads",
      value: salesData?.kpis?.totalLeads ?? 0,
      display: <CountUp end={salesData?.kpis?.totalLeads ?? 0} />,
      trend: `${salesData?.kpis?.conversionRate ?? 0}% converted`,
      up: true,
      icon: <Users size={20} />,
      color: "var(--accent)",
      bg: "var(--accent-soft)",
    },
    {
      label: "Open Deals",
      value: salesData?.kpis?.openDeals ?? 0,
      display: <CountUp end={salesData?.kpis?.openDeals ?? 0} />,
      trend: "Active in pipeline",
      up: true,
      icon: <TrendingUp size={20} />,
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
    },
    {
      label: "Total Accounts",
      value: salesData?.crossModule?.accounts?.total ?? 0,
      display: <CountUp end={salesData?.crossModule?.accounts?.total ?? 0} />,
      trend: "Active customers",
      up: true,
      icon: <Activity size={20} />,
      color: "var(--accent)",
      bg: "var(--accent-soft)",
    },
    {
      label: "Overdue Actions",
      value: dashboardData?.stats?.followUpMetrics?.pending ?? 0,
      display: <CountUp end={dashboardData?.stats?.followUpMetrics?.pending ?? 0} />,
      trend: "Needs attention",
      up: false,
      icon: <Clock size={20} />,
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
    },
    {
      label: "Pending Samples",
      value: salesData?.crossModule?.samples?.pending ?? 0,
      display: <CountUp end={salesData?.crossModule?.samples?.pending ?? 0} />,
      trend: "Awaiting review",
      up: false,
      icon: <CalendarCheck size={20} />,
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.12)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {kpis.map((k) => (
        <div key={k.label} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-5 rounded-[24px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col gap-3 group cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{k.label}</span>
            <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: k.bg, color: k.color }}>
              {k.icon}
            </span>
          </div>
          <p className="text-3xl font-black text-[var(--text-primary)] m-0 tracking-tight">{k.display}</p>
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: k.up ? "#10b981" : "#ef4444", background: k.up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
              {k.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {k.up ? "Good" : "Action"}
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] truncate">{k.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sales Line Chart Card ───────────────────────────────────────────────────
function SalesLineCard({ salesData, formatCurrency }: { salesData: any, formatCurrency: (v: number) => string }) {
  const [accentColor, setAccentColor] = useState('rgba(37, 99, 235, 1)');
  const [accentBg, setAccentBg] = useState('rgba(37, 99, 235, 0.15)');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const getRgba = (colorStr: string, opacity: number) => {
        const color = colorStr.trim();
        if (color.startsWith('#')) {
          const hex = color.replace('#', '');
          if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          } else if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
        } else if (color.startsWith('rgb')) {
          const match = color.match(/\d+/g);
          if (match && match.length >= 3) {
            return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${opacity})`;
          }
        }
        return `rgba(37, 99, 235, ${opacity})`;
      };

      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) {
          setAccentColor(acc);
          setAccentBg(getRgba(acc, 0.15));
        }
        setIsDark(document.documentElement.classList.contains('dark'));
      };
      updateColors();
      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
      return () => observer.disconnect();
    }
  }, []);

  const trend = salesData?.revenueTrend || [];
  const labels = trend.length ? trend.map((t: any) => t.month) : ["No Data"];
  const revenuePoints = trend.length ? trend.map((t: any) => t.revenue) : [0];

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Revenue",
        data: revenuePoints,
        borderColor: accentColor, 
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return accentBg;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          
          let r = 37, g = 99, b = 235; // Default blue
          if (accentColor.startsWith('#')) {
            const hex = accentColor.replace('#', '');
            if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            }
          } else if (accentColor.startsWith('rgb')) {
            const match = accentColor.match(/\d+/g);
            if (match && match.length >= 3) {
              r = parseInt(match[0], 10);
              g = parseInt(match[1], 10);
              b = parseInt(match[2], 10);
            }
          }
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
          return gradient;
        },
        fill: true,
        tension: 0.4, // Smooth curve as in the image
        borderWidth: 3,
        pointRadius: 0, // Hidden until hover
        pointBackgroundColor: accentColor,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: accentColor,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const options: any = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
    scales: {
      x: { 
        grid: { display: true, color: 'rgba(148,163,184,0.1)' }, 
        ticks: { font: { size: 11 }, color: isDark ? '#94a3b8' : '#64748b' }, 
        border: { display: false } 
      },
      y: { 
        type: 'linear', 
        display: true, 
        position: 'left', 
        grid: { display: false }, 
        border: { display: false }, 
        ticks: { font: { size: 11 }, color: isDark ? '#94a3b8' : '#64748b', callback: (v: number) => (v / 1000) + 'k' } 
      },
    },
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-[var(--text-primary)] m-0">Sales Analytics</p>
        <select className="text-[11px] font-bold text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-lg outline-none cursor-pointer">
          <option>This Week</option>
          <option>Last Week</option>
        </select>
      </div>
      <div className="flex-1 relative min-h-[240px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

// ─── Main AdminDashboard ─────────────────────────────────────────────────────
export default function AdminDashboard({ dashboardData, salesData, user, loadData, dateRange, setDateRange }: any) {
  const loading = !dashboardData;
  const { formatCurrency } = useCurrency();

  // Modal states
  const [isInboundOpen,     setIsInboundOpen]     = useState(false);
  const [isOutboundOpen,    setIsOutboundOpen]    = useState(false);
  const [isCheckoutOpen,    setIsCheckoutOpen]    = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<any>(null);

  const handleOpenCheckout = (visitItem: any, type: "Inbound" | "Outbound") => {
    setActiveCheckoutVisit({
      id: visitItem.id,
      customerId: visitItem.customerId || visitItem.customer?.id,
      customerName: visitItem.customerName || visitItem.customer?.name || "Unknown",
      customerCode: visitItem.customerCode || visitItem.customer?.customerCode || "—",
      visitType: type,
      purpose: visitItem.purpose || "Meeting",
      checkInTime: visitItem.checkInTime || visitItem.checkIn,
    });
    setIsCheckoutOpen(true);
  };

  return (
    <PageShell
      title="Analytics Overview"
      subtitle="Master consolidated view of sales, pipeline, and module activity"
      action={
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input-field py-2 text-xs h-9 font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer">
            <option value="alltime">All Time</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last3months">Last 3 Months</option>
            <option value="last6months">Last 6 Months</option>
          </select>
        </div>
      }
    >
      {/* ── 1. KPI Strip ── */}
      <KpiStrip dashboardData={dashboardData} salesData={salesData} formatCurrency={formatCurrency} />

      {/* ── 2. Main Analytics Row (Revenue Trend & Lead Sources) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        <div className="xl:col-span-3 h-[360px]">
          <SalesLineCard salesData={salesData} formatCurrency={formatCurrency} />
        </div>
        <div className="xl:col-span-1 h-[360px]">
          <LeadSourceDoughnut leadSources={salesData?.leadSources || []} />
        </div>
      </div>

      {/* ── 3. Row 3: Funnel, Quota, & Lead Sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="h-[340px]">
          <SalesFunnelChart funnel={salesData?.funnel || []} />
        </div>
        <div className="h-[340px]">
          <WinLossSummaryWidget kpis={salesData?.kpis} />
        </div>
        <div className="h-[340px]">
          <ForecastVsTargetWidget kpis={salesData?.kpis} agentPerformance={salesData?.agentPerformance || []} />
        </div>
      </div>

      {/* ── 4. Row 4: Leadership, Follow-up, & Action Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="h-[340px]">
          <AgentLeaderboard agentPerformance={salesData?.agentPerformance || []} />
        </div>
        <div className="h-[340px]">
          <FollowUpTrendWidget followUpMetrics={dashboardData?.stats?.followUpMetrics} />
        </div>
        <div className="h-[340px]">
          <RecentActivityFeed needsAttention={salesData?.needsAttention} crossModule={salesData?.crossModule} />
        </div>
      </div>

      {/* ── 5. Row 5: Operational Details & Modules (Option A) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column (3/4 width) */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <CrossModuleBentoGrid crossModule={salesData?.crossModule} />
          <RecentLeadsTableWidget recentLeads={dashboardData?.recentLeads || []} />
        </div>
        
        {/* Right Rail (1/4 width) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          {/* @ts-ignore */}
          <OverallCRMHealthScore kpis={salesData?.kpis} crossModule={salesData?.crossModule} />
        </div>
      </div>


      {/* ── Modals ── */}
      <InboundCheckInModal
        isOpen={isInboundOpen}
        onClose={() => setIsInboundOpen(false)}
        onSuccess={loadData}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />
      <OutboundCheckInModal
        isOpen={isOutboundOpen}
        onClose={() => setIsOutboundOpen(false)}
        onSuccess={loadData}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />
      <CheckOutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setActiveCheckoutVisit(null);
        }}
        onSuccess={loadData}
        visit={activeCheckoutVisit}
      />
    </PageShell>
  );
}
