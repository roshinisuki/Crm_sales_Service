"use client";

import { useState, useEffect } from "react";
import { getFollowUpsListAction } from "@/app/actions/visits";
import { updateFollowUpStatusAction, createFollowUpAction } from "@/app/actions/followUps";
import { getCustomersAction } from "@/app/actions/customers";

const icons = {
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  calendar: <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  x: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Overdue" | "Completed">("All");

  // Modal Open
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Modal inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, custRes] = await Promise.all([
        getFollowUpsListAction(),
        getCustomersAction()
      ]);
      if (res.success && res.data) {
        setFollowUps(res.data);
      }
      if (custRes.success && custRes.data) {
        setCustomers(custRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkComplete = async (id: string) => {
    try {
      const res = await updateFollowUpStatusAction({ id, status: "Completed" });
      if (res.success) {
        loadData();
      } else {
        alert(res.message || "Failed to update status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!selectedCustomerId || !scheduledTime) {
      setErrorMsg("Please fill in all required fields.");
      setFormLoading(false);
      return;
    }

    try {
      const res = await createFollowUpAction({
        customerId: selectedCustomerId,
        scheduledTime,
        notes
      });

      if (res.success) {
        setIsModalOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message || "Failed to create follow-up.");
      }
    } catch (err) {
      setErrorMsg("Something went wrong.");
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = followUps.filter((f) => {
    const custName = f.customerName.toLowerCase();
    const notesStr = (f.notes || "").toLowerCase();
    const term = search.toLowerCase();
    const matchesSearch = custName.includes(term) || notesStr.includes(term);

    if (statusFilter === "All") return matchesSearch;
    if (statusFilter === "Pending") return matchesSearch && f.status === "Pending" && f.badgeStatus !== "OVERDUE";
    if (statusFilter === "Overdue") return matchesSearch && f.badgeStatus === "OVERDUE";
    if (statusFilter === "Completed") return matchesSearch && f.status === "Completed";
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Visit Follow-ups & Reminders</h1>
          <p className="text-xs text-slate-500 font-medium">Manage upcoming calendar meetings, client renewals, and task lists.</p>
        </div>
        <button
          onClick={() => {
            setSelectedCustomerId("");
            setScheduledTime("");
            setNotes("");
            setErrorMsg("");
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0D2137] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          {icons.plus}
          Schedule Follow-up
        </button>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{followUps.filter(f => f.badgeStatus === "TODAY" && f.status !== "Completed").length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Today</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            {icons.calendar}
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{followUps.filter(f => f.badgeStatus === "UPCOMING" && f.status !== "Completed").length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Next 7 Days</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            ⚠️
          </div>
          <div>
            <p className="text-2xl font-black text-red-600">{followUps.filter(f => f.badgeStatus === "OVERDUE" && f.status !== "Completed").length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overdue</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
            ✓
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{followUps.filter(f => f.status === "Completed").length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</p>
          </div>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left List Card */}
        <div className="xl:col-span-3 bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-1.5 border-b border-slate-100 overflow-x-auto">
            {(["All", "Pending", "Overdue", "Completed"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap -mb-px ${
                  statusFilter === tab ? "border-[#0D2137] text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50/30 relative">
            <span className="absolute left-9 text-slate-400">{icons.search}</span>
            <input
              type="text"
              placeholder="Search follow-ups by customer name, agenda, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 font-medium text-slate-700"
            />
          </div>

          {/* List Items */}
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-10 text-center text-slate-500 text-xs font-bold">Loading scheduled follow-up meetings...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">No follow-up reminders found in this category</div>
            ) : filtered.map((f) => {
              const isCompleted = f.status === "Completed";
              const isOverdue = f.badgeStatus === "OVERDUE" && !isCompleted;
              const isToday = f.badgeStatus === "TODAY" && !isCompleted;
              
              // Color badges
              let badgeBg = "bg-slate-100 text-slate-600 border-slate-200";
              if (isToday) badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
              else if (isOverdue) badgeBg = "bg-red-50 text-red-600 border-red-200/80 animate-pulse";
              else if (!isCompleted) badgeBg = "bg-amber-50 text-amber-700 border-amber-200/80";

              return (
                <div key={f.id} className={`p-5 flex flex-col md:flex-row md:items-center gap-5 hover:bg-slate-50/40 transition-colors ${isOverdue ? "bg-red-50/[0.13]" : ""}`}>
                  
                  {/* Cal Box */}
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-xs ${
                    isOverdue ? "bg-red-50/50 border-red-200 text-red-700" : isToday ? "bg-emerald-50/50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider">{new Date(f.nextMeetingDate).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{new Date(f.nextMeetingDate).getDate()}</span>
                  </div>

                  {/* Contents */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{f.customerName}</h3>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">{f.customerCode}</span>
                      
                      {/* Priority Badges */}
                      {isToday && <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-emerald-100/60 text-emerald-800 border-emerald-200 leading-none">Due Today</span>}
                      {isOverdue && <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-red-100/60 text-red-800 border-red-200 leading-none animate-pulse">Overdue</span>}
                      {isCompleted && <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-slate-100 text-slate-600 border-slate-200 leading-none">Completed</span>}
                    </div>

                    <p className="text-xs text-slate-600 font-semibold leading-relaxed max-w-2xl">{f.notes || "No specific discussion agenda recorded."}</p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-2.5 uppercase tracking-wide">
                      <span className="flex items-center gap-1">⌚ {new Date(f.nextMeetingDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>•</span>
                      <span>Assigned to: {f.assignedToName}</span>
                      {f.visitType && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500 font-bold">{f.visitType} Linked Visit</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isCompleted ? (
                      <button
                        onClick={() => handleMarkComplete(f.id)}
                        className="flex items-center gap-1 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        {icons.check}
                        Complete
                      </button>
                    ) : (
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">Completed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Right Info calendar card */}
        <div className="bg-[#0D2137] rounded-3xl p-6 text-white shadow-sm flex flex-col gap-4 h-fit">
          <div>
            <h2 className="text-sm font-bold">Follow-Up Workflow Guide</h2>
            <p className="text-[10px] text-white/40 mt-0.5">Suki Software Conversion Pipeline</p>
          </div>
          <div className="space-y-3.5 text-xs text-white/75 mt-2">
            <div className="flex gap-2">
              <span className="font-bold text-[#5C8FFF]">1.</span>
              <p>Executives conduct inbound walk-ins and outbound site visits.</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-[#5C8FFF]">2.</span>
              <p>If customer decision remains PENDING, a follow-up date is mandatory.</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-[#5C8FFF]">3.</span>
              <p>Color alerts will notify you instantly if a meeting is today or overdue.</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-[#5C8FFF]">4.</span>
              <p>Closing follow-ups increases the account conversion score significantly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800">New Follow-Up Reminder</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                {icons.x}
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Select Customer Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Next Meeting Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none text-slate-700 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Agenda / Reminder Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agenda for next discussion..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none resize-none text-slate-750 font-medium"
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[#0D2137] hover:bg-[#153456] transition-colors"
                >
                  {formLoading ? "Scheduling..." : "Schedule Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
