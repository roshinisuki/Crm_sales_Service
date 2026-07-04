"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/ui-utils";

interface CompleteFollowUpModalProps {
  open: boolean;
  onClose: () => void;
  followUpId: string;
  followUpType?: string | null;
  onCompleted?: () => void;
}

const FOLLOWUP_TYPES = [
  { value: "Call", label: "Call" },
  { value: "Meeting", label: "Meeting" },
  { value: "Email", label: "Email" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Visit", label: "Visit" },
  { value: "Note", label: "Note" },
];

function getDefaultNextDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CompleteFollowUpModal({
  open,
  onClose,
  followUpId,
  followUpType,
  onCompleted,
}: CompleteFollowUpModalProps) {
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [scheduleNext, setScheduleNext] = useState(true);
  const [nextType, setNextType] = useState(followUpType || "Call");
  const [nextDatetime, setNextDatetime] = useState(getDefaultNextDatetime());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = outcomeNotes.trim().length;
  const canSubmit = charCount >= 5 && !submitting;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        outcome_notes: outcomeNotes.trim(),
        schedule_next: scheduleNext,
      };

      if (scheduleNext) {
        payload.next_type = nextType;
        payload.next_datetime = new Date(nextDatetime).toISOString();
      }

      const res = await fetch(`/api/followups/${followUpId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Failed to complete follow-up");
        return;
      }

      // Reset
      setOutcomeNotes("");
      setScheduleNext(true);
      setNextDatetime(getDefaultNextDatetime());

      onCompleted?.();
      onClose();
    } catch {
      setError("Failed to complete follow-up");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Complete Follow-Up</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}

          {/* Outcome notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Outcome Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="Describe the outcome of this follow-up (min 5 characters)..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <div className="flex items-center justify-between mt-1">
              <span className={cn("text-[11px]", charCount > 0 && charCount < 5 ? "text-amber-600" : "text-slate-400")}>
                {charCount < 5 ? `${5 - charCount} more character${5 - charCount !== 1 ? "s" : ""} needed` : "Minimum met"}
              </span>
              <span className="text-[11px] text-slate-400">{charCount} chars</span>
            </div>
          </div>

          {/* Schedule Next toggle */}
          <div className="border border-slate-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="rounded border-slate-300 w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">Schedule Next Follow-Up</span>
            </label>

            {scheduleNext && (
              <div className="mt-3 space-y-3 pl-6">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Follow-Up Type</label>
                  <select
                    value={nextType}
                    onChange={(e) => setNextType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    {FOLLOWUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={nextDatetime}
                    onChange={(e) => setNextDatetime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {submitting ? "Completing..." : "Complete Follow-Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
