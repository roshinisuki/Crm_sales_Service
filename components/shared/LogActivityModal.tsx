"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/ui-utils";

interface LogActivityModalProps {
  open: boolean;
  onClose: () => void;
  relatedType: string;
  relatedId: string;
  preselectedType?: string;
  onLogged?: () => void;
}

const ACTIVITY_TYPES = [
  { value: "Call", icon: "📞", label: "Call" },
  { value: "Email", icon: "📧", label: "Email" },
  { value: "WhatsApp", icon: "💬", label: "WhatsApp" },
  { value: "Meeting", icon: "🤝", label: "Meeting" },
  { value: "Note", icon: "📝", label: "Note" },
];

const CALL_OUTCOMES = ["Connected", "No Answer", "Busy", "Wrong Number"];
const CALL_DIRECTIONS = ["Inbound", "Outbound"];

export function LogActivityModal({
  open,
  onClose,
  relatedType,
  relatedId,
  preselectedType,
  onLogged,
}: LogActivityModalProps) {
  const [activityType, setActivityType] = useState<string>(preselectedType || "Call");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [performedAt, setPerformedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Call-specific
  const [direction, setDirection] = useState("Outbound");
  const [callOutcome, setCallOutcome] = useState("Connected");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");

  // Email-specific
  const [emailSubject, setEmailSubject] = useState("");
  const [bodyPreview, setBodyPreview] = useState("");

  // WhatsApp-specific
  const [whatsappTemplate, setWhatsappTemplate] = useState("");

  // Meeting-specific
  const [location, setLocation] = useState("");
  const [meetingStatus, setMeetingStatus] = useState("Scheduled");
  const [attendeeContacts, setAttendeeContacts] = useState<string[]>([]);
  const [attendeeUsers, setAttendeeUsers] = useState<string[]>([]);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedType) setActivityType(preselectedType);
  }, [preselectedType]);

  // Fetch contacts for meeting attendees when relatedType is Account/Customer
  useEffect(() => {
    if (activityType === "Meeting" && (relatedType === "Account" || relatedType === "Customer") && relatedId) {
      fetch(`/api/contacts?customerId=${relatedId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAvailableContacts(data.data || []);
        })
        .catch(() => {});
    }
    if (activityType === "Meeting") {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAvailableUsers(data.data || []);
        })
        .catch(() => {});
    }
  }, [activityType, relatedType, relatedId]);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        channel: activityType,
        related_to_type: relatedType,
        related_to_id: relatedId,
        subject: subject || undefined,
        content: content || undefined,
        performed_at: performedAt ? new Date(performedAt).toISOString() : undefined,
      };

      if (activityType === "Call") {
        payload.direction = direction;
        payload.outcome = callOutcome;
        payload.duration_minutes = durationMinutes || undefined;
        payload.status = callOutcome;
      } else if (activityType === "Email") {
        payload.email_subject = emailSubject;
        payload.body_preview = bodyPreview;
        payload.status = "Sent";
      } else if (activityType === "WhatsApp") {
        payload.status = "Delivered";
        if (whatsappTemplate) payload.template = whatsappTemplate;
      } else if (activityType === "Meeting") {
        payload.location = location || undefined;
        payload.meeting_status = meetingStatus;
        payload.contact_ids = attendeeContacts;
        payload.user_ids = attendeeUsers;
      }

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Failed to log activity");
        return;
      }

      // Reset form
      setSubject("");
      setContent("");
      setEmailSubject("");
      setBodyPreview("");
      setLocation("");
      setAttendeeContacts([]);
      setAttendeeUsers([]);
      setDurationMinutes("");

      onLogged?.();
      onClose();
    } catch {
      setError("Failed to log activity");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Log Activity</h3>
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

          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Activity Type</label>
            <div className="flex gap-2 flex-wrap">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setActivityType(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                    activityType === t.value
                      ? "border-orange-300 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Common: Subject/Title */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Subject / Title</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief subject for this activity"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {/* Related-to (pre-filled, read-only) */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-400">Related to:</span>
            <span className="text-xs font-medium text-slate-600 px-2 py-0.5 bg-slate-100 rounded-full">
              {relatedType} · {relatedId.substring(0, 8)}...
            </span>
          </div>

          {/* Performed at */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Performed At</label>
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {/* Type-specific fields */}
          {activityType === "Call" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    {CALL_DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Outcome</label>
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Duration (minutes)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </>
          )}

          {activityType === "Email" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Email Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Body Preview</label>
                <textarea
                  value={bodyPreview}
                  onChange={(e) => setBodyPreview(e.target.value)}
                  placeholder="First few lines of the email..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </>
          )}

          {activityType === "WhatsApp" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Template</label>
              <input
                type="text"
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                placeholder="Template name (optional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          )}

          {activityType === "Meeting" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Meeting location"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Meeting Status</label>
                <select
                  value={meetingStatus}
                  onChange={(e) => setMeetingStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              {availableContacts.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Attendees (Contacts)</label>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {availableContacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={attendeeContacts.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAttendeeContacts([...attendeeContacts, c.id]);
                            else setAttendeeContacts(attendeeContacts.filter((id) => id !== c.id));
                          }}
                          className="rounded border-slate-300"
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {availableUsers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Attendees (Users)</label>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {availableUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={attendeeUsers.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAttendeeUsers([...attendeeUsers, u.id]);
                            else setAttendeeUsers(attendeeUsers.filter((id) => id !== u.id));
                          }}
                          className="rounded border-slate-300"
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Content / Notes (all types except Note which uses it as the main field) */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              {activityType === "Note" ? "Description" : "Notes / Content"}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={activityType === "Note" ? "Enter your note..." : "Activity details, outcome, key points..."}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
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
            disabled={submitting || !content.trim()}
            className="px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : "Log Activity"}
          </button>
        </div>
      </div>
    </div>
  );
}
