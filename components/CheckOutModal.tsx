"use client";

import { useState, useEffect } from "react";
import { checkOutInboundAction, checkOutOutboundAction } from "@/app/actions/visits";

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visit: {
    id: string;
    customerId: string;
    customerName: string;
    customerCode: string;
    visitType: "Inbound" | "Outbound";
    purpose: string;
    checkInTime: string;
  } | null;
}

export default function CheckOutModal({
  isOpen,
  onClose,
  onSuccess,
  visit,
}: CheckOutModalProps) {
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Input States
  const [meetingNotes, setMeetingNotes] = useState("");
  const [outcome, setOutcome] = useState("Interested");
  const [customerDecision, setCustomerDecision] = useState("PENDING");
  const [rejectionReason, setRejectionReason] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [nextMeetingNotes, setNextMeetingNotes] = useState("");

  // GPS Outbound check-out
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Nested Confirmation Dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && visit) {
      setErrorMsg("");
      setMeetingNotes("");
      setOutcome("Interested");
      setCustomerDecision("PENDING");
      setRejectionReason("");
      setNextMeetingDate("");
      setNextMeetingNotes("");
      setLocation(null);

      // Fetch checkout GPS if outbound
      if (visit.visitType === "Outbound") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Checkout GPS error ignored", err),
            { timeout: 5000 }
          );
        }
      }
    }
  }, [isOpen, visit]);

  if (!isOpen || !visit) return null;

  const isNextMeetingRequired = ["Follow-up Required", "Pending Decision"].includes(outcome);

  const handleValidationAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validate fields
    if (!meetingNotes.trim()) {
      setErrorMsg("Meeting summary / description is required.");
      return;
    }

    if (isNextMeetingRequired && !nextMeetingDate) {
      setErrorMsg("Next meeting date is required for the selected outcome.");
      return;
    }

    if (customerDecision === "REJECTED" && !rejectionReason.trim()) {
      setErrorMsg("Rejection reason is required when rejecting a customer.");
      return;
    }

    // Trigger confirmation dialog for Approve / Reject decisions
    if (customerDecision === "APPROVED" || customerDecision === "REJECTED") {
      setShowConfirm(true);
    } else {
      executeCheckout();
    }
  };

  const executeCheckout = async () => {
    setFormLoading(true);
    setErrorMsg("");
    setShowConfirm(false);

    try {
      let res;
      if (visit.visitType === "Inbound") {
        res = await checkOutInboundAction({
          id: visit.id,
          meetingSummary: meetingNotes.trim(),
          outcome,
          customerDecision,
          rejectionReason: customerDecision === "REJECTED" ? rejectionReason.trim() : undefined,
          nextMeetingDate: nextMeetingDate || undefined,
          nextMeetingNotes: nextMeetingNotes.trim() || undefined,
        });
      } else {
        res = await checkOutOutboundAction({
          id: visit.id,
          meetingDescription: meetingNotes.trim(),
          outcome,
          customerDecision,
          rejectionReason: customerDecision === "REJECTED" ? rejectionReason.trim() : undefined,
          nextMeetingDate: nextMeetingDate || undefined,
          nextMeetingNotes: nextMeetingNotes.trim() || undefined,
          checkOutLat: location?.lat,
          checkOutLng: location?.lng,
        });
      }

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Failed to process checkout.");
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-base font-bold text-slate-800">Check-Out Visit / Log Meeting</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Capturing meeting summary, outcomes and portal decision</p>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleValidationAndSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Check-In Summary Info Card */}
              <div className="p-4 border border-blue-100 bg-blue-50/40 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#1a6bff] uppercase tracking-wider">Active Visit Information</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{visit.customerName}</p>
                  <p className="text-xs text-slate-500 font-semibold">{visit.customerCode} • {visit.visitType} Visit ({visit.purpose})</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked In At</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{new Date(visit.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center animate-shake">
                  {errorMsg}
                </div>
              )}

              {/* Description Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Meeting Summary / Discussion Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail what was discussed, core issues raised, plan name interested in, subscription queries, support solutions, etc..."
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 resize-none font-medium"
                />
              </div>

              {/* Outcome Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Meeting Outcome <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none text-slate-700 font-semibold"
                  >
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Follow-up Required">Follow-up Required</option>
                    <option value="Pending Decision">Pending Decision</option>
                    <option value="Converted">Converted</option>
                  </select>
                </div>

                {/* Customer Decision (Portal Master Approvals) */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Customer Portal Access <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
                    <label className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${customerDecision === "APPROVED" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"}`}>
                      <input type="radio" value="APPROVED" checked={customerDecision === "APPROVED"} onChange={() => setCustomerDecision("APPROVED")} className="hidden" />
                      Approve
                    </label>
                    <label className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${customerDecision === "REJECTED" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}>
                      <input type="radio" value="REJECTED" checked={customerDecision === "REJECTED"} onChange={() => setCustomerDecision("REJECTED")} className="hidden" />
                      Reject
                    </label>
                    <label className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${customerDecision === "PENDING" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                      <input type="radio" value="PENDING" checked={customerDecision === "PENDING"} onChange={() => setCustomerDecision("PENDING")} className="hidden" />
                      Pending
                    </label>
                  </div>
                </div>
              </div>

              {/* Conditional Rejection Reason */}
              {customerDecision === "REJECTED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter reason for rejection (e.g. invalid contact, not qualified)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-semibold"
                  />
                </div>
              )}

              {/* Conditional Follow-up / Next Meeting Fields */}
              {isNextMeetingRequired && (
                <div className="bg-amber-50/50 p-4 border border-amber-100 rounded-2xl space-y-3.5 animate-in slide-in-from-top-3 duration-200">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Required: Schedule Next Meeting
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Date & Time *</label>
                      <input
                        type="datetime-local"
                        required={isNextMeetingRequired}
                        value={nextMeetingDate}
                        onChange={(e) => setNextMeetingDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Meeting Agenda</label>
                      <input
                        type="text"
                        placeholder="Agenda: Contract pricing discussion..."
                        value={nextMeetingNotes}
                        onChange={(e) => setNewCustNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-75"
              >
                {formLoading ? "Recording Checkout..." : "Submit Check-Out"}
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-4 mx-auto border border-amber-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 text-center">Confirm Customer Status Change</h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Are you sure you want to {customerDecision === "APPROVED" ? "APPROVE portal access for" : "REJECT"} this customer? 
              {customerDecision === "APPROVED" 
                ? " This will trigger an automated account activation link to their email."
                : " This will block portal log-ins and log the rejection details."}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                No, review
              </button>
              <button
                onClick={executeCheckout}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-950 transition-colors"
              >
                Yes, proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Helper alias to handle typo
  function setNewCustNotes(val: string) {
    setNextMeetingNotes(val);
  }
}
