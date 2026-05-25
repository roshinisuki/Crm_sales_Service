"use client";

import { useState, useEffect } from "react";
import { getFollowUpsAction, createFollowUpAction, updateFollowUpStatusAction } from "@/app/actions/followUps";
import { getCustomersAction } from "@/app/actions/customers";
import { FollowUp, Customer } from "@/types";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  check_circle: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    scheduledTime: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [followUpRes, custRes] = await Promise.all([
        getFollowUpsAction({ status: statusFilter === "All" ? undefined : statusFilter }),
        getCustomersAction(),
      ]);
      if (followUpRes.success) setFollowUps(followUpRes.data || []);
      if (custRes.success) setCustomers(custRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const openCreateModal = () => {
    setFormData({
      customerId: "",
      scheduledTime: "",
      notes: "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleToggleComplete = async (id: string) => {
    try {
      const res = await updateFollowUpStatusAction({ id, status: "Completed" });
      if (res.success) {
        loadData();
      } else {
        alert(res.message || "Failed to update follow-up");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!formData.customerId || !formData.scheduledTime) {
      setErrorMsg("Please select a customer and choose a scheduled time.");
      setFormLoading(false);
      return;
    }

    try {
      const res = await createFollowUpAction(formData);

      if (res.success) {
        setIsModalOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message || "Failed to schedule follow-up");
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred.");
    }
    setFormLoading(false);
  };

  const filtered = followUps.filter((f) => {
    const custName = f.customer?.name.toLowerCase() || "";
    const notes = f.notes?.toLowerCase() || "";
    const matchesSearch = custName.includes(search.toLowerCase()) || notes.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" ? true : f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Follow-ups</h1>
          <p className="text-sm text-slate-500 mt-1">Manage scheduled meetings, calls, and pending tasks.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-medium hover:bg-[#1a365d] transition-colors shadow-sm"
        >
          <Ico d={icons.plus} size={16} />
          Schedule Follow-up
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Ico d={icons.calendar} size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {followUps.filter(f => f.status === "Pending").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Upcoming</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Ico d={icons.alert} size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {followUps.filter(f => f.status === "Overdue").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Overdue</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Ico d={icons.check_circle} size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {followUps.filter(f => f.status === "Completed").length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Completed</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Ico d={icons.users} size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{followUps.length}</p>
            <p className="text-xs font-semibold text-slate-500">Total Follow-ups</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-2 border-b border-slate-100 overflow-x-auto">
            {["All", "Pending", "Overdue", "Completed"].map(tab => (
              <button key={tab} onClick={() => setStatusFilter(tab)}
                className={`px-4 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  statusFilter === tab ? "border-[#0D2137] text-[#0D2137]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5 border-b border-slate-100">
            <input 
              type="text" 
              placeholder="Search follow-ups by customer or details..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
            />
          </div>

          {/* List Items */}
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-10 text-center text-slate-500 text-sm">Loading scheduled reminders...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No follow-ups recorded.</div>
            ) : filtered.map(f => {
              const isOverdue = f.status === "Overdue";
              return (
                <div key={f.id} className={`p-5 flex flex-col md:flex-row md:items-center gap-5 hover:bg-slate-50/50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                  <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 border shadow-sm ${
                    isOverdue ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{new Date(f.scheduledTime).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-xl font-black leading-none">{new Date(f.scheduledTime).getDate()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-bold text-slate-800 truncate">{f.customer?.name || "Unknown"}</h3>
                      {isOverdue && <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Overdue</span>}
                      {f.status === "Completed" && <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Completed</span>}
                    </div>
                    <p className="text-sm text-slate-600 truncate mb-2">{f.notes || "No notes added for this reminder"}</p>
                    <div className="flex items-center gap-4 text-[11px] font-medium text-slate-400">
                      <span className="flex items-center gap-1 font-mono">Scheduled: {new Date(f.scheduledTime).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {f.status !== "Completed" && (
                      <button 
                        onClick={() => handleToggleComplete(f.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors"
                      >
                        <Ico d={icons.check_circle} size={14} /> Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar Side Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col h-fit">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Calendar Agenda</h2>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-700">Quick Reminder</p>
              <p className="text-[11px] text-slate-500 mt-1">Always perform follow-ups timely to convert Prospect customers to Active subscriptions.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Schedule Reminder</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <Ico d={icons.x} size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Customer Account <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">Select a customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none text-slate-700" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reminder Action Notes</label>
                  <textarea 
                    rows={3} 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter call notes, requirements..." 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#0D2137] hover:bg-[#1a365d] transition-colors shadow-sm disabled:opacity-75"
                >
                  {formLoading ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
