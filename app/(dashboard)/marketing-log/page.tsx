"use client";

import { useState } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  filter: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  more: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z",
  x: "M6 18L18 6M6 6l12 12",
  map_pin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  check_circle: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const VISITS = [
  { id: "V-2001", customer: "Ramesh Constructions", exec: "Arjun Mehta", checkIn: "09:15 AM", checkOut: "10:30 AM", status: "Completed", remarks: "Discussed Q3 requirements.", nextMeeting: "2026-06-01" },
  { id: "V-2002", customer: "Sunrise Pharma", exec: "Divya Nair", checkIn: "10:30 AM", checkOut: "-", status: "In Progress", remarks: "Product demo ongoing.", nextMeeting: "-" },
  { id: "V-2003", customer: "Delta Logistics", exec: "Arjun Mehta", checkIn: "11:00 AM", checkOut: "11:45 AM", status: "Completed", remarks: "Renewal contract signed.", nextMeeting: "2027-05-10" },
  { id: "V-2004", customer: "PrimeEdge IT", exec: "Divya Nair", checkIn: "01:45 PM", checkOut: "-", status: "In Progress", remarks: "Initial introduction meeting.", nextMeeting: "-" },
];

const KPI_DATA = [
  { label: "Today's Visits", value: "18", icon: icons.map_pin, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "This Week", value: "84", icon: icons.calendar, color: "text-indigo-600", bg: "bg-indigo-50" },
  { label: "Completed", value: "13", icon: icons.check_circle, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Pending Checkout", value: "5", icon: icons.clock, color: "text-amber-600", bg: "bg-amber-50" },
];

const TIMELINE = [
  { time: "01:45 PM", title: "Checked In", desc: "Divya Nair at PrimeEdge IT", color: "bg-blue-500" },
  { time: "11:45 AM", title: "Checked Out", desc: "Arjun Mehta at Delta Logistics", color: "bg-emerald-500" },
  { time: "11:00 AM", title: "Checked In", desc: "Arjun Mehta at Delta Logistics", color: "bg-blue-500" },
  { time: "10:30 AM", title: "Checked In", desc: "Divya Nair at Sunrise Pharma", color: "bg-blue-500" },
  { time: "10:30 AM", title: "Checked Out", desc: "Arjun Mehta at Ramesh Constructions", color: "bg-emerald-500" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VisitsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Marketing Visits</h1>
          <p className="text-sm text-slate-500 mt-1">Track executive field visits, check-ins, and meeting notes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-medium hover:bg-[#1a365d] transition-colors shadow-sm"
        >
          <Ico d={icons.plus} size={16} />
          Log Visit
        </button>
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
        {/* ── Main Content (Left: 3 cols) ── */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          {/* Filter Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Ico d={icons.search} size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Search visits..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none pr-8">
                <option value="">All Executives</option>
                <option value="Arjun Mehta">Arjun Mehta</option>
                <option value="Divya Nair">Divya Nair</option>
              </select>
              <select className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none pr-8">
                <option value="">Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <input type="date" className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Executive</th>
                  <th className="px-6 py-4">Timings</th>
                  <th className="px-6 py-4 hidden md:table-cell">Remarks</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {VISITS.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{v.customer}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{v.id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{v.exec}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-slate-500">In: <span className="font-medium text-slate-700">{v.checkIn}</span></span>
                        <span className="text-slate-500">Out: <span className="font-medium text-slate-700">{v.checkOut}</span></span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-slate-600 truncate max-w-[200px]">{v.remarks}</p>
                      {v.nextMeeting !== "-" && (
                        <p className="text-[11px] text-slate-400 mt-1">Next: {v.nextMeeting}</p>
                      )}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                    <td className="px-6 py-4 text-right">
                      {v.status === "In Progress" && (
                        <button className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg mr-2 transition-colors">
                          Check Out
                        </button>
                      )}
                      <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                        <Ico d={icons.more} size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right Column: Activity Timeline ── */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col h-full">
          <h2 className="text-base font-bold text-slate-800 mb-1">Live Activity</h2>
          <p className="text-xs text-slate-500 mb-6">Today's real-time check-ins</p>
          
          <div className="flex-1 space-y-6 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
            {TIMELINE.map((t, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Icon */}
                <div className={`flex items-center justify-center w-7 h-7 rounded-full border-4 border-white ${t.color} text-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-0 md:left-1/2 -translate-x-1/2`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                {/* Content */}
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2rem)] ml-10 md:ml-0 p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">{t.title}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{t.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form Modal (Mock) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Log New Visit</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <Ico d={icons.x} size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Ico d={icons.clock} size={20} className="text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900">Checking in at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="text-xs text-blue-700 mt-0.5">Your location and time will be recorded automatically.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer <span className="text-red-500">*</span></label>
                <select className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option>Select a customer...</option>
                  <option>Ramesh Constructions (C-1001)</option>
                  <option>Sunrise Pharma (C-1002)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Initial Remarks</label>
                <textarea rows={3} placeholder="Purpose of visit..." className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Next Meeting Date (Optional)</label>
                <input type="date" className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#0D2137] hover:bg-[#1a365d] transition-colors shadow-sm">
                Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
