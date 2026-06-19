"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  arrow: "M14 5l7 7m0 0l-7 7m7-7H3",
  trend: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
};

const activityIcons: Record<string, string> = {
  Call: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  Meeting: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  Email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  WhatsApp: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  Note: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  Visit: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === "SalesExecutive") {
      router.push("/dashboard");
      return;
    }
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard/manager");
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageContainer className="p-6"><p className="text-slate-400">Loading dashboard...</p></PageContainer>;
  if (!data) return <PageContainer className="p-6"><p className="text-slate-400">Failed to load dashboard</p></PageContainer>;

  const { kpis, pipelineByStage, teamPerformance, recentActivity, funnel } = data;

  return (
    <PageContainer className="space-y-6 p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales Manager Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview for {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>

      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="Total Leads" value={kpis.totalLeads} color="text-blue-600" />
        <KPICard label="Leads → Customer" value={kpis.leadsToCustomer} color="text-purple-600" />
        <KPICard label="Conversion %" value={`${kpis.conversionPercent}%`} color="text-green-600" />
        <KPICard label="Total RFQs" value={kpis.totalRFQs} color="text-orange-600" />
        <KPICard label="Quotations Sent" value={kpis.quotationsSent} color="text-cyan-600" />
        <KPICard label="Quotations Accepted" value={kpis.quotationsAccepted} color="text-emerald-600" />
        <KPICard label={`Revenue Won (${preferredCurrency})`} value={formatCurrency(kpis.revenueWon || 0)} color="text-[#D44D4D]" />
      </div>

      {/* Row 2 — Pipeline by Stage */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-800 mb-4">Pipeline by Stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {pipelineByStage.length === 0 ? (
            <p className="text-sm text-slate-400 col-span-full">No pipeline stages configured</p>
          ) : (
            pipelineByStage.map((stage: any) => (
              <button
                key={stage.id}
                onClick={() => router.push(`/pipeline?stage=${encodeURIComponent(stage.name)}`)}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{stage.dealCount}</p>
                <p className="text-xs text-slate-500 mt-1">{formatCurrency(stage.totalValue || 0)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Row 3 — Team Performance */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><h2 className="text-base font-bold text-slate-800">Team Performance</h2></div>
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Sales Executive</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Leads Assigned</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Visits Done</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Follow-Ups Done</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Deals Won</th>
          </tr></thead>
          <tbody>
            {teamPerformance.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-slate-400">No sales executives found</td></tr>
            ) : (
              teamPerformance.map((exec: any) => (
                <tr key={exec.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{exec.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">{exec.leadsAssigned}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">{exec.visitsDone}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">{exec.followUpsDone}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{exec.dealsWon}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row 4 — Recent Activity */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-800 mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity</p>
          ) : (
            recentActivity.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-slate-500"><path d={activityIcons[item.type] || activityIcons.Note} /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{item.description}</p>
                  <p className="text-xs text-slate-400">{item.actor} · {timeAgo(item.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Row 5 — RFQ to PO Funnel */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-800 mb-4">RFQ to PO Funnel</h2>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <FunnelStep label="RFQs Received" value={funnel.rfqsReceived} />
          <Ico d={icons.arrow} size={24} className="text-slate-300" />
          <FunnelStep label="Quotations Created" value={funnel.quotationsCreated} />
          <Ico d={icons.arrow} size={24} className="text-slate-300" />
          <FunnelStep label="Quotations Accepted" value={funnel.quotationsAccepted} />
          <Ico d={icons.arrow} size={24} className="text-slate-300" />
          <FunnelStep label="POs" value="—" muted />
        </div>
      </div>
    </PageContainer>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function FunnelStep({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className={`text-center px-6 py-4 rounded-xl border-2 ${muted ? "border-dashed border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-2xl font-bold ${muted ? "text-slate-400" : "text-slate-800"}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
