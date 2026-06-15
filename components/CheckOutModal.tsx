"use client";

import { useState, useEffect } from "react";
import { checkOutInboundAction, checkOutOutboundAction } from "@/app/actions/visits";

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onCheckInNext?: (type: "Inbound" | "Outbound") => void;
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

// ── Common CRM Pipeline Outcomes ──────────────────────────────
const COMMON_OUTCOMES = [
  { value: "Follow-up Required",  label: "📅 Follow-up Required", color: "text-amber-700  bg-amber-50  border-amber-200" },
  { value: "Qualified Lead",      label: "✅ Qualified Lead",     color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "Proposal Needed",     label: "📋 Proposal Needed",    color: "text-[#D44D4D]   bg-red-50   border-red-200" },
  { value: "Negotiation Ongoing", label: "🤝 Negotiation Ongoing", color: "text-purple-700 bg-purple-50 border-purple-200" },
  { value: "Closed Won",          label: "🏆 Closed Won",         color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "Closed Lost",         label: "❌ Closed Lost",        color: "text-red-700    bg-red-50    border-red-200" },
];

function getOutcomes(purpose: string) {
  return COMMON_OUTCOMES;
}

// Outcomes that need follow-up scheduling
const FOLLOWUP_OUTCOMES = new Set(["Follow-up Required", "Proposal Needed", "Negotiation Ongoing"]);
// Outcomes that close the deal (won)
const WON_OUTCOMES = new Set(["Closed Won"]);
// Outcomes that close the deal (lost)
const LOST_OUTCOMES = new Set(["Closed Lost"]);
// Purposes where the portal decision toggle is relevant
const PORTAL_DECISION_PURPOSES = new Set(["New Enquiry", "Sales Meeting", "Product Demo", "Sales Pitch", "Demo", "Pricing Discussion", "Follow-up Meeting", "Other"]);

export default function CheckOutModal({ isOpen, onClose, onSuccess, onCheckInNext, visit }: CheckOutModalProps) {
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [checkedOutName, setCheckedOutName] = useState("");

  const [meetingNotes, setMeetingNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [customerDecision, setCustomerDecision] = useState("PENDING");
  const [rejectionReason, setRejectionReason] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [nextMeetingNotes, setNextMeetingNotes] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [escalationTarget, setEscalationTarget] = useState("");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [confirmClosedWon, setConfirmClosedWon] = useState(false);

  // GPS for Outbound checkout
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  const fetchGPS = () => {
    setLocation(null);
    setLocError("");
    setLocLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
        err => { setLocError("GPS capture failed. You may retry or proceed without location."); setLocLoading(false); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocError("Geolocation not supported by this browser.");
      setLocLoading(false);
    }
  };

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && visit) {
      setErrorMsg("");
      setCheckoutDone(false);
      setCheckedOutName("");
      setMeetingNotes("");
      setCustomerDecision("PENDING");
      setRejectionReason("");
      setNextMeetingDate("");
      setNextMeetingNotes("");
      setLossReason("");
      setEscalationTarget("");
      setEscalationNotes("");
      setConfirmClosedWon(false);
      setLocation(null);

      // Default first outcome
      const opts = getOutcomes(visit.purpose);
      setOutcome(opts[0]?.value || "Follow-up Required");

      if (visit.visitType === "Outbound") {
        fetchGPS();
      }
    }
  }, [isOpen, visit]);

  // Reset conditional fields when outcome changes
  useEffect(() => {
    setNextMeetingDate("");
    setNextMeetingNotes("");
    setLossReason("");
    setEscalationTarget("");
    setEscalationNotes("");
    setConfirmClosedWon(false);
  }, [outcome]);

  if (!isOpen || !visit) return null;

  // ── POST-CHECKOUT SUCCESS SCREEN ──────────────────────────────────
  if (checkoutDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Success header */}
          <div className="bg-[#D44D4D] px-6 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white font-black text-lg">Checked Out!</h2>
            <p className="text-white mt-1 font-medium">{checkedOutName} — visit logged successfully</p>
          </div>

          {/* Next action prompt */}
          <div className="p-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center mb-4">Check-in to another office?</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  onClose();
                  onCheckInNext?.("Inbound");
                }}
                className="flex flex-col items-center justify-center bg-[#D44D4D] text-white p-5 rounded-2xl active:scale-95 transition-transform gap-2 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-xs font-black tracking-wide">+ Office Visit</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onCheckInNext?.("Outbound");
                }}
                className="flex flex-col items-center justify-center bg-[#151515] text-white p-5 rounded-2xl active:scale-95 transition-transform gap-2 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-black tracking-wide">+ Field Visit</span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              No, I'm done for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  const outcomes = getOutcomes(visit.purpose);
  const needsFollowUp = FOLLOWUP_OUTCOMES.has(outcome);
  const isWon = WON_OUTCOMES.has(outcome);
  const isLost = LOST_OUTCOMES.has(outcome);
  const isEscalated = outcome === "Escalated";
  const showPortalDecision = PORTAL_DECISION_PURPOSES.has(visit.purpose) && !isLost;

  const handleValidationAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!meetingNotes.trim()) {
      setErrorMsg("Meeting summary is required.");
      return;
    }
    if (needsFollowUp && !nextMeetingDate) {
      setErrorMsg("Next meeting date is required for this outcome.");
      return;
    }
    if (isLost && !lossReason.trim()) {
      setErrorMsg("Loss reason is required when closing as lost.");
      return;
    }
    if (isEscalated && !escalationTarget) {
      setErrorMsg("Escalation target is required when escalating.");
      return;
    }
    if (customerDecision === "REJECTED" && !rejectionReason.trim()) {
      setErrorMsg("Rejection reason is required.");
      return;
    }

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

    // Build combined meeting notes with structured outcome context
    let fullNotes = meetingNotes.trim();
    if (isLost && lossReason) fullNotes += `\n\n[Loss Reason]: ${lossReason}`;
    if (isEscalated && escalationTarget) fullNotes += `\n\n[Escalated To]: ${escalationTarget}${escalationNotes ? ` — ${escalationNotes}` : ""}`;

    try {
      let res;
      if (visit.visitType === "Inbound") {
        res = await checkOutInboundAction({
          id: visit.id,
          meetingSummary: fullNotes,
          outcome,
          customerDecision: showPortalDecision ? customerDecision : "PENDING",
          rejectionReason: customerDecision === "REJECTED" ? rejectionReason.trim() : undefined,
          nextMeetingDate: nextMeetingDate || undefined,
          nextMeetingNotes: nextMeetingNotes.trim() || undefined,
        });
      } else {
        res = await checkOutOutboundAction({
          id: visit.id,
          meetingDescription: fullNotes,
          outcome,
          customerDecision: showPortalDecision ? customerDecision : "PENDING",
          rejectionReason: customerDecision === "REJECTED" ? rejectionReason.trim() : undefined,
          nextMeetingDate: nextMeetingDate || undefined,
          nextMeetingNotes: nextMeetingNotes.trim() || undefined,
          checkOutLat: location?.lat,
          checkOutLng: location?.lng,
        });
      }

      if (res.success) {
        setCheckedOutName(visit.customerName);
        setCheckoutDone(true);
        onSuccess();
      } else {
        setErrorMsg(res.message || "Failed to process checkout.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] text-slate-700 font-medium transition-all";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {visit.visitType === "Inbound" ? "🏢 End Office Visit" : "📍 Field Visit Check-Out"} / Log Meeting
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {visit.visitType === "Inbound" ? "Capture visit end, outcome, and decisions" : "Record field meeting outcomes and status"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleValidationAndSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-4 flex-1">

              {/* Active Visit Info */}
              <div className="p-4 border border-red-100 bg-red-50/40 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#C94F4F] uppercase tracking-wider">Active Visit</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{visit.customerName}</p>
                  <p className="text-xs text-slate-500 font-semibold">{visit.customerCode} · {visit.visitType} · {visit.purpose}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Started At</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{new Date(visit.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>

              {/* Outbound GPS check-out */}
              {visit.visitType === "Outbound" && (
                <div className="p-3.5 border rounded-2xl bg-slate-50 border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Check-Out Coordinates</p>
                    {locLoading && (
                      <p className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin shrink-0" />
                        Capturing GPS coordinates...
                      </p>
                    )}
                    {location && (
                      <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                        Locked: {location.lat.toFixed(5)}°N, {location.lng.toFixed(5)}°E
                      </p>
                    )}
                    {locError && <p className="text-xs font-medium text-amber-600">⚠️ {locError}</p>}
                  </div>
                  <button type="button" onClick={fetchGPS} className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700 transition-colors shrink-0">
                    Retry GPS
                  </button>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center">
                  {errorMsg}
                </div>
              )}

              {/* Meeting Summary */}
              <div>
                <label className={labelCls}>Meeting Summary / Discussion Details <span className="text-red-400">*</span></label>
                <textarea rows={3} required placeholder="Detail what was discussed, decisions made, follow-up actions, key points raised..." value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)}
                  className={inputCls + " resize-none"} />
              </div>

              {/* Outcome Selection */}
              <div>
                <label className={labelCls}>Meeting Outcome <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {outcomes.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setOutcome(opt.value)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${outcome === opt.value ? opt.color + " ring-2 ring-offset-1 ring-current/30" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow-up scheduling — required for certain outcomes */}
              {needsFollowUp && (
                <div className="bg-amber-50/60 p-4 border border-amber-100 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Schedule Next Meeting
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date & Time <span className="text-red-400">*</span></label>
                      <input type="datetime-local" required={needsFollowUp} value={nextMeetingDate} onChange={e => setNextMeetingDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none" />
                    </div>
                    <div>
                      <label className={labelCls}>Meeting Agenda</label>
                      <input type="text" placeholder="Agenda for next meeting..." value={nextMeetingNotes} onChange={e => setNextMeetingNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none text-slate-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Closed Won — confirm customer promotion */}
              {isWon && outcome === "Closed Won" && (
                <div className="bg-emerald-50/60 p-4 border border-emerald-100 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2">🏆 Deal Closed Won</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={confirmClosedWon} onChange={e => setConfirmClosedWon(e.target.checked)} className="w-4 h-4 rounded text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-700">Confirm: Promote customer to Active status in CRM</span>
                  </label>
                </div>
              )}

              {/* Closed Lost — loss reason required */}
              {isLost && (
                <div className="bg-red-50/60 p-4 border border-red-100 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black text-red-700 uppercase tracking-wider mb-2">❌ Deal Closed Lost</p>
                  <div>
                    <label className={labelCls}>Loss Reason <span className="text-red-400">*</span></label>
                    <input type="text" required={isLost} placeholder="Why did the customer not proceed? (budget, competitor, timing...)" value={lossReason} onChange={e => setLossReason(e.target.value)}
                      className={inputCls} />
                  </div>
                </div>
              )}

              {/* Escalated — target required */}
              {isEscalated && (
                <div className="bg-red-50/60 p-4 border border-red-100 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">⬆️ Escalation Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Escalate To <span className="text-red-400">*</span></label>
                      <select required={isEscalated} value={escalationTarget} onChange={e => setEscalationTarget(e.target.value)} className={inputCls} onFocus={() => {
                        if (!escalationTarget) {
                          import("@/app/actions/users").then(m => m.getUsersAction()).then(res => {
                            if (res.success && res.data) {
                              const opts = res.data.filter((u: any) => u.role !== "Customer").map((u: any) => `${u.name} (${u.role})`);
                              setEscalationTarget(opts[0] || "Admin");
                              const sel = document.getElementById("esc-select") as HTMLSelectElement;
                              if (sel) {
                                sel.innerHTML = `<option value="">Select target...</option>` + opts.map((o: string) => `<option value="${o}">${o}</option>`).join("");
                              }
                            }
                          });
                        }
                      }} id="esc-select">
                        <option value="">Select target... (Click to load)</option>
                        <option>Admin</option>
                        <option>Marketing Lead</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Escalation Notes</label>
                      <input type="text" placeholder="Additional context..." value={escalationNotes} onChange={e => setEscalationNotes(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              {/* Portal Decision — only shown for relevant purposes */}
              {showPortalDecision && (
                <div>
                  <label className={labelCls}>Customer Portal Access Decision <span className="text-red-400">*</span></label>
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
                    {[["APPROVED", "Approve ✓", "text-emerald-600"], ["REJECTED", "Reject ✗", "text-red-600"], ["PENDING", "Pending", "text-slate-800"]].map(([val, lbl, color]) => (
                      <label key={val} className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${customerDecision === val ? `bg-white ${color} shadow-sm` : "text-slate-500"}`}>
                        <input type="radio" value={val} checked={customerDecision === val} onChange={() => setCustomerDecision(val)} className="hidden" />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {customerDecision === "REJECTED" && showPortalDecision && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className={labelCls}>Rejection Reason <span className="text-red-400">*</span></label>
                  <input type="text" required placeholder="Reason for rejecting portal access..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="px-7 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D44D4D] hover:bg-[#C94F4F] transition-colors shadow-sm disabled:opacity-75 flex items-center gap-2 cursor-pointer">
                {formLoading ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Processing...</>
                ) : (visit.visitType === "Inbound" ? "✓ End Visit" : "✓ Submit Check-Out")}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-4 mx-auto border border-amber-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 text-center">Confirm Customer Status Change</h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Are you sure you want to <strong>{customerDecision === "APPROVED" ? "APPROVE" : "REJECT"}</strong> portal access for {visit.customerName}?
              {customerDecision === "APPROVED" ? " This will send an account activation link to their email." : " This will log the rejection and block portal login."}
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={executeCheckout} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-950 transition-colors">
                Yes, confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
