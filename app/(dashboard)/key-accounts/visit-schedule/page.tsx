"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  KPICard, AnalyticsPageHeader, EmptyState, LoadingState,
} from "@/components/shared/AnalyticsComponents";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  clock: "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  alert: "M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  map: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z",
};

export default function VisitSchedulePage() {
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/key-accounts/visits");
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch {
      toast.error("Failed to load visit schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

  // ── Summary metrics ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const overdue = data.filter((v) => v.isOverdue).length;
    const thisWeek = data.filter((v) => {
      if (!v.earliestDate) return false;
      const d = new Date(v.earliestDate);
      return d >= today && d <= endOfWeek;
    }).length;
    const totalScheduled = data.filter((v) => v.earliestDate).length;

    // Next upcoming visit
    const upcoming = data.filter((v) => v.earliestDate && !v.isOverdue);
    let nextVisit = "—";
    if (upcoming.length > 0) {
      const next = upcoming[0];
      nextVisit = `${next.customerName} — ${new Date(next.earliestDate).toLocaleDateString()}`;
    }

    return { overdue, thisWeek, totalScheduled, nextVisit };
  }, [data, today, endOfWeek]);

  // ── Group by week ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: any[] }>();
    for (const v of data) {
      const key = v.weekKey;
      if (!map.has(key)) map.set(key, { label: v.weekLabel, items: [] });
      map.get(key)!.items.push(v);
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [data]);

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Visit Schedule" subtitle="Upcoming reviews and visits grouped by week">
        <Link href="/key-accounts" className="text-[13px] text-[var(--accent)] hover:underline">← Back to key accounts</Link>
      </AnalyticsPageHeader>

      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No upcoming visits or reviews found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Visits This Week" value={summary.thisWeek} />
            <div className="analytics-kpi">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">Overdue Reviews</span>
                <Ico d={icons.alert} size={16} className={summary.overdue > 0 ? "text-[var(--status-danger-text)]" : "text-[var(--text-muted)]"} />
              </div>
              <div className={`text-[28px] font-bold leading-tight ${summary.overdue > 0 ? "text-[var(--status-danger-text)]" : "text-[var(--text-primary)]"}`}>{summary.overdue}</div>
              {summary.overdue > 0 && <span className="text-[12px] text-[var(--status-danger-text)] font-medium">Needs immediate attention</span>}
            </div>
            <KPICard label="Next Upcoming" value={summary.nextVisit} />
            <KPICard label="Total Scheduled" value={summary.totalScheduled} />
          </div>

          {/* Grouped timeline */}
          <div className="space-y-4">
            {grouped.map((group) => {
              const isOverdueGroup = group.key === "overdue";
              return (
                <div key={group.key} className="analytics-chart-card !p-0 overflow-hidden">
                  {/* Week header */}
                  <div
                    className={`flex items-center gap-2 px-5 py-3 border-b ${
                      isOverdueGroup
                        ? "bg-[var(--status-danger-bg)] border-[var(--status-danger-border)]"
                        : "bg-[var(--surface-2)] border-[var(--border-subtle)]"
                    }`}
                  >
                    <Ico d={icons.calendar} size={16} className={isOverdueGroup ? "text-[var(--status-danger-text)]" : "text-[var(--text-muted)]"} />
                    <span className={`text-[14px] font-medium ${isOverdueGroup ? "text-[var(--status-danger-text)]" : "text-[var(--text-primary)]"}`}>
                      {group.label}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)]">{group.items.length} visit{group.items.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Visit items */}
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.items.map((v) => (
                      <Link
                        key={v.id}
                        href={`/key-accounts/${v.id}`}
                        className={`flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors ${
                          v.isOverdue ? "border-l-4 border-l-[var(--status-danger)]" : ""
                        }`}
                      >
                        {/* Date */}
                        <div className="w-20 flex-shrink-0">
                          {v.nextReviewDate ? (
                            <div className="text-center">
                              <div className="text-[18px] font-bold text-[var(--text-primary)]">{new Date(v.nextReviewDate).getDate()}</div>
                              <div className="text-[11px] text-[var(--text-muted)] uppercase">{new Date(v.nextReviewDate).toLocaleString("en-US", { month: "short" })}</div>
                            </div>
                          ) : v.nextMeetingDate ? (
                            <div className="text-center">
                              <div className="text-[18px] font-bold text-[var(--text-primary)]">{new Date(v.nextMeetingDate).getDate()}</div>
                              <div className="text-[11px] text-[var(--text-muted)] uppercase">{new Date(v.nextMeetingDate).toLocaleString("en-US", { month: "short" })}</div>
                            </div>
                          ) : (
                            <Ico d={icons.clock} size={20} className="text-[var(--text-muted)]" />
                          )}
                        </div>

                        {/* Customer + manager */}
                        <div className="flex-1 min-w-[180px]">
                          <div className="text-[14px] font-medium text-[var(--text-primary)]">{v.customerName}</div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] mt-0.5">
                            <Ico d={icons.user} size={12} />
                            {v.accountManager}
                            {v.accountManagerRole && v.accountManagerRole !== "—" && (
                              <StatusPill status={v.accountManagerRole} />
                            )}
                          </div>
                        </div>

                        {/* Purpose / type */}
                        <div className="text-[12px] text-[var(--text-secondary)] min-w-[120px]">
                          {v.nextMeetingPurpose ? (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]">{v.nextMeetingPurpose}</span>
                          ) : v.nextReviewDate ? (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]">Review</span>
                          ) : "—"}
                        </div>

                        {/* Overdue badge */}
                        {v.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]">
                            <Ico d={icons.alert} size={12} /> Overdue
                          </span>
                        )}

                        {/* Last visit info */}
                        <div className="text-[12px] text-[var(--text-muted)] min-w-[120px] text-right">
                          {v.lastVisitDate && (
                            <>
                              <div>Last: {new Date(v.lastVisitDate).toLocaleDateString()}</div>
                              {v.lastOutcome && v.lastOutcome !== "—" && <div className="text-[11px]">{v.lastOutcome}</div>}
                            </>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageContainer>
  );
}
