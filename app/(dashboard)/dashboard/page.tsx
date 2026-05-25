"use client";

import { useState } from "react";

const Ico = ({ d, d2, size = 16 }: { d: string; d2?: string; size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const VISITS = [
  { id: "MV-0041", customer: "Ramesh Constructions", exec: "Arjun Mehta", checkIn: "09:15 AM", status: "Checked Out", type: "Follow-up" },
  { id: "MV-0042", customer: "Sunrise Pharma",       exec: "Divya Nair",  checkIn: "10:30 AM", status: "Active",      type: "Demo" },
  { id: "MV-0043", customer: "Delta Logistics",      exec: "Arjun Mehta", checkIn: "11:00 AM", status: "Overdue",     type: "Renewal" },
  { id: "MV-0044", customer: "PrimeEdge IT",         exec: "Divya Nair",  checkIn: "01:45 PM", status: "Active",      type: "New Intro" },
  { id: "MV-0045", customer: "Horizon Hotels",       exec: "Arjun Mehta", checkIn: "02:30 PM", status: "Checked Out", type: "Follow-up" },
];

const ACTIVITY = [
  { title: "Subscription Renewed",  desc: "Sunrise Pharma upgraded to Enterprise plan.",    time: "10 min ago", color: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  { title: "Follow-up Scheduled",   desc: "Delta Logistics — call set for tomorrow 10 AM.", time: "42 min ago", color: "bg-blue-50 text-blue-600",     dot: "bg-blue-500" },
  { title: "Visit Logged",          desc: "Arjun Mehta checked in at Ramesh Constructions.",time: "1h ago",     color: "bg-slate-100 text-slate-600",  dot: "bg-slate-400" },
  { title: "Visitor Checked In",    desc: "John D. arrived to meet Priya Sharma.",          time: "2h ago",     color: "bg-violet-50 text-violet-600", dot: "bg-violet-500" },
  { title: "Subscription Expired",  desc: "PrimeEdge IT standard plan expired.",            time: "5h ago",     color: "bg-red-50 text-red-500",       dot: "bg-red-500" },
];

const KPI_DATA = [
  { label: "Total Users",          value: "5",   sub: "All roles",              color: "text-slate-800",   bg: "bg-blue-50",    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" },
  { label: "Customers",            value: "128", sub: "24 active this month",   color: "text-slate-800",   bg: "bg-indigo-50",  icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Active Subs",          value: "94",  sub: "12 expiring this week",  color: "text-emerald-700", bg: "bg-emerald-50", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { label: "Today's Visits",       value: "18",  sub: "5 still active",         color: "text-slate-800",   bg: "bg-amber-50",   icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
  { label: "Upcoming Follow-ups",  value: "9",   sub: "Next 7 days",            color: "text-blue-700",    bg: "bg-sky-50",     icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Overdue Follow-ups",   value: "4",   sub: "Needs action",           color: "text-red-600",     bg: "bg-red-50",     icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { label: "Today's Visitors",     value: "7",   sub: "Office check-ins",       color: "text-slate-800",   bg: "bg-violet-50",  icon: "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Audit Events",         value: "32",  sub: "Today's log entries",    color: "text-slate-800",   bg: "bg-slate-100",  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

const CHART_BARS = [
  { label: "8AM", val: 1 }, { label: "9AM", val: 3 }, { label: "10AM", val: 5 },
  { label: "11AM", val: 4 }, { label: "12PM", val: 2 }, { label: "1PM",  val: 6 },
  { label: "2PM",  val: 8 }, { label: "3PM",  val: 5 }, { label: "4PM",  val: 3 },
  { label: "5PM",  val: 2 },
];
const MAX_BAR = Math.max(...CHART_BARS.map(b => b.val));
const TABLE_TABS = ["Ongoing", "Completed", "Overdue"];

function KpiCard({ label, value, sub, color, bg, icon }: typeof KPI_DATA[0]) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
        <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={color}>
          <path d={icon} />
        </svg>
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      </div>
      <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Active":       "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    "Checked Out":  "bg-slate-100 text-slate-600 border-slate-200",
    "Overdue":      "bg-red-50 text-red-600 border-red-200/80",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("Ongoing");

  const filteredVisits = VISITS.filter(v => {
    if (activeTab === "Ongoing")   return v.status === "Active";
    if (activeTab === "Completed") return v.status === "Checked Out";
    if (activeTab === "Overdue")   return v.status === "Overdue";
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
        {KPI_DATA.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Visit Summary Table */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Visit Summary</h2>
              <p className="text-xs text-slate-400 mt-0.5">Today's marketing visit logs</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={13} />
                </span>
                <input type="text" placeholder="Search…" className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 text-xs border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-36" />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/60 transition-colors">
                <Ico d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" size={12} />
                Filter
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4 flex gap-0 border-b border-slate-100">
            {TABLE_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 pb-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === tab ? "border-[#1a6bff] text-[#1a6bff]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3">Visit ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Executive</th>
                  <th className="px-4 py-3 hidden md:table-cell">Type</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Check In</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredVisits.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-400">No visits in this category</td></tr>
                ) : filteredVisits.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-500">{v.id}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {v.customer[0]}
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[130px]">{v.customer}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 hidden sm:table-cell">{v.exec}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">{v.type}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell">{v.checkIn}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Showing {filteredVisits.length} entries</span>
            <div className="flex items-center gap-1">
              {[1,2,3].map(n => (
                <button key={n} className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${n === 1 ? "bg-[#0D2137] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{n}</button>
              ))}
              <span className="text-slate-300 px-1">…</span>
              <button className="text-slate-400 hover:text-slate-700"><Ico d="M9 5l7 7-7 7" size={14} /></button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Visit Frequency</h2>
                <p className="text-xs text-slate-400 mt-0.5">Hourly check-ins today</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">+18%</span>
            </div>
            <div className="flex items-end gap-1.5 h-28">
              {CHART_BARS.map(({ label, val }) => {
                const pct = Math.round((val / MAX_BAR) * 100);
                return (
                  <div key={label} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-full rounded-t-md transition-all ${val === MAX_BAR ? "bg-[#0D2137]" : "bg-slate-200 hover:bg-slate-300"}`}
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-[9px] text-slate-400 leading-none">{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Peak: <strong className="text-slate-800">2 PM</strong></span>
              <span>Total: <strong className="text-slate-800">18 visits</strong></span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Recent Activity</h2>
              <button className="text-xs font-semibold text-[#1a6bff] hover:underline">View all</button>
            </div>
            <div className="space-y-4">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`mt-0.5 w-7 h-7 rounded-full ${a.color} flex items-center justify-center shrink-0`}>
                    <div className={`w-2 h-2 rounded-full ${a.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{a.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">{a.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Audit Log Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Latest Audit Events</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 24 hours</p>
            </div>
            <button className="text-xs font-semibold text-[#1a6bff] hover:underline">See all logs</button>
          </div>
          <div className="space-y-1">
            {[
              { module: "auth",         action: "login",                user: "admin@sukisoftware.com",  time: "09:01 AM", color: "bg-blue-100 text-blue-600" },
              { module: "visit",        action: "create",               user: "exec1@sukisoftware.com",  time: "09:20 AM", color: "bg-emerald-100 text-emerald-600" },
              { module: "customer",     action: "update",               user: "admin@sukisoftware.com",  time: "10:45 AM", color: "bg-amber-100 text-amber-600" },
              { module: "subscription", action: "subscription change",  user: "admin@sukisoftware.com",  time: "11:30 AM", color: "bg-violet-100 text-violet-600" },
              { module: "visitor",      action: "create",               user: "lead@sukisoftware.com",   time: "01:15 PM", color: "bg-slate-100 text-slate-600" },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${e.color}`}>{e.module}</span>
                <span className="text-xs font-semibold text-slate-700 capitalize shrink-0">{e.action}</span>
                <span className="text-xs text-slate-400 truncate flex-1">{e.user}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{e.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Health */}
        <div className="bg-[#0D2137] rounded-2xl border border-white/5 shadow-sm p-5 text-white flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold">Subscription Health</h2>
              <p className="text-[11px] text-white/40 mt-0.5">Current plan breakdown</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Ico d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" size={15} />
            </div>
          </div>

          {/* SVG donut */}
          <div className="flex justify-center my-2">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.2" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22d3ee" strokeWidth="3.2" strokeDasharray="73.5 26.5" strokeLinecap="round" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fbbf24" strokeWidth="3.2" strokeDasharray="12.7 87.3" strokeDashoffset="-73.5" strokeLinecap="round" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f87171" strokeWidth="3.2" strokeDasharray="9.6 90.4" strokeDashoffset="-86.2" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">94</span>
                <span className="text-[10px] text-white/35">total</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {[
              { label: "Active",   count: 73, color: "bg-cyan-400" },
              { label: "Expiring", count: 12, color: "bg-amber-400" },
              { label: "Expired",  count: 9,  color: "bg-red-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${s.color} shrink-0`} />
                <span className="text-xs text-white/55 flex-1">{s.label}</span>
                <span className="text-xs font-bold">{s.count}</span>
              </div>
            ))}
          </div>

          <button className="mt-5 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors border border-white/5">
            Manage Subscriptions →
          </button>
        </div>
      </div>
    </div>
  );
}
