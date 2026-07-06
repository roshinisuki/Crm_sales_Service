"use client";

/**
 * LeadCreatedWorkflowModal
 * ─────────────────────────────────────────────────────────────────────────────
 * A 2-step guided wizard that fires immediately after a lead is created.
 *
 * Step 1 — Lead Created confirmation
 * Step 2 — Log Activity (Call / Meeting / Note / Email) or skip
 *
 * Visit planning is intentionally excluded here — customer visits belong
 * later in the lifecycle (after lead qualification or conversion to Account),
 * not at lead creation time.
 *
 * Storage:  Activity is persisted via existing server actions
 */

import { useState } from "react";
import { cn } from "@/lib/ui-utils";
import { useToast } from "@/components/ToastProvider";
import {
  createCallAction,
  createMeetingAction,
  createNoteAction,
  createEmailAction,
} from "@/app/actions/activities";
import {
  CheckCircle2,
  Phone,
  Video,
  StickyNote,
  Mail,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2;
type ActivityType = "call" | "meeting" | "note" | "email";

interface Props {
  open: boolean;
  leadId: string;
  leadCode: string;
  leadName: string;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_OUTCOMES = ["Interested", "Not Interested", "Call Back Later", "No Answer", "Wrong Number"];
const MEETING_MODES = ["In-person", "Virtual", "Hybrid"];

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
          done
            ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
            : active
            ? "bg-[var(--primary)] text-white shadow-md shadow-orange-200"
            : "bg-slate-100 dark:bg-[var(--surface-2)] text-slate-400"
        )}
      >
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
    </div>
  );
}

function StepBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-4">
      <StepDot n={1} active={step === 1} done={step > 1} />
      <div className={cn("h-0.5 flex-1 rounded transition-all duration-500", step > 1 ? "bg-emerald-400" : "bg-slate-200 dark:bg-[var(--border)]")} />
      <StepDot n={2} active={step === 2} done={false} />
      <div className="text-xs text-slate-400 ml-2 whitespace-nowrap">Step {step}/2</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadCreatedWorkflowModal({
  open,
  leadId,
  leadCode,
  leadName,
  onClose,
}: Props) {
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Activity form
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [callForm, setCallForm] = useState({ direction: "Outbound", duration: "15", content: "", outcome: "Interested" });
  const [meetingForm, setMeetingForm] = useState({ meetingDate: "", mode: "In-person", agenda: "", outcome: "", location: "" });
  const [noteForm, setNoteForm] = useState({ content: "" });
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", direction: "Outbound" });
  const [activityErrors, setActivityErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const resetAll = () => {
    setStep(1);
    setActivityType("call");
    setCallForm({ direction: "Outbound", duration: "15", content: "", outcome: "Interested" });
    setMeetingForm({ meetingDate: "", mode: "In-person", agenda: "", outcome: "", location: "" });
    setNoteForm({ content: "" });
    setEmailForm({ subject: "", body: "", direction: "Outbound" });
    setActivityErrors({});
    setSaving(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // ─── Step 2: Save activity ────────────────────────────────────────────────

  const validateActivity = () => {
    const e: Record<string, string> = {};
    if (activityType === "call") {
      if (!callForm.content.trim() || callForm.content.trim().length < 5) e.content = "Please add call notes (min 5 characters)";
      if (!callForm.duration || parseInt(callForm.duration) < 1) e.duration = "Enter a valid duration";
    } else if (activityType === "meeting") {
      if (!meetingForm.meetingDate) e.meetingDate = "Meeting date is required";
      if (!meetingForm.agenda.trim() || meetingForm.agenda.trim().length < 10) e.agenda = "Agenda must be at least 10 characters";
    } else if (activityType === "note") {
      if (!noteForm.content.trim() || noteForm.content.trim().length < 5) e.content = "Note must be at least 5 characters";
    } else if (activityType === "email") {
      if (!emailForm.subject.trim()) e.subject = "Subject is required";
      if (!emailForm.body.trim() || emailForm.body.trim().length < 5) e.body = "Email body is required";
    }
    setActivityErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveActivity = async () => {
    if (!validateActivity()) return;
    setSaving(true);
    try {
      let res: any;
      if (activityType === "call") {
        res = await createCallAction({
          leadId,
          direction: callForm.direction,
          duration: parseInt(callForm.duration),
          content: callForm.content,
          status: "Completed",
        });
      } else if (activityType === "meeting") {
        res = await createMeetingAction({
          leadId,
          meetingDate: meetingForm.meetingDate,
          location: meetingForm.location || undefined,
          mode: meetingForm.mode,
          agenda: meetingForm.agenda,
          outcome: meetingForm.outcome || undefined,
          status: "Scheduled",
        });
      } else if (activityType === "note") {
        res = await createNoteAction({ entityType: "LEAD", entityId: leadId, content: noteForm.content });
      } else {
        res = await createEmailAction({ leadId, subject: emailForm.subject, body: emailForm.body, direction: emailForm.direction });
      }

      if (res.success) {
        toast.success("Activity logged successfully!");
        handleClose();
        // Refresh leads list so the new activity is visible
        if (typeof window !== "undefined") window.dispatchEvent(new Event("leads-refresh"));
      } else {
        toast.error(res.message || "Failed to log activity");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render Helpers ──────────────────────────────────────────────────────────

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );

  const inputCls = (err?: string) =>
    cn(
      "w-full px-3 py-2.5 text-sm rounded-xl border bg-white dark:bg-[var(--surface-2)] text-slate-800 dark:text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 transition-all",
      err
        ? "border-rose-300 focus:ring-rose-300/40"
        : "border-slate-200 dark:border-[var(--border)] focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
    );

  // ─── Step 1: Lead Created ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="px-6 pb-6 space-y-5 animate-fade-in">
      {/* Success banner */}
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-inner">
          <CheckCircle2 size={36} className="text-emerald-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-[var(--text-primary)]">
            Lead Created!
          </h3>
          <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)] mt-1">
            <span className="font-semibold text-[var(--primary)]">{leadCode}</span> — {leadName}
          </p>
        </div>
      </div>

      {/* Prompt */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Zap size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
            Log your first interaction with this lead — a call, meeting, note, or email. Customer visits can be planned later once the lead is qualified.
          </p>
        </div>
      </div>

      {/* Continue to activity */}
      <button
        onClick={() => setStep(2)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-all shadow-md shadow-orange-200/50 dark:shadow-none"
      >
        <Phone size={16} />
        Log First Activity
        <ArrowRight size={14} />
      </button>

      {/* Skip entirely */}
      <button
        onClick={handleClose}
        className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-[var(--text-primary)] transition-colors py-1 underline underline-offset-2"
      >
        Skip — View All Leads
      </button>
    </div>
  );

  // ─── Step 2: Log Activity ─────────────────────────────────────────────────

  const ACTIVITY_TABS: { type: ActivityType; label: string; icon: React.ReactNode }[] = [
    { type: "call",    label: "Call",    icon: <Phone size={14} /> },
    { type: "meeting", label: "Meeting", icon: <Video size={14} /> },
    { type: "note",    label: "Note",    icon: <StickyNote size={14} /> },
    { type: "email",   label: "Email",   icon: <Mail size={14} /> },
  ];

  const renderStep2 = () => (
    <div className="px-6 pb-6 space-y-4 animate-fade-in">
      {/* Activity type tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-[var(--surface-2)] p-1 rounded-xl">
        {ACTIVITY_TABS.map(t => (
          <button
            key={t.type}
            onClick={() => { setActivityType(t.type); setActivityErrors({}); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
              activityType === t.type
                ? "bg-white dark:bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                : "text-slate-500 dark:text-[var(--text-secondary)] hover:text-slate-700"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Call form */}
      {activityType === "call" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Direction">
              <select value={callForm.direction} onChange={e => setCallForm(p => ({ ...p, direction: e.target.value }))} className={inputCls()}>
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </select>
            </Field>
            <Field label="Duration (min)" error={activityErrors.duration}>
              <input type="number" min={1} max={600} value={callForm.duration} onChange={e => setCallForm(p => ({ ...p, duration: e.target.value }))} className={inputCls(activityErrors.duration)} />
            </Field>
          </div>
          <Field label="Outcome">
            <select value={callForm.outcome} onChange={e => setCallForm(p => ({ ...p, outcome: e.target.value }))} className={inputCls()}>
              {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Call Notes *" error={activityErrors.content}>
            <textarea rows={3} placeholder="What was discussed? Any key points…" value={callForm.content} onChange={e => setCallForm(p => ({ ...p, content: e.target.value }))} className={cn(inputCls(activityErrors.content), "resize-none")} />
          </Field>
        </div>
      )}

      {/* Meeting form */}
      {activityType === "meeting" && (
        <div className="space-y-3">
          <Field label="Meeting Date & Time *" error={activityErrors.meetingDate}>
            <input type="datetime-local" value={meetingForm.meetingDate} onChange={e => setMeetingForm(p => ({ ...p, meetingDate: e.target.value }))} className={inputCls(activityErrors.meetingDate)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <select value={meetingForm.mode} onChange={e => setMeetingForm(p => ({ ...p, mode: e.target.value }))} className={inputCls()}>
                {MEETING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Location (optional)">
              <input type="text" placeholder="e.g. Office / Zoom" value={meetingForm.location} onChange={e => setMeetingForm(p => ({ ...p, location: e.target.value }))} className={inputCls()} />
            </Field>
          </div>
          <Field label="Agenda *" error={activityErrors.agenda}>
            <textarea rows={3} placeholder="Meeting agenda (min 10 characters)…" value={meetingForm.agenda} onChange={e => setMeetingForm(p => ({ ...p, agenda: e.target.value }))} className={cn(inputCls(activityErrors.agenda), "resize-none")} />
          </Field>
        </div>
      )}

      {/* Note form */}
      {activityType === "note" && (
        <Field label="Note *" error={activityErrors.content}>
          <textarea rows={4} placeholder="Add a note about this lead…" value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} className={cn(inputCls(activityErrors.content), "resize-none")} />
        </Field>
      )}

      {/* Email form */}
      {activityType === "email" && (
        <div className="space-y-3">
          <Field label="Direction">
            <select value={emailForm.direction} onChange={e => setEmailForm(p => ({ ...p, direction: e.target.value }))} className={inputCls()}>
              <option value="Outbound">Outbound (sent by us)</option>
              <option value="Inbound">Inbound (received)</option>
            </select>
          </Field>
          <Field label="Subject *" error={activityErrors.subject}>
            <input type="text" placeholder="Email subject…" value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} className={inputCls(activityErrors.subject)} />
          </Field>
          <Field label="Body *" error={activityErrors.body}>
            <textarea rows={4} placeholder="Email content summary…" value={emailForm.body} onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))} className={cn(inputCls(activityErrors.body), "resize-none")} />
          </Field>
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:text-[var(--text-secondary)] dark:hover:text-[var(--text-primary)] rounded-xl border border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-all"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          onClick={handleSaveActivity}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-60 transition-all shadow-md shadow-orange-200/50 dark:shadow-none"
        >
          {saving ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          {saving ? "Saving…" : "Log Activity & Done"}
        </button>
      </div>
    </div>
  );

  // ─── Step titles ──────────────────────────────────────────────────────────

  const STEP_TITLES: Record<Step, { title: string; sub: string }> = {
    1: { title: "Lead Created Successfully", sub: "Log your first interaction with this prospect" },
    2: { title: "Log Activity", sub: "Record your first interaction with this lead" },
  };

  const { title, sub } = STEP_TITLES[step];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div
        className="relative bg-white dark:bg-[var(--surface)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ animation: "scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[var(--border)] bg-gradient-to-r from-orange-50 to-white dark:from-orange-950/20 dark:to-[var(--surface)] flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-[var(--text-primary)]">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-[var(--text-secondary)] mt-0.5">{sub}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-white/80 dark:bg-[var(--surface-2)] border border-slate-200 dark:border-[var(--border)] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white transition-all flex-shrink-0 ml-4"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step bar */}
        <StepBar step={step} />

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>
      </div>

      {/* CSS for the scale-in animation */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.93) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease both; }
      `}</style>
    </div>
  );
}
