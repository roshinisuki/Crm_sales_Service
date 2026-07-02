"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { 
  Users, PhoneCall, CheckCircle2, XCircle, Clock, CalendarCheck, AlertCircle, Building, MapPin, ChevronRight, Mail, Briefcase, TrendingUp, DollarSign
} from "lucide-react";

import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import { SalesFunnelChart, RevenueTrendChart, LeadSourcesTable, AgentLeaderboard, WorkspaceOverviewLineChart, SalesPipelineWidget, RecentLeadsTableWidget } from "./SalesWidgets";

export default function LeadDashboard({ dashboardData: data, salesData, user, loadData, dateRange, setDateRange }: any) {
  const { formatCurrency } = useCurrency();
  // Modal States
  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
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

  const todayVisits = [
    ...(data?.inboundVisits || []).map((v: any) => ({ ...v, type: "Inbound" as const })),
    ...(data?.outboundVisits || []).map((v: any) => ({ ...v, type: "Outbound" as const }))
  ].sort((a, b) => new Date(b.checkIn || b.checkInTime).getTime() - new Date(a.checkIn || a.checkInTime).getTime());

  const followUps = [...(data?.overdueFollowUps || []), ...(data?.upcomingFollowUps || [])];

  const pendingCount = data?.pendingApprovals?.length || 0;

  // Block new check-in if user already has an active visit
  const activeVisit = todayVisits.find(v => v.status === "CHECKED_IN");
  const hasActiveVisit = !!activeVisit;

  return (
    <PageShell 
      title="Lead Overview" 
      subtitle={`Welcome back, ${user?.name}. Your team has ${todayVisits.length} visits today.`}
      action={
        hasActiveVisit ? (
          <div className="px-5 py-2.5 bg-amber-500/10 border border-amber-400/40 rounded-xl text-amber-600 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Active visit in progress — check out first
          </div>
        ) : (
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
            <button onClick={() => setIsInboundOpen(true)} className="btn-secondary h-9 text-xs hidden sm:flex">
              <Building className="w-3.5 h-3.5" /> + Office Visit
            </button>
            <button onClick={() => setIsOutboundOpen(true)} className="btn-primary h-9 text-xs bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white hidden sm:flex">
              <MapPin className="w-3.5 h-3.5" /> + Field Check-In
            </button>
          </div>
        )
      }
    >
      {/* ── MOBILE QUICK ACTIONS ── */}
      {!hasActiveVisit && (
        <div className="sm:hidden grid grid-cols-2 gap-4 mb-6">
          <button 
            onClick={() => setIsInboundOpen(true)}
            className="flex flex-col items-center justify-center bg-[#1A1A1A] text-white p-4 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <Building className="w-5 h-5 mb-2 text-[var(--primary)]" />
            <span className="text-xs font-bold">+ Office Visit</span>
          </button>
          <button 
            onClick={() => setIsOutboundOpen(true)}
            className="flex flex-col items-center justify-center bg-[#1A1A1A] text-white p-4 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <MapPin className="w-5 h-5 mb-2 text-[var(--primary)]" />
            <span className="text-xs font-bold">+ Field Check-In</span>
          </button>
        </div>
      )}

      {/* ── MOBILE ACTIVE VISITS (with Check-Out) ── */}
      {hasActiveVisit && (
        <div className="md:hidden mb-6">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
              <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Active visit in progress</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">{activeVisit?.customer?.name || activeVisit?.customerName}</p>
              <p className="text-xs text-slate-600 mt-0.5">{activeVisit?.purpose}</p>
            </div>
            <button
              onClick={() => handleOpenCheckout(activeVisit, activeVisit.type)}
              className="w-full btn-primary bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Check-Out Now
            </button>
          </div>
        </div>
      )}

      {/* ── 1. KPI Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Total Leads" 
          value={salesData?.kpis?.totalLeads || 0} 
          icon={<Users size={18} />} 
          variant="brand" 
          trend={{ value: "+12.4%", up: true }}
          subtitle="vs last month"
        />
        <SummaryCard 
          label="Conversion Rate" 
          value={`${salesData?.kpis?.conversionRate || 0}%`} 
          icon={<TrendingUp size={18} />} 
          variant="dark" 
          trend={{ value: "+3.2%", up: true }}
          subtitle="Higher than avg"
        />
        <SummaryCard 
          label="Revenue" 
          value={salesData?.kpis?.pipelineRevenue ? formatCurrency(salesData.kpis.pipelineRevenue) : formatCurrency(0)} 
          icon={<DollarSign size={18} />} 
          variant="light" 
          trend={{ value: "-1.5%", up: false }}
          subtitle="Pipeline dropping"
        />
        <SummaryCard 
          label="Pending Follow-ups" 
          value={data?.stats?.followUpMetrics?.pending || 0} 
          icon={<Clock size={18} />} 
          variant="red" 
          trend={{ value: "Overdue", up: false }}
          subtitle="Needs attention"
        />
      </div>


      {/* ── 2. Top Charts & Alerts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Workspace Overview */}
        <div className="xl:col-span-2">
          <WorkspaceOverviewLineChart 
            activeLeads={salesData?.kpis?.totalLeads || 0} 
            visits={data?.stats?.monthlyVisits || 0} 
            subscriptions={data?.stats?.activeSubs || 0} 
          />
        </div>

        {/* Right Side: Alerts */}
        <div className="flex flex-col">
          <div className="crm-card p-6 border border-slate-100 flex flex-col h-full justify-between min-h-[320px]">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Pending Follow-ups</h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {followUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-6 text-center text-slate-400">
                  <CheckCircle2 size={32} className="mb-2 text-emerald-400" />
                  <p className="text-xs font-bold text-slate-500">All caught up!</p>
                </div>
              ) : (
                followUps.slice(0, 4).map((f: any) => {
                  const isOverdue = f.nextMeetingDate ? new Date(f.nextMeetingDate) < new Date() : false;
                  return (
                    <div key={f.id} className="p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/30 cursor-pointer">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'}`}>
                        {f.followUpType === "Call" ? <PhoneCall className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{f.followUpType} {f.customer?.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{f.remarks || "No additional notes"}</p>
                        {isOverdue && <p className="text-[10px] text-red-500 font-bold mt-1">Overdue</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  );
                })
              )}
            </div>
            {followUps.length > 4 && (
              <a href="/follow-up" className="btn-secondary mt-4 w-full justify-center">
                See All Follow-ups
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Table & Pipeline Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Recent Leads */}
        <div className="xl:col-span-2">
          <RecentLeadsTableWidget recentLeads={data?.recentLeads || []} />
        </div>

        {/* Right Side: Sales Pipeline */}
        <div>
          <SalesPipelineWidget 
            activeLeads={salesData?.kpis?.totalLeads || 0} 
            visits={data?.stats?.monthlyVisits || 0} 
            subscriptions={data?.stats?.activeSubs || 0} 
            funnel={salesData?.funnel || []}
          />
        </div>
      </div>

      {/* ── 4. Approvals, Leaderboard & Sources Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Approvals Banner + Sources Table */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Approvals (Lead Only) */}
          {pendingCount > 0 && (
            <div className="bg-red-50 dark:bg-red-950/10 rounded-2xl border border-red-200/60 dark:border-red-900/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
              <div>
                <h3 className="text-red-800 dark:text-red-400 font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#C94F4F]" />
                  Action Required
                </h3>
                <p className="text-[var(--primary)]/80 dark:text-[#FCA5A5]/80 text-sm mt-1">You have {pendingCount} visit record{pendingCount > 1 ? 's' : ''} awaiting your approval.</p>
              </div>
              <button className="btn-primary bg-[var(--primary)] hover:bg-[var(--primary-hover)]">
                Review Approvals
              </button>
            </div>
          )}

          {/* Lead Sources Analytics */}
          {salesData?.leadSources && <LeadSourcesTable leadSources={salesData.leadSources} />}
        </div>

        {/* Right Side: Leaderboard */}
        <div>
          {salesData?.agentPerformance && <AgentLeaderboard agentPerformance={salesData.agentPerformance} />}
        </div>
      </div>

      {/* ── 4. Bottom Table Area (Recent Office Visits) ── */}
      <div className="crm-card p-6 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2">
              <CalendarCheck size={18} className="text-slate-400" />
              Recent Office Visits
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Team check-ins and field logs</p>
          </div>
          <a href="/visitor-management" className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline">View All</a>
        </div>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-[var(--border)]">
                <th className="crm-th">Company / Contact</th>
                <th className="crm-th">Date</th>
                <th className="crm-th">Status</th>
                <th className="crm-th text-right">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
              {!todayVisits?.length ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400 font-medium">No recent visits</td></tr>
              ) : todayVisits.slice(0, 5).map((v: any) => (
                <tr key={v.id} className="crm-tr">
                  <td className="crm-td flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-xs font-bold text-theme-secondary shrink-0">
                      {(v.customer?.name || "UN").substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-theme-primary">{v.customer?.name ?? v.customerName}</p>
                      <p className="text-xs text-theme-secondary">{v.purpose}</p>
                    </div>
                  </td>
                  <td className="crm-td text-theme-secondary font-medium">
                    {new Date(v.checkIn || v.checkInTime).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="crm-td">
                    <span className={`badge-${v.status === "CHECKED_IN" ? "amber" : "emerald"}`}>
                      {v.status === "CHECKED_IN" ? "IN PROGRESS" : "COMPLETED"}
                    </span>
                  </td>
                  <td className="crm-td text-right font-medium text-theme-secondary">
                    {v.host?.name || v.executive?.name || "You"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Check-In & Check-Out Modal Instances ── */}
      <InboundCheckInModal isOpen={isInboundOpen} onClose={() => setIsInboundOpen(false)} onSuccess={loadData} loggedInUser={user ? { name: user.name, id: user.id } : null} />
      <OutboundCheckInModal isOpen={isOutboundOpen} onClose={() => setIsOutboundOpen(false)} onSuccess={loadData} loggedInUser={user ? { name: user.name, id: user.id } : null} />
      <CheckOutModal
        isOpen={isCheckoutOpen}
        onClose={() => { setIsCheckoutOpen(false); setActiveCheckoutVisit(null); }}
        onSuccess={loadData}
        onCheckInNext={(type) => {
          setIsCheckoutOpen(false);
          setActiveCheckoutVisit(null);
          if (type === "Inbound") setIsInboundOpen(true);
          else setIsOutboundOpen(true);
        }}
        visit={activeCheckoutVisit}
      />
    </PageShell>
  );
}
