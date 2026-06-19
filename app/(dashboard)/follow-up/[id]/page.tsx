"use client";
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getFollowUpByIdAction,
  completeFollowUpAction,
  createFollowUpAction
} from "@/app/actions/followUps";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import GuidedWorkflowBanner from "@/components/GuidedWorkflowBanner";

const icons = {
  back: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  check: <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  company: <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  phone: <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  email: <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  call: <svg className="w-4 h-4 text-slate-600 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  meeting: <svg className="w-4 h-4 text-slate-600 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  x: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
};

function getCompanyName(name: string) {
  if (!name) return "—";
  if (name.includes("Arun Selvan")) return "Rajesh Ltd.";
  if (name.includes("Priya")) return "S.K. Traders";
  if (name.includes("Rahul")) return "Vijay Enterprises";
  if (name.includes("Neha")) return "Teon Solutions";
  if (name.includes("Sanjay")) return "Global Corp";
  return "Suki Software Partner";
}

function formatDate(dateString: string | Date | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString("default", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatTime(dateString: string | Date | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function FollowUpDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const followUpId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [followUp, setFollowUp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mark Complete Modal State
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [newCustomerStatus, setNewCustomerStatus] = useState("Active");
  const [outcomeRemarks, setOutcomeRemarks] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowUpTimeComplete, setNextFollowUpTimeComplete] = useState("");
  const [nextFollowUpNotesComplete, setNextFollowUpNotesComplete] = useState("");
  const [nextFollowUpPriorityComplete, setNextFollowUpPriorityComplete] = useState<"Low" | "Medium" | "High">("Medium");

  const [formLoading, setFormLoading] = useState(false);

  const loadFollowUp = async () => {
    setLoading(true);
    const res = await getFollowUpByIdAction(followUpId);
    if (res.success && res.data) {
      setFollowUp(res.data);
      setNewCustomerStatus(res.data.customer?.status || "Active");
    } else {
      toast.error(res.message || "Failed to load follow-up details.");
      router.push("/follow-up");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFollowUp();
  }, [followUpId]);

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp) return;
    // Redirect to activity form — follow-up completion requires a logged activity.
    // The activity form will call completeFollowUpWithActivityAction (source of truth).
    const params = new URLSearchParams({ followUpId: followUp.id });
    if (followUp.leadId) params.set("leadId", followUp.leadId);
    if (followUp.customerId) params.set("customerId", followUp.customerId);
    setIsCompleteOpen(false);
    router.push(`/activities/new?${params.toString()}`);
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-bold text-xs text-center">Loading follow-up details...</div>;
  }

  if (!followUp) return null;

  const isCompleted = followUp.status === "Completed";
  const customer = followUp.customer;
  const history = customer?.followUps || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/follow-up"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-800 transition-colors shadow-xs"
          >
            {icons.back}
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Follow-up</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Touchpoint detail file</p>
          </div>
        </div>

        {!isCompleted && followUp.status !== "Cancelled" && (
          <button
            onClick={() => setIsCompleteOpen(true)}
            className="flex items-center px-4 py-2 border-2 border-emerald-500 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer"
          >
            {icons.check}
            Mark as Completed
          </button>
        )}
      </div>

      {/* Guided Workflow Banner */}
      <GuidedWorkflowBanner
        entityType="followup"
        entityId={followUp.id}
        status={followUp.status}
        entityName={`${followUp.visitType} - ${followUp.priority} Priority`}
        customerId={followUp.customerId}
        onRefresh={loadFollowUp}
      />

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Client Profile Header Card */}
          <div className="bg-white border border-slate-200/60 p-6 rounded-2xl shadow-xs">
            <div className="flex items-start gap-4">
              {/* Initials Circle */}
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-xs">
                {(customer?.name || "U").substring(0, 2).toUpperCase()}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-800">{customer?.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-purple-50 text-purple-700 border-purple-200 leading-none">
                    {customer?.status || "Qualified"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-4 text-xs font-semibold text-slate-650">
                  <div className="flex items-center">
                    {icons.company}
                    <span>{getCompanyName(customer?.name || "")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 mr-2 uppercase text-[9px] font-bold">Lead Source</span>
                    <span>{customer?.leadSource || "Website"}</span>
                  </div>
                  <div className="flex items-center">
                    {icons.phone}
                    <span className="font-mono">{customer?.phone || "+91 9876543210"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 mr-2 uppercase text-[9px] font-bold">Created On</span>
                    <span>{formatDate(customer?.createdAt)}</span>
                  </div>
                  <div className="flex items-center">
                    {icons.email}
                    <span>{customer?.email || "arun@gmail.com"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-slate-400 mr-2 uppercase text-[9px] font-bold">Created By</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">JD</div>
                      <span>John Doe</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Follow Up Information Card */}
          <div className="bg-white border border-slate-200/60 p-6 rounded-2xl shadow-xs">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5">
              Follow Up Information
            </h4>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Date</span>
                <span>{formatDate(followUp.nextMeetingDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Time</span>
                <span>{formatTime(followUp.nextMeetingDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Type</span>
                <span className="flex items-center mt-0.5">
                  {followUp.visitType === "OUTBOUND" ? (
                    <>
                      {icons.meeting}
                      <span>Meeting</span>
                    </>
                  ) : (
                    <>
                      {icons.call}
                      <span>Call</span>
                    </>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Assigned To</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-4 h-4 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-[8px] font-bold">
                    {(followUp.assignedUser?.name || "R").substring(0, 1).toUpperCase()}
                  </div>
                  <span>{followUp.assignedUser?.name || "Ravi"}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Priority</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${
                  followUp.priority === "High" ? "bg-red-50 text-red-650 border-red-200" : "bg-orange-50 text-orange-650 border-orange-200"
                }`}>
                  {followUp.priority || "High"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Status</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${
                  isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {followUp.status}
                </span>
              </div>

              {isCompleted && (
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Outcome</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 mt-0.5">
                    Interested
                  </span>
                </div>
              )}

              <div className="col-span-2 border-t border-slate-100 pt-3 mt-1">
                <span className="text-slate-400 uppercase text-[9px] font-bold block mb-1">Discussion Notes</span>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {followUp.remarks || followUp.notes || "No agenda notes registered."}
                </p>
              </div>

              {followUp.completionNotes && (
                <div className="col-span-2 bg-[#F6FBF9] border border-emerald-100 rounded-xl p-3.5 mt-2">
                  <span className="text-emerald-800 uppercase text-[9px] font-black block mb-0.5">Completion Outcome Remarks</span>
                  <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                    {followUp.completionNotes}
                  </p>
                  <p className="text-[9px] text-emerald-700/60 font-semibold mt-1">
                    Logged by {followUp.completedBy?.name || "System"} on {formatDate(followUp.completedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. New Follow Up Details Card */}
          {isCompleted && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-2xl shadow-xs">
              <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5">
                New Follow Up
              </h4>

              <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-4 text-xs font-semibold text-slate-650">
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Date</span>
                  <span>{formatDate(followUp.nextMeetingDate)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Time</span>
                  <span>{formatTime(followUp.nextMeetingDate)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Follow-up Type</span>
                  <span className="flex items-center mt-0.5">
                    {icons.meeting}
                    <span>Meeting</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-0.5">Reminder</span>
                  <span>15 min before</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-xs flex flex-col h-full min-h-[400px]">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="text-slate-700 font-extrabold text-sm">Follow Up History</span>
            </div>

            {/* Timeline */}
            <div className="flex-1 mt-4 relative border-l border-slate-200/80 ml-3 pl-5 space-y-6">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No history logs recorded.</p>
              ) : (
                history.map((evt: any, idx: number) => {
                  const evCompleted = evt.status === "Completed";
                  const evCancelled = evt.status === "Cancelled";
                  
                  let circleBg = "bg-amber-500 ring-amber-100";
                  if (evCompleted) circleBg = "bg-emerald-500 ring-emerald-100";
                  if (evCancelled) circleBg = "bg-slate-400 ring-slate-100";

                  return (
                    <div key={evt.id} className="relative">
                      {/* marker */}
                      <span className={`absolute -left-7 top-1 w-3 h-3 rounded-full ${circleBg} ring-4`}></span>
                      
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs font-semibold text-slate-650">
                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                          <span className="font-bold text-[10px] text-slate-800">
                            {formatDate(evt.nextMeetingDate)} {formatTime(evt.nextMeetingDate)}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                            evCompleted ? "bg-emerald-50 text-emerald-700" : evCancelled ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"
                          }`}>
                            {evt.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {evt.visitType === "OUTBOUND" ? "Follow up scheduled" : "Follow up completed"}
                        </p>
                        <p className="text-xs text-slate-600 font-medium leading-normal mt-1">
                          {evt.remarks || evt.notes || "No logs agenda description."}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 mt-4 text-center">
              <button
                onClick={() => router.push(`/customer-master/${customer?.id}?tab=timeline`)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all w-full cursor-pointer"
              >
                View All History
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Complete Dialog Modal */}
      {isCompleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3] shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">Complete Follow-Up</h2>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-wider">Log customer sentiment & outcome</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompleteOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              >
                {icons.x}
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="flex flex-col min-h-0 overflow-y-auto">
              <div className="p-6 space-y-5">
                {/* Updated Customer Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Updated Customer Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newCustomerStatus}
                    onChange={(e) => setNewCustomerStatus(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all text-slate-700 font-semibold cursor-pointer"
                  >
                    <option value="Active">Active (Converted / Closed Won)</option>
                    <option value="Prospect">Prospect (Interested / Lead)</option>
                    <option value="APPROVED">APPROVED (Approve & Email Portal Link)</option>
                    <option value="PENDING">PENDING (Still Considering / Decision Pending)</option>
                    <option value="REJECTED">REJECTED (Closed Lost / Rejected)</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Outcome Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Outcome Completion Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={outcomeRemarks}
                    onChange={(e) => setOutcomeRemarks(e.target.value)}
                    placeholder="Enter discussion outcome and next steps details..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all resize-none text-slate-755 font-medium"
                    required
                  ></textarea>
                </div>

                {/* Schedule Next Follow-up Checkbox */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={scheduleNext}
                      onChange={() => setScheduleNext(!scheduleNext)}
                      className="rounded border-slate-350 text-[#B3592D] focus:ring-[#B3592D]/20 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Schedule another follow-up?</p>
                      <p className="text-[10px] text-slate-400">Creates a new pending touchpoint automatically</p>
                    </div>
                  </label>
                </div>

                {scheduleNext && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Next Meeting Date & Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={nextFollowUpTimeComplete}
                        onChange={(e) => setNextFollowUpTimeComplete(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all text-slate-700 font-semibold"
                        required={scheduleNext}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                      <select
                        value={nextFollowUpPriorityComplete}
                        onChange={(e) => setNextFollowUpPriorityComplete(e.target.value as any)}
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Agenda / Notes</label>
                      <textarea
                        rows={2}
                        value={nextFollowUpNotesComplete}
                        onChange={(e) => setNextFollowUpNotesComplete(e.target.value)}
                        placeholder="What needs to be discussed next..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3592D]/15 focus:border-[#B3592D] transition-all resize-none text-slate-700 font-medium"
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCompleteOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md cursor-pointer"
                >
                  Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
