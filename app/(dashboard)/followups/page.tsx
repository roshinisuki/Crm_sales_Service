"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { getFollowUpsListAction } from "@/app/actions/visits";
import { getUsersAction } from "@/app/actions/users";
import { Calendar, Clock, CheckCircle, AlertCircle, Eye, Check, RefreshCw } from "lucide-react";

function FollowUpsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  // Load status filter from URL if present
  const urlStatus = searchParams.get("status") || "All";

  // Component States
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("All");

  // Dialogs State
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [newRemarks, setNewRemarks] = useState("");

  // Sync URL status with local status state
  useEffect(() => {
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, uRes] = await Promise.all([
        getFollowUpsListAction(),
        getUsersAction()
      ]);

      if (fRes.success && fRes.data) {
        setFollowUps(fRes.data);
      } else {
        toast.error(fRes.message || "Failed to load follow-ups");
      }

      if (uRes?.success && uRes.data) {
        setUsers(uRes.data.filter((u: any) => u.isActive));
      }
    } catch (err: any) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update URL on status filter change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status && status !== "All") {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`/followups?${params.toString()}`);
  };

  // Actions
  const handleMarkComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingId) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/followups/${completingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          remarks: completionNotes,
          notes: completionNotes
        })
      });

      const res = await response.json();
      if (res.success) {
        toast.success("Follow-up marked complete");
        setCompletingId(null);
        setCompletionNotes("");
        loadData();
      } else {
        toast.error(res.message || "Failed to complete follow-up");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingId || !newDueDate) {
      toast.error("Please specify a valid new date");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/followups/${reschedulingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextMeetingDate: newDueDate,
          remarks: newRemarks,
          notes: newRemarks
        })
      });

      const res = await response.json();
      if (res.success) {
        toast.success("Follow-up rescheduled successfully");
        setReschedulingId(null);
        setNewDueDate("");
        setNewRemarks("");
        loadData();
      } else {
        toast.error(res.message || "Failed to reschedule follow-up");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Scoped Overdue Check
  const isItemOverdue = (f: any) => {
    if (f.status === "Completed" || f.status === "Cancelled") return false;
    const nextDate = new Date(f.nextMeetingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return nextDate < today;
  };

  // Client filtering
  const filteredFollowUps = followUps.filter((f) => {
    const isOverdue = isItemOverdue(f);

    // Status Filter
    if (statusFilter !== "All") {
      if (statusFilter === "Pending" && (f.status !== "Pending" || isOverdue)) return false;
      if (statusFilter === "Completed" && f.status !== "Completed") return false;
      if (statusFilter === "Overdue" && !isOverdue) return false;
    }

    // Assignee Filter
    if (assigneeFilter !== "All" && f.assignedUserId !== assigneeFilter) return false;

    return true;
  });

  // Calculate quick metrics based on loaded data
  const totalCount = followUps.length;
  const pendingCount = followUps.filter(f => f.status === "Pending" && !isItemOverdue(f)).length;
  const completedCount = followUps.filter(f => f.status === "Completed").length;
  const overdueCount = followUps.filter(f => isItemOverdue(f)).length;

  return (
    <PageShell
      title="Follow-Ups"
      subtitle="Track, reschedule, and complete scheduled touchpoints"
    >
      <PageContainer className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Follow-Ups"
            value={totalCount}
            icon={<Calendar size={20} />}
            variant="orange"
            subtitle="All scheduled tasks"
          />
          <SummaryCard
            label="Pending"
            value={pendingCount}
            icon={<Clock size={20} />}
            variant="dark"
            subtitle="Upcoming touchpoints"
          />
          <SummaryCard
            label="Completed"
            value={completedCount}
            icon={<CheckCircle size={20} />}
            variant="light"
            subtitle="Successfully finalized"
          />
          <SummaryCard
            label="Overdue"
            value={overdueCount}
            icon={<AlertCircle size={20} />}
            variant="light"
            subtitle="Action required"
          />
        </div>

        {/* Filters Toolbar */}
        <div className="crm-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned To</label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
              >
                <option value="All">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer border border-slate-250 self-end md:self-auto"
          >
            <RefreshCw size={13} /> Refresh List
          </button>
        </div>

        {/* Follow Ups Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="crm-table w-full text-left border-collapse">
              <thead>
                <tr className="crm-tr border-b border-slate-100 bg-slate-50/50">
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Customer/Lead Name</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Assigned To</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Due Date</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Priority</th>
                  <th className="crm-th px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      Loading follow-ups...
                    </td>
                  </tr>
                ) : filteredFollowUps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                      No follow-ups matches the filter conditions.
                    </td>
                  </tr>
                ) : (
                  filteredFollowUps.map((f) => {
                    const isCompleted = f.status === "Completed";
                    const isOverdue = isItemOverdue(f);

                    // Display Name (Customer or Lead Name)
                    const displayName = f.customerName || f.leadName || "—";
                    const subtitle = f.customerCode ? `Cust: ${f.customerCode}` : f.leadCode ? `Lead: ${f.leadCode}` : "";

                    return (
                      <tr key={f.id} className="crm-tr hover:bg-slate-50/40 transition-colors">
                        <td className="crm-td px-5 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-sm block leading-tight">{displayName}</span>
                            {subtitle && <span className="text-[10px] text-slate-400 font-bold mt-0.5">{subtitle}</span>}
                          </div>
                        </td>
                        <td className="crm-td px-5 py-4 text-slate-600 font-medium">
                          {f.assignedToName || "—"}
                        </td>
                        <td className="crm-td px-5 py-4 text-slate-600 font-medium">
                          {new Date(f.nextMeetingDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </td>
                        <td className="crm-td px-5 py-4">
                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              Completed
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-red-50 text-red-700 border-red-200 animate-pulse">
                              Overdue
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-50 text-amber-700 border-amber-200">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="crm-td px-5 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            f.priority === "High"
                              ? "bg-red-50 text-red-650 border-red-200"
                              : f.priority === "Low"
                              ? "bg-emerald-50 text-emerald-650 border-emerald-200"
                              : "bg-orange-50 text-orange-650 border-orange-200"
                          }`}>
                            {f.priority || "Medium"}
                          </span>
                        </td>
                        <td className="crm-td px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/follow-up/${f.id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye size={15} />
                            </Link>

                            {!isCompleted && (
                              <>
                                <button
                                  onClick={() => setCompletingId(f.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Mark Complete"
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  onClick={() => {
                                    setReschedulingId(f.id);
                                    // Set default to today
                                    setNewDueDate(new Date(f.nextMeetingDate).toISOString().split("T")[0]);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                  title="Reschedule"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dialog: Mark Complete */}
        {completingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-[#FAF6F3]">
                <h3 className="text-base font-extrabold text-slate-800">Mark Follow-Up as Complete</h3>
                <p className="text-xs text-slate-500 mt-0.5">Please provide any final notes or outcome details.</p>
              </div>

              <form onSubmit={handleMarkComplete}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      Completion Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="e.g. Sent the detailed proposal, they will review next week."
                      rows={4}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCompletingId(null);
                      setCompletionNotes("");
                    }}
                    className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-500 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Complete"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dialog: Reschedule */}
        {reschedulingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-[#FAF6F3]">
                <h3 className="text-base font-extrabold text-slate-800">Reschedule Follow-Up</h3>
                <p className="text-xs text-slate-500 mt-0.5">Choose a new target date and update notes.</p>
              </div>

              <form onSubmit={handleReschedule}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      New Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all font-medium text-slate-700 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      Remarks / Notes
                    </label>
                    <textarea
                      value={newRemarks}
                      onChange={(e) => setNewRemarks(e.target.value)}
                      placeholder="e.g. Rescheduled because client was busy."
                      rows={3}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReschedulingId(null);
                      setNewDueDate("");
                      setNewRemarks("");
                    }}
                    className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-500 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#C2601A] hover:bg-[#A84F16] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Reschedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    }>
      <FollowUpsContent />
    </Suspense>
  );
}
