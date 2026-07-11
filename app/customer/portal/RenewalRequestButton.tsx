"use client";

import { useState, useTransition } from "react";
import { createCustomerRenewalRequestAction } from "@/app/actions/visits";

const Ico = ({ d, size = 14, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17",
  x: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7"
};

export default function RenewalRequestButton({ planName }: { planName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0] // Default to tomorrow
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!startDate) {
      setError("Please select a desired start date.");
      return;
    }

    startTransition(async () => {
      const res = await createCustomerRenewalRequestAction({ planName, notes, startDate });
      if (res.success) {
        setSuccess("Renewal request submitted successfully!");
        setNotes("");
        setTimeout(() => {
          setIsOpen(false);
          setSuccess("");
        }, 1500);
      } else {
        setError(res.message || "Failed to submit renewal request.");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-secondary)] rounded-xl transition-all shadow-sm"
      >
        <Ico d={icons.refresh} size={13} className="text-[var(--text-muted)]" />
        Request Renewal
      </button>

      {/* RENEWAL REQUEST MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto text-left">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-sm" 
              onClick={() => !isPending && setIsOpen(false)}
            />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-[var(--surface)] rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[var(--border)]">
              <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Request Plan Renewal</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Submit a renewal enquiry for {planName}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center transition-colors"
                >
                  <Ico d={icons.x} size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 font-medium flex items-center gap-2">
                    <Ico d={icons.check} size={16} className="text-emerald-600" />
                    {success}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Selected Plan</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={planName}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-medium text-[var(--text-muted)] cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Desired Renewal Start Date</label>
                  <input
                    type="date"
                    required
                    disabled={isPending}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field w-full px-4 py-2.5 rounded-xl transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Special Requests or Notes (Optional)</label>
                  <textarea
                    disabled={isPending}
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe any plan modifications, discount requests, or payment queries..."
                    className="input-field w-full px-4 py-2.5 rounded-xl transition-all resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 bg-[var(--primary)] text-[var(--accent-contrast)] rounded-xl text-sm font-bold hover:bg-[var(--primary-hover)] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Renewal Request"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
