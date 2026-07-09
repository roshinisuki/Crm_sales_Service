"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { CRMSpinner } from "@/components/CRMSpinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, MapPin, CalendarClock } from "lucide-react";

export default function KeyAccountVisitsPage() {
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/key-accounts/visits");
      const data = await res.json();
      if (data.success) setData(data.data);
    } catch {
      toast.error("Failed to load visit schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = new Date();

  return (
    <PageShell title="Upcoming Visit Schedule">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[var(--text-primary)]">Upcoming Visit Schedule</h1>
          <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)] mt-0.5">Key accounts with upcoming reviews and visits</p>
        </div>
        <Link href="/key-accounts" className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
          <ArrowLeft size={14} /> Back to key accounts
        </Link>
      </div>

      {loading ? null : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-[var(--text-secondary)]">No upcoming visits or reviews found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Account Manager</TableHead>
                <TableHead>Next Review Date</TableHead>
                <TableHead>Planned Visit</TableHead>
                <TableHead>Last Visit Date</TableHead>
                <TableHead>Last Outcome</TableHead>
                <TableHead>Visit Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((v) => (
                <TableRow key={v.id} className={v.isOverdue ? "bg-red-50/30 dark:bg-red-900/10" : ""}>
                  <TableCell>
                    <Link href={`/key-accounts/${v.id}`} className="font-medium text-[var(--primary)] hover:underline">{v.customerName}</Link>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{v.accountManager}</TableCell>
                  <TableCell>
                    {v.nextReviewDate ? (
                      <span className={v.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-600 dark:text-[var(--text-secondary)]"}>
                        {new Date(v.nextReviewDate).toLocaleDateString()}
                        {v.isOverdue && (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        )}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {v.plannedVisitDate ? (
                      <Link href={`/visits/${v.plannedVisitId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
                        <CalendarClock size={12} />
                        {new Date(v.plannedVisitDate).toLocaleDateString()}
                        {v.plannedVisitTime && <span className="text-xs text-slate-400">{v.plannedVisitTime}</span>}
                        {v.plannedVisitPurpose && <span className="text-xs text-slate-400">· {v.plannedVisitPurpose}</span>}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{v.lastVisitDate ? new Date(v.lastVisitDate).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{v.lastOutcome}</TableCell>
                  <TableCell>
                    {v.lastVisitType ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        {v.lastVisitType === "field_visit" ? <MapPin size={10} /> : null}
                        {v.lastVisitType === "field_visit" ? "Field" : "Office"}
                        {v.lastLocationVerified === false && (
                          <span title="Location unverified" className="text-amber-500"><AlertTriangle size={10} /></span>
                        )}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
