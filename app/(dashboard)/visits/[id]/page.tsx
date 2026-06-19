"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = { back: "M10 19l-7-7m0 0l7-7m-7 7h18", check: "M5 13l4 4L19 7", x: "M6 18L18 6M6 6l12 12" };

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  MISSED: "bg-red-100 text-red-700",
};

export default function VisitDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    meetingSummary: "",
    outcome: "",
    customerDecision: "",
    rejectionReason: "",
    nextMeetingDate: "",
    nextMeetingNotes: "",
  });

  const loadVisit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visits/${id}`);
      const data = await res.json();
      if (data.success) setVisit(data.data);
    } catch { toast.error("Failed to load visit"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadVisit(); }, [id]);

  const handleCheckIn = async () => {
    try {
      const res = await fetch(`/api/visits/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkin" }) });
      const data = await res.json();
      if (data.success) { toast.success("Checked in"); loadVisit(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleCheckOut = async () => {
    if (!checkoutForm.meetingSummary) { toast.error("Meeting summary is required"); return; }
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", ...checkoutForm }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Checked out"); setShowCheckout(false); loadVisit(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  if (loading) return <PageContainer className="p-6"><p className="text-slate-400">Loading...</p></PageContainer>;
  if (!visit) return <PageContainer className="p-6"><p className="text-slate-400">Visit not found</p></PageContainer>;

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/visits")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.back} size={18} /></button>
          <div><h1 className="text-2xl font-bold text-slate-800">Visit Details</h1><p className="text-sm text-slate-500 mt-0.5">{visit.customer?.name}</p></div>
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[visit.status]}`}>{visit.status.replace("_", " ")}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Customer" value={visit.customer?.name} />
          <Field label="Host" value={visit.host?.name} />
          <Field label="Purpose" value={visit.purpose} />
          <Field label="Priority" value={visit.priority} />
          <Field label="Meeting Type" value={visit.meetingType} />
          <Field label="Source" value={visit.source} />
          <Field label="Department" value={visit.department} />
          <Field label="Check-In Time" value={visit.checkInTime ? new Date(visit.checkInTime).toLocaleString() : "—"} />
          <Field label="Check-Out Time" value={visit.checkOutTime ? new Date(visit.checkOutTime).toLocaleString() : "—"} />
          <div className="md:col-span-2"><Field label="Agenda" value={visit.agenda} full /></div>
        </div>

        {visit.status === "COMPLETED" && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Checkout Details</h3>
            <Field label="Meeting Summary" value={visit.meetingSummary} full />
            <Field label="Outcome" value={visit.outcome} />
            <Field label="Customer Decision" value={visit.customerDecision} />
            {visit.rejectionReason && <Field label="Rejection Reason" value={visit.rejectionReason} />}
            {visit.nextMeetingDate && <Field label="Next Meeting Date" value={new Date(visit.nextMeetingDate).toLocaleString()} />}
            {visit.nextMeetingNotes && <Field label="Next Meeting Notes" value={visit.nextMeetingNotes} full />}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {visit.status === "PLANNED" && (
          <button onClick={handleCheckIn} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"><Ico d={icons.check} size={16} /> Check In</button>
        )}
        {visit.status === "CHECKED_IN" && (
          <button onClick={() => setShowCheckout(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer"><Ico d={icons.check} size={16} /> Check Out</button>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800">Check Out</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Summary *</label>
              <textarea value={checkoutForm.meetingSummary} onChange={(e) => setCheckoutForm({ ...checkoutForm, meetingSummary: e.target.value })} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Outcome</label>
              <input type="text" value={checkoutForm.outcome} onChange={(e) => setCheckoutForm({ ...checkoutForm, outcome: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Decision</label>
              <select value={checkoutForm.customerDecision} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerDecision: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 cursor-pointer">
                <option value="">-- Select --</option>
                <option>Interested</option><option>Needs Time</option><option>Rejected</option><option>Next Meeting</option>
              </select>
            </div>
            {checkoutForm.customerDecision === "Rejected" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rejection Reason</label>
                <input type="text" value={checkoutForm.rejectionReason} onChange={(e) => setCheckoutForm({ ...checkoutForm, rejectionReason: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Next Meeting Date</label>
              <input type="date" value={checkoutForm.nextMeetingDate} onChange={(e) => setCheckoutForm({ ...checkoutForm, nextMeetingDate: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Next Meeting Notes</label>
              <textarea value={checkoutForm.nextMeetingNotes} onChange={(e) => setCheckoutForm({ ...checkoutForm, nextMeetingNotes: e.target.value })} rows={2} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCheckout(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={handleCheckOut} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer">Complete Check Out</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return <div className={full ? "md:col-span-2" : ""}><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p><p className="text-sm text-slate-800">{value || "—"}</p></div>;
}
