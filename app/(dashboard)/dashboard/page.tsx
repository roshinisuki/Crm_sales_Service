"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getDashboardDataAction } from "@/app/actions/visits";

// Modals
import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";

const icons = {
  trending: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  users: <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  building: <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  tag: <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  lightning: <svg className="w-5 h-5 text-[#EC4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ""}`} />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Modal Open States
  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<any>(null);

  // Active Tab for Left Console Table
  const [activeConsoleTab, setActiveConsoleTab] = useState<"inbound" | "outbound" | "pending">("inbound");

  // Stacked chart toggle
  const [chartToggle, setChartToggle] = useState<"monthly" | "weekly">("monthly");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDashboardDataAction();
      if (res.success && res.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCheckout = (visitItem: any, type: "Inbound" | "Outbound") => {
    setActiveCheckoutVisit({
      id: visitItem.id,
      customerId: visitItem.customerId,
      customerName: visitItem.customer?.name || "Unknown",
      customerCode: visitItem.customer?.customerCode || "—",
      visitType: type,
      purpose: visitItem.purpose || "Meeting",
      checkInTime: visitItem.checkInTime || visitItem.checkIn,
    });
    setIsCheckoutOpen(true);
  };

  // Dynamic Metrics computed
  const inProgressInbound = dashboardData?.inboundVisits?.filter((v: any) => v.status === "CHECKED_IN") || [];
  const inProgressOutbound = dashboardData?.outboundVisits?.filter((v: any) => v.status === "CHECKED_IN") || [];
  const totalLiveVisitors = inProgressInbound.length + inProgressOutbound.length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* ── 1. Top Performance Banner (Marketing Engagement Overview) ── */}
      <div className="relative bg-gradient-to-br from-[#0B1528] to-[#122442] rounded-3xl p-6 lg:p-8 border border-[#1e3458] shadow-2xl overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Glow Highlights */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl -z-10" />

        {/* Text Area */}
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.05] text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">
            {icons.trending}
            Performance Overview
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-none">
              Marketing Engagement Overview
            </h1>
            <p className="text-xs lg:text-sm text-slate-400 max-w-xl font-medium leading-relaxed">
              Real-time breakdown of your global marketing reach and active engagement metrics for the current billing cycle.
            </p>
          </div>

          {/* Banner Horizontal KPIs */}
          <div className="pt-4 grid grid-cols-3 gap-4 lg:gap-8 max-w-lg border-t border-white/[0.08]">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Engagement</p>
              {loading ? <Skeleton className="h-6 w-16 bg-white/10" /> : <p className="text-xl lg:text-2xl font-black text-[#5C8FFF]">{dashboardData?.stats?.activeEngagement}%</p>}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Visits Month</p>
              {loading ? <Skeleton className="h-6 w-16 bg-white/10" /> : <p className="text-xl lg:text-2xl font-black text-white">{dashboardData?.stats?.monthlyVisits?.toLocaleString("en-IN")}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Subs</p>
              {loading ? <Skeleton className="h-6 w-16 bg-white/10" /> : <p className="text-xl lg:text-2xl font-black text-white">{dashboardData?.stats?.activeSubs?.toLocaleString("en-IN")}</p>}
            </div>
          </div>
        </div>

        {/* Vertical Glowing Bar Chart */}
        <div className="flex items-end justify-end gap-1.5 md:w-[220px] h-28 shrink-0">
          {[
            { h: "40%", glow: false },
            { h: "55%", glow: false },
            { h: "75%", glow: true }, // glowing bar
            { h: "50%", glow: false },
            { h: "82%", glow: false },
            { h: "45%", glow: false },
          ].map((bar, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 w-7 h-full justify-end">
              <div 
                className={`w-full rounded-t-md transition-all duration-300 ${bar.glow ? "bg-gradient-to-t from-blue-600 to-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.6)]" : "bg-[#1E2E4A] hover:bg-[#283C5C]"}`} 
                style={{ height: bar.h }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Top-Level Alerts / Banners (Active Visits Checked-In Today) ── */}
      {(inProgressInbound.length > 0 || inProgressOutbound.length > 0) && (
        <div className="space-y-2">
          {inProgressInbound.map((v: any) => (
            <div key={v.id} className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                </span>
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Inbound Visitor Checked In:</span>{" "}
                  <strong className="text-amber-700">{v.customer?.name}</strong> arrived for a <span className="font-semibold">{v.purpose}</span>. Hosted by {v.host?.name || "you"}.
                </div>
              </div>
              <button
                onClick={() => handleOpenCheckout(v, "Inbound")}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shrink-0 transition-all shadow-sm"
              >
                Checkout Visitor
              </button>
            </div>
          ))}

          {inProgressOutbound.map((v: any) => (
            <div key={v.id} className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                </span>
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Outbound Field Onsite Check-In:</span>{" "}
                  <strong className="text-indigo-700">{v.customer?.name}</strong> field meeting in progress for <span className="font-semibold">{v.purpose}</span>.
                </div>
              </div>
              <button
                onClick={() => handleOpenCheckout(v, "Outbound")}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shrink-0 transition-all shadow-sm"
              >
                Onsite Checkout
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 3. Main Multi-Column Workspace ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN (WIDE): Stacked Chart & Log Lists ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Visits vs. Engagement Stacked Bar Chart */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Marketing Visits vs. Engagement</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Traffic patterns for the last 30 days</p>
              </div>

              {/* Weekly/Monthly Toggle */}
              <div className="flex p-0.5 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setChartToggle("monthly")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${chartToggle === "monthly" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setChartToggle("weekly")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${chartToggle === "weekly" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Custom SVG/HTML Stacked Bar Chart */}
            <div className="flex items-end justify-between h-48 px-4 border-b border-slate-100 pb-2">
              {[
                { label: "12 Oct", val: 120, total: 180 },
                { label: "19 Oct", val: 155, total: 240 },
                { label: "26 Oct", val: 98, total: 150 },
                { label: "02 Nov", val: 188, total: 290 },
                { label: "09 Nov", val: 160, total: 260 },
              ].map((bar, idx) => {
                const activePct = (bar.val / 300) * 100;
                const totalPct = (bar.total / 300) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
                    <div className="w-full relative h-36 flex flex-col justify-end rounded-lg overflow-hidden bg-slate-100">
                      {/* Stack 2: Total Visits (light blue/lavender) */}
                      <div className="absolute bottom-0 w-full bg-[#C7D2FE] transition-all hover:bg-[#b5c2fb]" style={{ height: `${totalPct}%` }} />
                      {/* Stack 1: Active Engagement (dark indigo) */}
                      <div className="absolute bottom-0 w-full bg-[#4F46E5] transition-all hover:bg-[#3f36cc]" style={{ height: `${activePct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">{bar.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-center gap-6 text-[10px] font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#4F46E5]" />
                <span className="text-slate-500">Active Engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#C7D2FE]" />
                <span className="text-slate-500">Total Visits</span>
              </div>
            </div>
          </div>

          {/* Today's Visits & Approvals Dynamic Console */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Visit & Approvals Center</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time check-ins and customer queues</p>
              </div>
              
              {/* Table Tabs */}
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl shrink-0">
                <button
                  onClick={() => setActiveConsoleTab("inbound")}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${activeConsoleTab === "inbound" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Inbound (Walk-ins)
                </button>
                <button
                  onClick={() => setActiveConsoleTab("outbound")}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${activeConsoleTab === "outbound" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Outbound (Field)
                </button>
                <button
                  onClick={() => setActiveConsoleTab("pending")}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${activeConsoleTab === "pending" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Pending Approvals
                </button>
              </div>
            </div>

            {/* List Contents */}
            <div className="overflow-x-auto mt-4">
              {activeConsoleTab === "inbound" && (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Checked In</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading walk-ins...</td></tr>
                    ) : !dashboardData?.inboundVisits?.length ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-400">No inbound walk-in visitors today</td></tr>
                    ) : dashboardData.inboundVisits.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-800">{v.customer?.name}</td>
                        <td className="px-4 py-3.5 text-slate-500 font-semibold">{v.purpose}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-[9px] ${v.status === "CHECKED_IN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {v.status === "CHECKED_IN" ? "Active" : "Completed"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-600">
                          {new Date(v.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {v.status === "CHECKED_IN" ? (
                            <button
                              onClick={() => handleOpenCheckout(v, "Inbound")}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[10px]"
                            >
                              Check-Out
                            </button>
                          ) : (
                            <span className="text-slate-400 font-bold">Checked out</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeConsoleTab === "outbound" && (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Checked In</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading field visits...</td></tr>
                    ) : !dashboardData?.outboundVisits?.length ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-400">No field visits logged today</td></tr>
                    ) : dashboardData.outboundVisits.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-800">{v.customer?.name}</td>
                        <td className="px-4 py-3.5 text-slate-500 font-semibold">{v.purpose || "Field Visit"}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-[9px] ${v.status === "CHECKED_IN" ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {v.status === "CHECKED_IN" ? "Onsite" : "Completed"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-600">
                          {new Date(v.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {v.status === "CHECKED_IN" ? (
                            <button
                              onClick={() => handleOpenCheckout(v, "Outbound")}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[10px]"
                            >
                              Check-Out
                            </button>
                          ) : (
                            <span className="text-slate-400 font-bold">Checked out</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeConsoleTab === "pending" && (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading queue...</td></tr>
                    ) : !dashboardData?.pendingApprovals?.length ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-400">No customers waiting for approval decision</td></tr>
                    ) : dashboardData.pendingApprovals.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-800">{c.name}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-600">{c.customerCode}</td>
                        <td className="px-4 py-3.5 text-slate-500 font-medium">{c.email || "—"}</td>
                        <td className="px-4 py-3.5 text-slate-500 font-semibold">{c.city || "—"}</td>
                        <td className="px-6 py-3.5 text-right">
                          <a href="/decision-summary" className="px-3.5 py-1.5 bg-[#0D2137] text-white hover:bg-slate-800 rounded-xl font-bold text-[10px]">
                            Review Queue
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (SIDEBAR): KPI Cards, Overdues, Snapshot ── */}
        <div className="space-y-6">

          {/* 4 Mini KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Card 1: Team Members */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  {icons.users}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  +12%
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Team Members</p>
                {loading ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.teamCount}</p>}
              </div>
            </div>

            {/* Card 2: Accounts */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                  {icons.building}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  +8%
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Accounts</p>
                {loading ? <Skeleton className="h-5 w-14 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.totalCustomers?.toLocaleString("en-IN")}</p>}
              </div>
            </div>

            {/* Card 3: Live Subs */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  {icons.tag}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  +15%
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Live Subs</p>
                {loading ? <Skeleton className="h-5 w-14 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.activeSubs?.toLocaleString("en-IN")}</p>}
              </div>
            </div>

            {/* Card 4: Visits Today */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center">
                  {icons.lightning}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Today
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Visits Today</p>
                {loading ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.visitsToday}</p>}
              </div>
            </div>

            {/* Card 5: Inbound Checked-In */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  Live
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Inbound (Walk-ins)</p>
                {loading ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.inboundWalkIns ?? 0}</p>}
              </div>
            </div>

            {/* Card 6: Outbound Checked-Out */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between h-[120px] hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Completed
                </span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Outbound (Checkouts)</p>
                {loading ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-xl font-black text-slate-800 mt-0.5">{dashboardData?.stats?.outboundWalkIns ?? 0}</p>}
              </div>
            </div>
          </div>

          {/* Overdue Follow-ups */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Overdue Follow-ups</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">Next meeting dates missed</p>
              </div>
              <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                High Priority
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : !dashboardData?.overdueFollowUps?.length ? (
                <p className="text-xs text-slate-400 text-center py-4">Great! No overdue follow-ups</p>
              ) : (
                dashboardData.overdueFollowUps.slice(0, 3).map((f: any) => (
                  <div key={f.id} className="p-3 bg-slate-50/70 border-l-4 border-red-500 rounded-r-xl flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{f.remarks || "No Agenda notes added"}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Client: <strong className="text-slate-600">{f.customer?.name}</strong> (Overdue)
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Launch CRM Dialer Action Button */}
            <a href="/follow-up" className="w-full py-2.5 rounded-xl border border-blue-500/30 text-[#1a6bff] hover:bg-blue-50 font-extrabold text-[10px] uppercase tracking-wider text-center block transition-all shadow-xs">
              Launch CRM Dialer
            </a>
          </div>

          {/* Visitor Snapshot / Actions Card */}
          <div className="bg-[#4F46E5] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-[210px] relative overflow-hidden">
            
            {/* Visual soundwave design matching the mockup */}
            <div className="absolute bottom-4 right-4 flex items-end gap-1 w-16 h-12 justify-end opacity-40">
              {[60, 40, 80, 50, 95, 70].map((h, i) => (
                <div key={i} className="bg-white rounded-t-xs w-1.5 transition-all duration-300 animate-pulse" style={{ height: `${h}%` }} />
              ))}
            </div>

            <div>
              <p className="text-[10px] font-extrabold text-white/50 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Visitor Snapshot
              </p>
              <div className="mt-4">
                <p className="text-3xl font-black">{loading ? "—" : totalLiveVisitors}</p>
                <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mt-0.5">Current Live Visitors</p>
              </div>
            </div>

            {/* Inbound & Outbound Launch Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => setIsInboundOpen(true)}
                className="py-2.5 px-2 bg-white text-slate-800 hover:bg-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm shrink-0 truncate"
              >
                + Office Visit
              </button>
              <button
                onClick={() => setIsOutboundOpen(true)}
                className="py-2.5 px-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shrink-0 truncate"
              >
                + Log Field
              </button>
            </div>
          </div>

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

    </div>
  );
}
