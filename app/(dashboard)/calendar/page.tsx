"use client";

import { useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const prev = () => {
    setViewDate(p => {
      if (p.month === 0) return { year: p.year - 1, month: 11 };
      return { year: p.year, month: p.month - 1 };
    });
  };
  const next = () => {
    setViewDate(p => {
      if (p.month === 11) return { year: p.year + 1, month: 0 };
      return { year: p.year, month: p.month + 1 };
    });
  };

  const cells = buildCalendar(viewDate.year, viewDate.month);
  const todayDate = today.getDate();
  const isCurrentMonth = viewDate.year === today.getFullYear() && viewDate.month === today.getMonth();

  return (
    <PageShell
      title="Calendar"
      subtitle="View scheduled follow-ups and events"
    >
      <PageContainer className="space-y-4 p-0">
      <div className="crm-card overflow-hidden max-w-3xl mx-auto">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            {MONTHS[viewDate.month]} {viewDate.year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setViewDate({ year: today.getFullYear(), month: today.getMonth() })}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Today
            </button>
            <button
              onClick={next}
              className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS.map(d => (
            <div key={d} className="py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = isCurrentMonth && day === todayDate;
            return (
              <div
                key={i}
                className={`
                  min-h-[72px] p-2 border-b border-r border-slate-50 transition-colors
                  ${day ? "hover:bg-slate-50 cursor-pointer" : "bg-slate-50/30"}
                  ${i % 7 === 0 ? "" : ""}
                `}
              >
                {day && (
                  <div className="flex flex-col gap-1">
                    <span className={`
                      w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold self-center
                      ${isToday ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}
                    `}>
                      {day}
                    </span>
                    {/* Placeholder event dots */}
                    {isToday && (
                      <div className="flex gap-0.5 justify-center">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        <span className="w-1 h-1 rounded-full bg-amber-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-5 py-4 flex items-center gap-5 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-xs font-medium text-slate-500">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-slate-500">Follow-up</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-slate-500">Meeting</span>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">Integration coming soon</span>
          </div>
        </div>
      </div>
      </PageContainer>
    </PageShell>
  );
}
