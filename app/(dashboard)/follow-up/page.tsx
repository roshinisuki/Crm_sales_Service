"use client";

import { useState } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, d2, size = 16, className }: { d: string; d2?: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const icons = {
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  check_circle: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  chevron_left: "M15 19l-7-7 7-7",
  chevron_right: "M9 5l7 7-7 7",
  message: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  check: "M5 13l4 4L19 7",
  external: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const FOLLOW_UPS = [
  { id: "F-301", customer: "Delta Logistics", exec: "Arjun Mehta", date: "2026-05-24", remarks: "Renewal contract needs signature from Director.", status: "Overdue", priority: "High" },
  { id: "F-302", customer: "PrimeEdge IT", exec: "Divya Nair", date: "2026-05-23", remarks: "Send pricing proposal for 50 users.", status: "Due Today", priority: "Medium" },
  { id: "F-303", customer: "Horizon Hotels", exec: "Arjun Mehta", date: "2026-05-25", remarks: "Onboarding session for new branch managers.", status: "Upcoming", priority: "Low" },
  { id: "F-304", customer: "Sunrise Pharma", exec: "Divya Nair", date: "2026-05-28", remarks: "Quarterly review meeting.", status: "Upcoming", priority: "Medium" },
  { id: "F-305", customer: "Ramesh Constructions", exec: "Arjun Mehta", date: "2026-05-20", remarks: "Completed training session.", status: "Completed", priority: "Low" },
];

const KPI_DATA = [
  { label: "Upcoming", value: "14", icon: icons.calendar, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Due Today", value: "3", icon: icons.clock, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Overdue", value: "5", icon: icons.alert, color: "text-red-600", bg: "bg-red-50" },
  { label: "Completed (May)", value: "28", icon: icons.check_circle, color: "text-emerald-600", bg: "bg-emerald-50" },
];

const TABS = ["All", "Due Today", "Upcoming", "Overdue", "Completed"];

// ─── Sub-components ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    "High": "bg-red-50 text-red-700 border-red-200",
    "Medium": "bg-amber-50 text-amber-700 border-amber-200",
    "Low": "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered = FOLLOW_UPS.filter(f => {
    if (activeTab === "All") return true;
    return f.status === activeTab;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Follow-ups</h1>
          <p className="text-sm text-slate-500 mt-1">Manage scheduled meetings, calls, and pending tasks.</p>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_DATA.map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
              <Ico d={k.icon} size={20} className={k.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">{k.value}</p>
              <p className="text-xs font-semibold text-slate-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ── Main List (Left: 3 cols) ── */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-2 border-b border-slate-100 overflow-x-auto hide-scrollbar">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  activeTab === tab ? "border-[#0D2137] text-[#0D2137]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                {tab}
              </button>
            ))}
          </div>

          {/* List Items */}
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No follow-ups found for this category.</div>
            ) : filtered.map(f => {
              const isOverdue = f.status === "Overdue";
              return (
                <div key={f.id} className={`p-5 flex flex-col md:flex-row md:items-center gap-5 hover:bg-slate-50/50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                  {/* Date Block */}
                  <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 border shadow-sm ${
                    isOverdue ? "bg-red-50 border-red-200 text-red-700" : 
                    f.status === "Due Today" ? "bg-amber-50 border-amber-200 text-amber-700" :
                    "bg-white border-slate-200 text-slate-700"
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{new Date(f.date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-xl font-black leading-none">{new Date(f.date).getDate()}</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`text-base font-bold truncate ${isOverdue ? 'text-red-900' : 'text-slate-800'}`}>{f.customer}</h3>
                      <PriorityBadge priority={f.priority} />
                      {isOverdue && <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Overdue</span>}
                    </div>
                    <p className="text-sm text-slate-600 truncate mb-2">{f.remarks}</p>
                    <div className="flex items-center gap-4 text-[11px] font-medium text-slate-400">
                      <span className="flex items-center gap-1"><Ico d={icons.users} size={12} /> {f.exec}</span>
                      <span className="flex items-center gap-1 font-mono">{f.id}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 md:flex-col md:w-32 lg:flex-row lg:w-auto">
                    {f.status !== "Completed" && (
                      <>
                        <button className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors">
                          <Ico d={icons.check} size={14} /> Done
                        </button>
                        <button className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-semibold transition-colors">
                          <Ico d={icons.message} size={14} /> Note
                        </button>
                      </>
                    )}
                    <button className="p-2 text-slate-400 hover:text-[#0D2137] bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all">
                      <Ico d={icons.external} size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Column: Mini Calendar ── */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-slate-800">May 2026</h2>
              <div className="flex gap-1">
                <button className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-400"><Ico d={icons.chevron_left} size={14} /></button>
                <button className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-400"><Ico d={icons.chevron_right} size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-[10px] font-bold text-slate-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
              {/* Padding */}
              <div className="p-2 text-slate-300">26</div><div className="p-2 text-slate-300">27</div><div className="p-2 text-slate-300">28</div><div className="p-2 text-slate-300">29</div><div className="p-2 text-slate-300">30</div>
              {/* Days */}
              {Array.from({length: 31}).map((_, i) => {
                const day = i + 1;
                const isToday = day === 23;
                const hasFollowUp = [20, 23, 24, 25, 28].includes(day);
                
                return (
                  <div key={day} className={`p-1.5 rounded-lg flex items-center justify-center relative cursor-pointer
                    ${isToday ? 'bg-[#0D2137] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}
                  `}>
                    {day}
                    {hasFollowUp && !isToday && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-[#0D2137] to-[#1a365d] rounded-2xl shadow-sm p-6 text-white text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
              <Ico d={icons.check_circle} size={24} className="text-emerald-400" />
            </div>
            <h3 className="text-base font-bold mb-1">Great Job!</h3>
            <p className="text-xs text-blue-100/70 mb-4">You have completed 85% of your follow-ups this week.</p>
            <button className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors border border-white/5">
              View Performance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
