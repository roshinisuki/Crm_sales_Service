"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/ui-utils";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { FormGrid, FormButton } from "@/components/ui/FormLayout";

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
    <Modal
      open={open}
      onClose={onClose}
      title="Log Activity"
      size="md"
      footer={
        <>
          <FormButton variant="secondary" onClick={onClose}>Cancel</FormButton>
          <FormButton
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
          >
            {submitting ? "Saving..." : "Log Activity"}
          </FormButton>
        </>
      }
    >
      <div className="p-5 space-y-4">
        {error && (
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
            {error}
          </div>
        )}

        {/* Type selector */}
        <div>
          <label className="form-label">Activity Type</label>
          <div className="flex gap-2 flex-wrap">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setActivityType(t.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                  activityType === t.value
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                )}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Common: Subject/Title */}
        <FormField label="Subject / Title">
          <Input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief subject for this activity"
          />
        </FormField>

        {/* Related-to (pre-filled, read-only) */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--text-tertiary)]">Related to:</span>
          <span className="text-xs font-medium text-[var(--text-secondary)] px-2 py-0.5 bg-[var(--surface-2)] rounded-full">
            {relatedType} · {relatedId.substring(0, 8)}...
          </span>
        </div>

        {/* Performed at */}
        <FormField label="Performed At">
          <Input
            type="datetime-local"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
          />
        </FormField>

        {/* Type-specific fields */}
        {activityType === "Call" && (
          <>
            <FormGrid>
              <FormField label="Direction">
                <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
                  {CALL_DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </FormField>
              <FormField label="Outcome">
                <Select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                  {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </FormField>
            </FormGrid>
            <FormField label="Duration (minutes)">
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="e.g. 15"
              />
            </FormField>
          </>
        )}

        {activityType === "Email" && (
          <>
            <FormField label="Email Subject">
              <Input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line"
              />
            </FormField>
            <FormField label="Body Preview">
              <Textarea
                value={bodyPreview}
                onChange={(e) => setBodyPreview(e.target.value)}
                placeholder="First few lines of the email..."
                rows={3}
              />
            </FormField>
          </>
        )}

        {activityType === "WhatsApp" && (
          <FormField label="Template">
            <Input
              type="text"
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              placeholder="Template name (optional)"
            />
          </FormField>
        )}

        {activityType === "Meeting" && (
          <>
            <FormField label="Location">
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Meeting location"
              />
            </FormField>
            <FormField label="Meeting Status">
              <Select value={meetingStatus} onChange={(e) => setMeetingStatus(e.target.value)}>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </Select>
            </FormField>
            {availableContacts.length > 0 && (
              <FormField label="Attendees (Contacts)">
                <div className="max-h-32 overflow-y-auto border border-[var(--border)] rounded-lg p-2 space-y-1 bg-[var(--surface-2)]">
                  {availableContacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--surface-1)] px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={attendeeContacts.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setAttendeeContacts([...attendeeContacts, c.id]);
                          else setAttendeeContacts(attendeeContacts.filter((id) => id !== c.id));
                        }}
                        className="rounded border-[var(--border)]"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </FormField>
            )}
            {availableUsers.length > 0 && (
              <FormField label="Attendees (Users)">
                <div className="max-h-32 overflow-y-auto border border-[var(--border)] rounded-lg p-2 space-y-1 bg-[var(--surface-2)]">
                  {availableUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--surface-1)] px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={attendeeUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setAttendeeUsers([...attendeeUsers, u.id]);
                          else setAttendeeUsers(attendeeUsers.filter((id) => id !== u.id));
                        }}
                        className="rounded border-[var(--border)]"
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </FormField>
            )}
          </>
        )}

        {/* Content / Notes (all types except Note which uses it as the main field) */}
        <FormField label={activityType === "Note" ? "Description" : "Notes / Content"}>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={activityType === "Note" ? "Enter your note..." : "Activity details, outcome, key points..."}
            rows={4}
          />
        </FormField>
      </div>
    </Modal>
  );
}
