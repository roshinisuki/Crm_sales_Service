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
import { PipelinePieChart, CustomerScoreTrendChart, RecentLeadsTableWidget, ActionRequiredWidget } from "./SalesWidgets";
import { CountUp } from "@/components/ui/CountUp";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

// ─── Mini KPI Strip ─────────────────────────────────────────────────────────
function KpiStrip({ dashboardData, salesData, formatCurrency }: any) {
  const kpis = [
    {
      label: "Total Leads",
      value: salesData?.kpis?.totalLeads ?? 0,
      display: <CountUp end={salesData?.kpis?.totalLeads ?? 0} />,
      trend: "+12.4%",
      up: true,
      sub: "vs last month",
      icon: <Users size={15} />,
      color: "var(--accent)",
      bg: "var(--accent-soft)",
    },
    {
      label: "Conversion Rate",
      value: salesData?.kpis?.conversionRate ?? 0,
      display: <><CountUp end={salesData?.kpis?.conversionRate ?? 0} />%</>,
      trend: "+3.2%",
      up: true,
      sub: "Higher than avg",
      icon: <TrendingUp size={15} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.10)",
    },
    {
      label: "Pipeline Revenue",
      value: salesData?.kpis?.pipelineRevenue ?? 0,
      display: salesData?.kpis?.pipelineRevenue
        ? <CountUp end={salesData.kpis.pipelineRevenue} prefix="₹" />
        : "₹0",
      trend: "-1.5%",
      up: false,
      sub: "Pipeline shifting",
      icon: <DollarSign size={15} />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.10)",
    },
    {
      label: "Pending Follow-ups",
      value: dashboardData?.stats?.followUpMetrics?.pending ?? 0,
      display: <CountUp end={dashboardData?.stats?.followUpMetrics?.pending ?? 0} />,
      trend: "Needs attention",
      up: false,
      sub: "Overdue items",
      icon: <Clock size={15} />,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.10)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "14px",
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "16px",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            transition: "box-shadow 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {k.label}
            </span>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "10px",
                background: k.bg,
                color: k.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {k.icon}
            </span>
          </div>
          <p style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0 }}>
            {k.display}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "11px",
                fontWeight: 600,
                color: k.up ? "#10b981" : "#ef4444",
                background: k.up ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              {k.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {k.trend}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{k.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sales Line Chart Card ───────────────────────────────────────────────────
function SalesLineCard({ formatCurrency }: { formatCurrency: (v: number) => string }) {
  const data = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "This Week",
        data: [20, 36, 52, 47, 88, 38, 62],
        borderColor: "#3b82f6",
        backgroundColor: "transparent",
        tension: 0.42,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: "Last Week",
        data: [18, 22, 15, 32, 27, 34, 29],
        borderColor: "rgba(148,163,184,0.6)",
        backgroundColor: "transparent",
        tension: 0.42,
        borderDash: [5, 5],
        borderWidth: 1.8,
        pointRadius: 0,
      },
    ],
  };

  const options: any = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } },
      },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(0,0,0,0.05)" },
        border: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Overall Sales
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <span style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
              <CountUp end={40256} prefix="₹" />
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#10b981",
                background: "rgba(16,185,129,0.12)",
                borderRadius: "999px",
                padding: "3px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <ArrowUpRight size={11} /> 20.8%
            </span>
          </div>
        </div>
        <Activity size={18} style={{ color: "var(--text-muted)" }} />
      </div>
      <div style={{ height: "180px" }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

// ─── Visit Summary Card ───────────────────────────────────────────────────────
function VisitSummaryCard({ dashboardData }: { dashboardData: any }) {
  const inboundCount = dashboardData?.inboundVisits?.length || 0;
  const outboundCount = dashboardData?.outboundVisits?.length || 0;
  const pendingCount = dashboardData?.pendingApprovals?.length || 0;
  const totalVisits = inboundCount + outboundCount;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Visit Summary
        </p>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Today</span>
      </div>
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "4px", padding: "16px 0" }}>
        <span style={{ fontSize: "36px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          <CountUp end={totalVisits} />
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Total Check-ins</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "999px", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Inbound Walk-ins</span>
          </div>
          <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            <CountUp end={inboundCount} />
          </strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "999px", background: "#3b82f6", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Field / Outbound</span>
          </div>
          <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            <CountUp end={outboundCount} />
          </strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "999px", background: "#ef4444", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Pending Approvals</span>
          </div>
          <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            <CountUp end={pendingCount} />
          </strong>
        </div>
      </div>
    </div>
  );
}

// ─── Visitors Bar Card ───────────────────────────────────────────────────────
function VisitorsBarCard() {
  const labels = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  const values = [58, 42, 74, 61, 69, 65, 87, 57, 25, 18, 13, 11];
  const accentIdx = 6;

  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const dark = document.documentElement.classList.contains("dark");
        setIsDark(dark);
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue("--accent").trim();
        if (acc) setAccentColor(acc);
      };

      updateColors();

      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"]
      });

      return () => observer.disconnect();
    }
  }, []);

  const normalBarColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(148, 163, 184, 0.2)";
  const highlightedBarColor = accentColor;
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.12)";
  const tickColor = isDark ? "#94a3b8" : "#64748b";

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: values.map((_, i) =>
          i === accentIdx ? highlightedBarColor : normalBarColor
        ),
        borderRadius: 8,
        borderSkipped: false as const,
      },
    ],
  };

  const options: any = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${c.raw} visitors` } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
      y: { grid: { color: gridColor }, border: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
    },
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Live Visitors
        </p>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#ef4444",
            background: "rgba(239,68,68,0.1)",
            borderRadius: "999px",
            padding: "2px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          Live
        </span>
      </div>
      <div style={{ height: "140px" }}>
        <Bar data={data} options={options} />
      </div>
      <div
        style={{
          background: "rgba(16,185,129,0.1)",
          color: "#10b981",
          fontWeight: 600,
          fontSize: "12px",
          borderRadius: "10px",
          padding: "8px 12px",
        }}
      >
        🎉 You've just hit a new record today!
      </div>
    </div>
  );
}

// ─── Country Bars Card ───────────────────────────────────────────────────────
const countries = [
  { name: "United States", pct: 85, val: 1790 },
  { name: "India",         pct: 57, val: 1200 },
  { name: "Indonesia",     pct: 71, val: 1489, accent: true },
  { name: "Russia",        pct: 52, val: 1105 },
  { name: "China",         pct: 23, val: 490 },
  { name: "Bangladesh",    pct: 32, val: 689 },
  { name: "Canada",        pct: 31, val: 689 },
  { name: "Australia",     pct: 20, val: 420 },
];

function CountryBarsCard() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>72 Countries</p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0" }}>7,108 total sales</p>
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Last 7 days</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {countries.map((c) => (
          <div key={c.name} style={{ display: "grid", gridTemplateColumns: "100px 1fr 44px", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.name}
            </span>
            <div style={{ height: "8px", background: "var(--border-subtle)", borderRadius: "999px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${c.pct}%`,
                  borderRadius: "inherit",
                  background: c.accent
                    ? "linear-gradient(90deg, #f59e0b, #fb7185)"
                    : "linear-gradient(90deg, var(--accent), #60a5fa)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <strong style={{ fontSize: "12px", color: "var(--text-primary)", textAlign: "right" }}>
              <CountUp end={c.val} />
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sales History Card ──────────────────────────────────────────────────────
const recentSales = [
  { initial: "A", name: "Alphie Turner",  loc: "Australia",     amt: "$39.92",  color: "#8b5cf6", highlight: false },
  { initial: "B", name: "Bella Porch",    loc: "United States", amt: "$199.99", color: "#f59e0b", highlight: true  },
  { initial: "C", name: "Cindrella",      loc: "Canada",        amt: "$30.00",  color: "#ec4899", highlight: false },
  { initial: "D", name: "David Johnson",  loc: "United States", amt: "$49.99",  color: "#3b82f6", highlight: false },
  { initial: "P", name: "Peter Parker",   loc: "United States", amt: "$49.99",  color: "#9ca3af", highlight: false },
];

function SalesHistoryCard() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Sales History</p>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Recent</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {recentSales.map((s) => (
          <div key={s.name} style={{ display: "grid", gridTemplateColumns: "38px 1fr auto", gap: "10px", alignItems: "center" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "12px",
                background: s.color,
                color: "white",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              {s.initial}
            </div>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{s.name}</p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{s.loc}</p>
            </div>
            <strong style={{ fontSize: "13px", color: s.highlight ? "var(--accent)" : "var(--text-primary)" }}>
              <CountUp end={parseFloat(s.amt.replace(/[^0-9.]/g, ''))} prefix={s.amt.charAt(0)} decimals={2} />
            </strong>
          </div>
        ))}
      </div>
      <a
        href="#"
        style={{ color: "var(--accent)", fontWeight: 600, fontSize: "12px", textDecoration: "none", marginTop: "4px" }}
      >
        ↓ Download report
      </a>
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
  const [activeConsoleTab,  setActiveConsoleTab]  = useState<"inbound" | "outbound" | "pending">("inbound");

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
      subtitle="Sales, visitors, pipeline and real-time activity in one compact view"
      action={
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input-field py-2 text-xs h-9"
          >
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

      {/* ── 2. Charts Row: Sales Line | Visit Summary | Visitors Bar ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: "14px",
          marginTop: "14px",
        }}
      >
        <SalesLineCard formatCurrency={formatCurrency} />
        <VisitSummaryCard dashboardData={dashboardData} />
        <VisitorsBarCard />
      </div>

      {/* ── 3. Bottom Row: Countries | Pipeline Distribution | Sales History ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1.6fr 1fr",
          gap: "14px",
          marginTop: "14px",
        }}
      >
        <CountryBarsCard />
        <PipelinePieChart funnel={salesData?.funnel || []} />
        <SalesHistoryCard />
      </div>

      {/* ── 4. Customer Score Trend & Recent Leads ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" style={{ marginTop: "14px" }}>
        <div className="xl:col-span-1 h-full">
          <CustomerScoreTrendChart scoreTrend={salesData?.customerScoreTrend || []} />
        </div>
        <div className="xl:col-span-2 h-full">
          <RecentLeadsTableWidget recentLeads={dashboardData?.recentLeads || []} />
        </div>
      </div>

      {/* ── 5. Action Required ── */}
      <div className="grid grid-cols-1" style={{ marginTop: "14px" }}>
        <div className="h-full">
          <ActionRequiredWidget followUps={dashboardData?.overdueFollowUps || []} />
        </div>
      </div>

      {/* ── 6. Visit & Approvals Center ── */}
      <div className="crm-card p-6 flex flex-col" style={{ marginTop: "14px" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2">
              <CalendarCheck size={18} className="text-slate-400" />
              Visit &amp; Approvals Center
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
              Real-time check-ins and queues
            </p>
          </div>

          <div className="flex bg-surface-2 p-1 rounded-xl border border-theme">
            <button
              onClick={() => setActiveConsoleTab("inbound")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeConsoleTab === "inbound" ? "bg-surface text-theme-primary shadow-sm border border-theme" : "text-theme-secondary hover:text-theme-primary"}`}
            >
              Inbound
              {!loading && (
                <span className="bg-surface-offset text-theme-secondary px-1.5 py-0.5 rounded text-[10px] leading-none">
                  {dashboardData?.inboundVisits?.filter((v: any) => v.status === "CHECKED_IN").length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveConsoleTab("outbound")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeConsoleTab === "outbound" ? "bg-surface text-theme-primary shadow-sm border border-theme" : "text-theme-secondary hover:text-theme-primary"}`}
            >
              Outbound
              {!loading && (
                <span className="bg-surface-offset text-theme-secondary px-1.5 py-0.5 rounded text-[10px] leading-none">
                  {dashboardData?.outboundVisits?.filter((v: any) => v.status === "CHECKED_IN").length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveConsoleTab("pending")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeConsoleTab === "pending" ? "bg-surface text-theme-primary shadow-sm border border-theme" : "text-theme-secondary hover:text-theme-primary"}`}
            >
              Approvals
              {!loading && dashboardData?.pendingApprovals?.length > 0 && (
                <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] leading-none">
                  {dashboardData?.pendingApprovals?.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeConsoleTab === "inbound" && (
            <table className="crm-table">
              <thead>
                <tr className="crm-tr">
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Purpose</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th">Visit Started</th>
                  <th className="crm-th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading walk-ins...</td></tr>
                ) : !dashboardData?.inboundVisits?.length ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 font-bold">No inbound walk-in visitors today</td></tr>
                ) : dashboardData.inboundVisits.map((v: any) => (
                  <tr key={v.id} className="crm-tr">
                    <td className="crm-td">
                      <p className="font-bold text-theme-primary">{v.customer?.name ?? v.customerName}</p>
                    </td>
                    <td className="crm-td text-theme-secondary">{v.purpose}</td>
                    <td className="crm-td">
                      <span className={`badge-${v.status === "CHECKED_IN" ? "amber" : "emerald"}`}>
                        {v.status === "CHECKED_IN" ? "Active" : "Completed"}
                      </span>
                    </td>
                    <td className="crm-td text-theme-secondary font-medium">
                      {new Date(v.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="crm-td text-right">
                      {v.status === "CHECKED_IN" ? (
                        <button
                          onClick={() => handleOpenCheckout(v, "Inbound")}
                          className="btn-primary text-xs py-1.5 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                        >
                          End Visit
                        </button>
                      ) : (
                        <span className="text-slate-400 font-bold text-xs">Ended</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeConsoleTab === "outbound" && (
            <table className="crm-table">
              <thead>
                <tr className="crm-tr">
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Purpose</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th">Checked In</th>
                  <th className="crm-th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading field visits...</td></tr>
                ) : !dashboardData?.outboundVisits?.length ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 font-bold">No field visits logged today</td></tr>
                ) : dashboardData.outboundVisits.map((v: any) => (
                  <tr key={v.id} className="crm-tr">
                    <td className="crm-td font-bold text-theme-primary">{v.customer?.name ?? v.customerName}</td>
                    <td className="crm-td text-theme-secondary">{v.purpose || "Field Visit"}</td>
                    <td className="crm-td">
                      <span className={`badge-${v.status === "CHECKED_IN" ? "blue" : "emerald"}`}>
                        {v.status === "CHECKED_IN" ? "Onsite" : "Completed"}
                      </span>
                    </td>
                    <td className="crm-td text-theme-secondary font-medium">
                      {new Date(v.checkIn || v.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="crm-td text-right">
                      {v.status === "CHECKED_IN" ? (
                        <button
                          onClick={() => handleOpenCheckout(v, "Outbound")}
                          className="btn-primary text-xs py-1.5 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                        >
                          Check-Out
                        </button>
                      ) : (
                        <span className="text-slate-400 font-bold text-xs">Checked out</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeConsoleTab === "pending" && (
            <table className="crm-table">
              <thead>
                <tr className="crm-tr">
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Visit Type</th>
                  <th className="crm-th">Purpose</th>
                  <th className="crm-th">Submitted By</th>
                  <th className="crm-th text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading approval queue...</td></tr>
                ) : !dashboardData?.pendingApprovals?.length ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 font-bold">No visits awaiting approval</td></tr>
                ) : dashboardData.pendingApprovals.map((v: any) => (
                  <tr key={v.id} className="crm-tr">
                    <td className="crm-td font-bold text-theme-primary">{v.customerName}</td>
                    <td className="crm-td">
                      <span className={`badge-${v.visitType === "Inbound" ? "amber" : "blue"}`}>
                        {v.visitType}
                      </span>
                    </td>
                    <td className="crm-td text-theme-secondary">{v.purpose}</td>
                    <td className="crm-td text-theme-secondary">{v.submittedBy}</td>
                    <td className="crm-td text-right">
                      <span className={`badge-${v.priority === "Urgent" ? "red" : v.priority === "High" ? "amber" : "slate"}`}>
                        {v.priority || "Normal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
