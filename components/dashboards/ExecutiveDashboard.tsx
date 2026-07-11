"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { 
  Users, PhoneCall, CheckCircle2, XCircle, Clock, CalendarCheck, AlertCircle, Building, MapPin, ChevronRight, Mail, Map, Navigation, Briefcase, TrendingUp, IndianRupee
} from "lucide-react";

import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import { SalesFunnelChart, RevenueTrendChart, LeadSourcesTable, AgentLeaderboard, WorkspaceOverviewLineChart, SalesPipelineWidget, RecentLeadsTableWidget } from "./SalesWidgets";

export default function ExecutiveDashboard({ dashboardData: data, salesData, user, loadData, dateRange, setDateRange }: any) {
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
  const followUpCount = followUps.length;

  // Block new check-in if user already has an active visit
  const activeVisit = todayVisits.find(v => v.status === "CHECKED_IN");
  const hasActiveVisit = !!activeVisit;

  return (
    <PageShell 
      title="Executive Overview" 
      subtitle={`Welcome back, ${user?.name}. Today you have ${todayVisits.length} visits and ${followUpCount} key follow-ups.`}
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
          </div>
        )
      }
    >
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <SummaryCard
          label="Total Leads"
          value={salesData?.kpis?.totalLeads || 0}
          icon={<Users size={18} />}
          variant="light"
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
          icon={<IndianRupee size={18} />} 
          variant="light" 
          trend={{ value: "-1.5%", up: false }}
          subtitle="Pipeline dropping"
        />
        <SummaryCard 
          label="Pending Follow-ups" 
          value={data?.stats?.followUpMetrics?.pending || 0} 
          icon={<Clock size={18} />} 
          variant="light"
          accentWhenPositive
          trend={{ value: "Overdue", up: false }}
          subtitle="Needs attention"
        />
      </div>

        {/* ── 2. Top Charts & Alerts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Left Side: Workspace Overview */}
        <div className="xl:col-span-2">
          <RevenueTrendChart revenueTrend={salesData?.revenueTrend || []} />
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
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

      {/* ── 4. Itinerary & Timeline Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Itinerary */}
        <div className="xl:col-span-2">
          <div className="crm-card p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-theme-primary">Today's Itinerary</h3>
              <span className="text-xs font-bold text-[var(--primary)] hover:text-[#C94F4F] cursor-pointer flex items-center gap-1">
                <Map className="w-3.5 h-3.5" /> View Map
              </span>
            </div>
            
            <div className="space-y-4">
              {todayVisits.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-medium text-sm">
                  No visits scheduled or logged today.
                </div>
              ) : (
                todayVisits.map((v: any) => {
                  const isCheckedIn = v.status === "CHECKED_IN";
                  const dateObj = new Date(v.checkIn || v.checkInTime);
                  
                  return (
                    <div key={v.id} className={`bg-surface-2 rounded-2xl border ${isCheckedIn ? 'border-amber-400/60 shadow-md' : 'border-theme-subtle shadow-sm'} overflow-hidden transition-all`}>
                      <div className="p-4 flex items-center gap-4">
                        <div className="bg-surface rounded-xl p-3 flex flex-col items-center justify-center shrink-0 w-16 h-16 text-center">
                          <span className="text-[13px] font-black text-theme-primary leading-tight">
                            {dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).replace(" AM", "").replace(" PM", "")}
                          </span>
                          <span className="text-[9px] font-bold text-theme-secondary uppercase mt-0.5">
                            {dateObj.getHours() >= 12 ? "PM" : "AM"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-theme-primary truncate">{v.customer?.name || v.customerName}</h3>
                          <p className="text-xs text-theme-secondary mt-1 truncate">{v.purpose || "Field Visit"}</p>
                          <div className="flex gap-2 mt-2">
                            {v.priority && v.priority !== "Normal" && (
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-full text-[9px] font-bold uppercase">{v.priority}</span>
                            )}
                            <span className="px-2 py-0.5 bg-surface text-theme-secondary rounded-full text-[9px] font-bold uppercase">{v.type}</span>
                            {isCheckedIn ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 rounded-full text-[9px] font-bold uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full text-[9px] font-bold uppercase">
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="crm-card p-6 h-full">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6">Activity Timeline</h3>
            <div className="relative pl-3 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:w-px before:bg-slate-200 dark:before:bg-slate-800">
              {todayVisits.slice(0, 3).map((v: any, i: number) => (
                <div key={i} className="relative flex items-start group">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-white dark:border-slate-900 text-slate-500 group-hover:bg-emerald-500 group-hover:text-emerald-50 shadow shrink-0 z-10 -translate-x-[11px] transition-colors">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div className="flex-1 -mt-1 min-w-0 pl-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{v.status === "CHECKED_IN" ? "Checked In" : "Completed"} {v.type}</p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {new Date(v.checkIn || v.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">at {v.customer?.name}</p>
                  </div>
                </div>
              ))}
              {todayVisits.length === 0 && (
                <p className="text-xs text-slate-400 pl-4 py-2">No activity recorded today.</p>
              )}
            </div>
          </div>
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
