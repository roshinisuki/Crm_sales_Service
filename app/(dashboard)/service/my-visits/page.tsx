"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, X, Calendar, CheckCircle, AlertTriangle, 
  Clock, MapPin, User, ShieldAlert, Award, Package, Hammer, Inbox, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";

export default function MyVisitsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [engineerId, setEngineerId] = useState<string | null>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  
  // Checkout Modal states
  const [completeModal, setCompleteModal] = useState<any>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("Resolved");
  const [reasonNextSteps, setReasonNextSteps] = useState("");
  const [followUpVisitNeeded, setFollowUpVisitNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [sparePartsUsed, setSparePartsUsed] = useState<{ productId: string; name: string; quantity: number }[]>([]);

  // Elapsed Timer state
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [elapsedTimeText, setElapsedTimeText] = useState("");

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const url = engineerId ? `/api/service/visits?engineerId=${engineerId}` : "/api/service/visits";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVisits(data);
        
        // Find if there is an in-progress visit
        const inProg = data.find((v: any) => v.status?.name === "In Progress");
        setActiveVisit(inProg || null);
      }
    } catch (e) {
      console.error("Error fetching engineer visits:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Resolve current user's engineer profile
    if (user?.id) {
      fetch("/api/service/engineer-profile")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.id) setEngineerId(data.id);
        })
        .catch(() => {});
    }
    fetchVisits();
    // Fetch products for parts catalog
    fetch("/api/catalogue/products")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setProducts(json.data || []);
      })
      .catch((err) => console.error("Error fetching products:", err));
  }, [user?.id]);

  // Re-fetch visits when engineerId is resolved
  useEffect(() => {
    if (engineerId) fetchVisits();
  }, [engineerId]);

  // Live Timer for active visit
  useEffect(() => {
    if (activeVisit && activeVisit.checkInTime) {
      const updateTimer = () => {
        const checkIn = new Date(activeVisit.checkInTime).getTime();
        const diffMs = new Date().getTime() - checkIn;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsedTimeText(`On-site: ${hours > 0 ? `${hours}h ` : ""}${mins}m`);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    } else {
      setElapsedTimeText("");
    }
  }, [activeVisit]);

  const handleCheckIn = async (visitId: string) => {
    setCheckingInId(visitId);
    
    const triggerCheckIn = async (lat?: number, lng?: number, gpsCaptured = false) => {
      try {
        const res = await fetch(`/api/service/visits/${visitId}/check-in`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, gpsCaptured }),
        });
        if (res.ok) {
          toast.success("Check-in successful! Your status has been updated to 'In Progress'.");
          await fetchVisits();
        } else {
          const err = await res.json();
          toast.error(`Check-in failed: ${err.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingInId(null);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          triggerCheckIn(position.coords.latitude, position.coords.longitude, true);
        },
        (error) => {
          console.warn("Geolocation denied/failed. Checking in without GPS.", error);
          triggerCheckIn(undefined, undefined, false);
        },
        { timeout: 8000 }
      );
    } else {
      triggerCheckIn(undefined, undefined, false);
    }
  };

  const handleComplete = async () => {
    if (!outcomeNotes.trim() || outcomeNotes.trim().length < 5) {
      toast.error("Please describe the work performed (at least 5 characters).");
      return;
    }
    
    const requiresNextSteps = ["Escalated", "Follow-up Required", "Parts Pending"].includes(selectedOutcome);
    if (requiresNextSteps && (!reasonNextSteps || reasonNextSteps.trim().length < 10)) {
      toast.error(`Reason / next steps details are required for outcome '${selectedOutcome}' (min 10 characters).`);
      return;
    }

    if (selectedOutcome === "Parts Pending" && sparePartsUsed.length === 0) {
      toast.error("At least one spare part item must be listed when the outcome is 'Parts Pending'.");
      return;
    }

    setCompleting(true);
    try {
      const body = {
        outcome: selectedOutcome,
        outcomeNotes: outcomeNotes.trim(),
        sparePartsUsed: sparePartsUsed.map(p => ({ productId: p.productId, quantity: p.quantity })),
        reasonNextSteps: reasonNextSteps.trim(),
        followUpVisitNeeded,
        followUpDate: followUpVisitNeeded ? followUpDate : null,
      };

      const res = await fetch(`/api/service/visits/${completeModal.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        toast.success("Visit completed successfully!");
        setCompleteModal(null);
        setOutcomeNotes("");
        setSelectedOutcome("Resolved");
        setReasonNextSteps("");
        setFollowUpVisitNeeded(false);
        setFollowUpDate("");
        setSparePartsUsed([]);
        await fetchVisits();
      } else {
        const err = await res.json();
        toast.error(`Failed to complete: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  };

  // Split visits into active list and history
  const activeList = useMemo(() => {
    return visits.filter(v => v.status?.name !== "Completed" && v.status?.name !== "Closed");
  }, [visits]);

  const historyList = useMemo(() => {
    return visits.filter(v => v.status?.name === "Completed" || v.status?.name === "Closed");
  }, [visits]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-2">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">My Field Service Visits</h1>
        <p className="text-xs text-[var(--text-muted)]">Check in to assigned jobs and log service outcomes.</p>
      </div>

      {/* Active Visit Banner */}
      {activeVisit && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-[var(--text-primary)] space-y-3 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">Active Work in Progress</span>
              <h2 className="text-sm font-black">{activeVisit.title}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{activeVisit.customer?.name}</p>
            </div>
            <span className="text-xs font-bold text-amber-500 bg-amber-500/20 px-2.5 py-1 rounded-lg shrink-0 animate-pulse">
              {elapsedTimeText || "Checked In"}
            </span>
          </div>
          <button
            onClick={() => setCompleteModal(activeVisit)}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <CheckCircle size={14} /> Checkout & Complete Work
          </button>
        </div>
      )}

      {/* Lists Tabs */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
          <Clock size={14} className="text-blue-500" /> Upcoming Tasks & Schedule
        </h3>

        {loading ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)] animate-pulse">Loading visits...</div>
        ) : activeList.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)]">
            No scheduled visits assigned to you today.
          </div>
        ) : (
          <div className="space-y-3.5">
            {activeList.map((visit) => {
              const statusName = visit.status?.name || "";
              const isInProgress = statusName === "In Progress";
              const canCheckIn = !isInProgress && statusName !== "Completed" && statusName !== "Closed";
              const hasActiveOtherVisit = activeVisit && activeVisit.id !== visit.id;

              return (
                <div key={visit.id} className={cn(
                  "rounded-2xl border p-4 space-y-3 backdrop-blur-md transition-all",
                  isInProgress
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-slate-500/30"
                )}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{visit.visitCode}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide",
                          statusName === "Overdue"     ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          isInProgress               ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                       "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        )}>
                          {statusName || "New"}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-[var(--text-primary)]">{visit.title}</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Client: <span className="font-semibold text-[var(--text-primary)]">{visit.customer?.name}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--surface-2)] p-2.5 rounded-xl border border-[var(--border)]">
                    <div className="space-y-0.5">
                      <span className="text-[var(--text-secondary)] block">Schedule Time</span>
                      <span className="text-[var(--text-primary)] font-bold flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Not Set"}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[var(--text-secondary)] block">Asset</span>
                      <span className="text-[var(--text-primary)] font-bold truncate block">
                        {visit.customerAsset?.productName || "Unknown Product"}
                      </span>
                    </div>
                  </div>

                  {/* Check In button — show for any non-in-progress visit when no other visit is active */}
                  {canCheckIn && !hasActiveOtherVisit && (
                    <button
                      onClick={() => handleCheckIn(visit.id)}
                      disabled={checkingInId === visit.id}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      {checkingInId === visit.id ? "Checking In..." : "✅ Check In to Site"}
                    </button>
                  )}

                  {/* Checkout button — show on the in-progress card itself */}
                  {isInProgress && (
                    <button
                      onClick={() => setCompleteModal(visit)}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle size={14} /> Checkout & Complete Work
                    </button>
                  )}

                  {/* Blocked message when another visit is active */}
                  {canCheckIn && hasActiveOtherVisit && (
                    <p className="text-[10px] text-amber-600 text-center py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      ⚠️ Complete your current active visit before checking in here.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History List */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
          <CheckCircle size={14} className="text-green-500" /> Completed Jobs History
        </h3>

        {loading ? null : historyList.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">No past completed visits logged yet.</div>
        ) : (
          <div className="space-y-3.5">
            {historyList.map((visit) => (
              <div key={visit.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 opacity-80">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono text-[var(--text-muted)]">{visit.visitCode}</span>
                  <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">COMPLETED</span>
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)]">{visit.title}</h4>
                <p className="text-xs text-[var(--text-secondary)]">Client: <span className="font-semibold text-[var(--text-primary)]">{visit.customer?.name}</span></p>
                <div className="text-[11px] bg-[var(--surface-2)] p-2 rounded-xl text-[var(--text-secondary)] border border-[var(--border)]">
                  <div><strong>Outcome:</strong> {visit.outcomeNotes || "No outcome logged"}</div>
                  {visit.completedAt && (
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">Finished: {new Date(visit.completedAt).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--text-primary)]">Checkout & Complete Visit</h3>
              <button 
                onClick={() => { 
                  setCompleteModal(null); 
                  setOutcomeNotes(""); 
                  setSelectedOutcome("Resolved");
                  setReasonNextSteps("");
                  setFollowUpVisitNeeded(false);
                  setFollowUpDate("");
                  setSparePartsUsed([]);
                }} 
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="font-bold">{completeModal.visitCode}</span> — {completeModal.customer?.name}
              </div>

              {/* Outcome */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Outcome *</label>
                <select
                  value={selectedOutcome}
                  onChange={(e) => setSelectedOutcome(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="Resolved">Resolved</option>
                  <option value="Partially Resolved">Partially Resolved</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Follow-up Required">Follow-up Required</option>
                  <option value="Parts Pending">Parts Pending</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Work Performed Description (Min 20 chars) *</label>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={3}
                  placeholder="Actions taken, root cause found, parts replaced, work status..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className={cn(
                    "text-[10px]",
                    outcomeNotes.trim().length < 5 ? "text-red-500" : "text-green-500"
                  )}>
                    {outcomeNotes.trim().length < 5
                      ? `Type ${5 - outcomeNotes.trim().length} more character(s) to enable submit`
                      : "✓ Ready to submit"}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{outcomeNotes.length} chars</span>
                </div>
              </div>

              {/* Conditionally Required Details */}
              {["Escalated", "Follow-up Required", "Parts Pending"].includes(selectedOutcome) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Reason & Next Steps (Min 10 chars) *</label>
                  <textarea
                    value={reasonNextSteps}
                    onChange={(e) => setReasonNextSteps(e.target.value)}
                    rows={2}
                    placeholder="Specify action plan, missing parts, or escalation reason..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              )}

              {/* Spare Parts */}
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Spare Parts Used {selectedOutcome === "Parts Pending" && <span className="text-red-500">*</span>}
                </label>
                
                <div className="flex gap-2">
                  <select
                    id="eng-part-select"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-primary)]"
                  >
                    <option value="">-- Select Product Part --</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    id="eng-part-qty"
                    type="number"
                    defaultValue="1"
                    min="1"
                    className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById("eng-part-select") as HTMLSelectElement;
                      const qty = document.getElementById("eng-part-qty") as HTMLInputElement;
                      if (sel && sel.value) {
                        const prod = products.find(p => p.id === sel.value);
                        if (prod) {
                          setSparePartsUsed(prev => [...prev, { productId: prod.id, name: prod.name, quantity: parseInt(qty.value) || 1 }]);
                          sel.value = "";
                          qty.value = "1";
                        }
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
                  >
                    Add
                  </button>
                </div>

                {sparePartsUsed.length > 0 && (
                  <div className="space-y-1 bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)]">
                    {sparePartsUsed.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-primary)]">x{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setSparePartsUsed(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-up Visit */}
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="engFollowUp"
                    checked={followUpVisitNeeded}
                    onChange={(e) => setFollowUpVisitNeeded(e.target.checked)}
                    className="rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="engFollowUp" className="font-bold text-[var(--text-primary)]">Follow-up Field Visit Required?</label>
                </div>

                {followUpVisitNeeded && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Follow-up Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                onClick={() => { 
                  setCompleteModal(null); 
                  setOutcomeNotes(""); 
                  setSelectedOutcome("Resolved");
                  setReasonNextSteps("");
                  setFollowUpVisitNeeded(false);
                  setFollowUpDate("");
                  setSparePartsUsed([]);
                }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={completing || outcomeNotes.trim().length < 5}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {completing ? "Completing..." : "Check Out & Complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
