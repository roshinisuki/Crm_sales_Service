"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Users, PhoneCall, CheckCircle2, XCircle, Clock, CalendarCheck, Briefcase, TrendingUp, DollarSign } from "lucide-react";

// Modals
import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import { PipelinePieChart, CustomerScoreTrendChart, RecentLeadsTableWidget, ActionRequiredWidget } from "./SalesWidgets";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ""}`} />;
}

export default function AdminDashboard({ dashboardData, salesData, user, loadData, dateRange, setDateRange }: any) {
  const loading = !dashboardData;
  const { formatCurrency } = useCurrency();

  // Modal Open States
  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<any>(null);

  // Active Tab for Left Console Table
  const [activeConsoleTab, setActiveConsoleTab] = useState<"inbound" | "outbound" | "pending">("inbound");

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

  const activeSubsVal = dashboardData?.stats?.activeSubs || 0;
  const pendingPlansVal = dashboardData?.stats?.pendingPlans || 0;
  const expiredPlansVal = dashboardData?.stats?.expiredPlans || 0;
  const totalPlansVal = activeSubsVal + pendingPlansVal + expiredPlansVal || 0;

  return (
    <PageShell 
      title="Dashboard" 
      subtitle="Workspace Overview and Real-time Metrics"
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
          value={dashboardData?.stats?.followUpMetrics?.pending || 0} 
          icon={<Clock size={18} />} 
          variant="red" 
          trend={{ value: "Overdue", up: false }}
          subtitle="Needs attention"
        />
      </div>

      {/* ── 2. Pipeline Distribution (Pie) & Action Required ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 h-full">
          <PipelinePieChart funnel={salesData?.funnel || []} />
        </div>
        <div className="xl:col-span-1 h-full">
          <ActionRequiredWidget followUps={dashboardData?.overdueFollowUps || []} />
        </div>
      </div>

      {/* ── 3. Customer Score Trend & Recent Leads ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 h-full">
          <CustomerScoreTrendChart scoreTrend={salesData?.customerScoreTrend || []} />
        </div>
        <div className="xl:col-span-2 h-full">
          <RecentLeadsTableWidget recentLeads={dashboardData?.recentLeads || []} />
        </div>
      </div>

      {/* ── 4. Bottom Table Area (Visit & Approvals Center) ── */}
      <div className="crm-card p-6 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2">
              <CalendarCheck size={18} className="text-slate-400" />
              Visit & Approvals Center
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Real-time check-ins and queues</p>
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

      {/* ── Check-In & Check-Out Modal Instances ── */}
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
