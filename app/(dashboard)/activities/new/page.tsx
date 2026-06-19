"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCallAction, createMeetingAction, createNoteAction } from "@/app/actions/activities";
import { completeFollowUpWithActivityAction } from "@/app/actions/followUps";
import { getLeadByIdAction } from "@/app/actions/leads";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { ArrowLeft, Save, Phone, Video, StickyNote, User, Building2 } from "lucide-react";
import Link from "next/link";

type ActivityType = "call" | "meeting" | "note";

function NewActivityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const urlLeadId = searchParams.get("leadId") || "";
  const urlDealId = searchParams.get("dealId") || "";
  const urlFollowUpId = searchParams.get("followUpId") || "";
  const urlType = (searchParams.get("type") || "call").toLowerCase() as ActivityType;

  // If arriving from a follow-up, the activity type is locked to the follow-up's type
  const isFollowUpLinked = !!urlFollowUpId;

  const [activityType, setActivityType] = useState<ActivityType>(urlType);
  const [saving, setSaving] = useState(false);
  const [linkedLead, setLinkedLead] = useState<any>(null);
  const [linkedDeal, setLinkedDeal] = useState<any>(null);

  // Success overlay state
  const [overlay, setOverlay] = useState<{ open: boolean; message: string; primary: SuccessAction; secondary?: SuccessAction; alternate?: SuccessAction }>({
    open: false, message: "", primary: { label: "", href: "" },
  });

  // Form state
  const [callForm, setCallForm] = useState({
    direction: "Outbound", duration: "15", content: "", status: "Completed", outcome: "Interested",
  });
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "", location: "", mode: "In-person", agenda: "", outcome: "", content: "", status: "Scheduled",
  });
  const [noteForm, setNoteForm] = useState({ content: "" });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load linked lead or deal from URL params
  useEffect(() => {
    if (urlLeadId) {
      getLeadByIdAction(urlLeadId).then(res => {
        if (res.success && res.data) setLinkedLead(res.data);
      });
    }
  }, [urlLeadId]);

  // Validation
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (activityType === "call") {
      if (!callForm.direction) e.direction = "Direction is required";
      if (!callForm.duration || parseInt(callForm.duration) < 1) e.duration = "Duration must be at least 1 minute";
      if (callForm.content.trim().length < 10) e.content = "Notes must be at least 10 characters";
    } else if (activityType === "meeting") {
      if (!meetingForm.meetingDate) e.meetingDate = "Meeting date is required";
      if (!meetingForm.mode) e.mode = "Mode is required";
      if (meetingForm.agenda.trim().length < 20) e.agenda = "Agenda must be at least 20 characters";
    } else if (activityType === "note") {
      if (noteForm.content.trim().length < 10) e.content = "Note must be at least 10 characters";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the validation errors.");
      return;
    }
    setSaving(true);
    try {
      let res;
      let followUpCompleted = false;
      if (activityType === "call") {
        if (isFollowUpLinked) {
          // Complete follow-up with Call activity — creates CommunicationLog + marks follow-up Completed
          res = await completeFollowUpWithActivityAction({
            followUpId: urlFollowUpId,
            activityType: "Call",
            content: callForm.content,
            direction: callForm.direction,
            duration: callForm.duration ? parseInt(callForm.duration) : null,
            status: callForm.status,
          });
          followUpCompleted = res.success;
        } else {
          res = await createCallAction({
            leadId: urlLeadId || null,
            dealId: urlDealId || null,
            direction: callForm.direction,
            duration: callForm.duration ? parseInt(callForm.duration) : null,
            content: callForm.content,
            status: callForm.status,
          });
        }
      } else if (activityType === "meeting") {
        if (isFollowUpLinked) {
          res = await completeFollowUpWithActivityAction({
            followUpId: urlFollowUpId,
            activityType: "Meeting",
            content: meetingForm.content || meetingForm.agenda,
            meetingDate: meetingForm.meetingDate,
            location: meetingForm.location || undefined,
            mode: meetingForm.mode,
            agenda: meetingForm.agenda || undefined,
            outcome: meetingForm.outcome || undefined,
            status: meetingForm.status,
          });
          followUpCompleted = res.success;
        } else {
          res = await createMeetingAction({
            leadId: urlLeadId || null,
            dealId: urlDealId || null,
            meetingDate: meetingForm.meetingDate,
            location: meetingForm.location || undefined,
            mode: meetingForm.mode,
            agenda: meetingForm.agenda || undefined,
            outcome: meetingForm.outcome || undefined,
            content: meetingForm.content || null,
            status: meetingForm.status,
          });
        }
      } else {
        if (isFollowUpLinked) {
          res = await completeFollowUpWithActivityAction({
            followUpId: urlFollowUpId,
            activityType: "Note",
            content: noteForm.content,
            status: "Completed",
          });
          followUpCompleted = res.success;
        } else {
          const entityId = urlLeadId || urlDealId || "";
          const entityType = urlLeadId ? "LEAD" : urlDealId ? "DEAL" : "LEAD";
          res = await createNoteAction({ entityType, entityId, content: noteForm.content });
        }
      }

      if (res.success) {
        toast.success(`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} logged successfully!${followUpCompleted ? " Follow-up completed." : ""}`);

        const leadId = urlLeadId;
        const dealId = urlDealId;

        if (activityType === "call") {
          setOverlay({
            open: true,
            message: followUpCompleted
              ? `Call recorded & follow-up completed. Outcome: ${callForm.outcome}`
              : `Call recorded: ${callForm.duration} min, Outcome: ${callForm.outcome}`,
            primary: { label: "Create Follow-Up", href: `/follow-up/new?leadId=${leadId}`, icon: <Phone size={16} /> },
            secondary: { label: "View All Calls", href: "/activities?type=Call" },
            alternate: { label: "Back to Lead", href: `/leads/${leadId}` },
          });
        } else if (activityType === "meeting") {
          setOverlay({
            open: true,
            message: `Meeting logged: ${meetingForm.mode}`,
            primary: dealId
              ? { label: "Update Stage", href: `/sales-pipeline/${dealId}`, icon: <Video size={16} /> }
              : { label: "Schedule Demo", href: `/activities/new?leadId=${leadId}&type=Meeting`, icon: <Video size={16} /> },
            secondary: { label: "View All Meetings", href: "/activities?type=Meeting" },
            alternate: dealId ? { label: "Back to Opportunity", href: `/sales-pipeline/${dealId}` } : { label: "Back to Lead", href: `/leads/${leadId}` },
          });
        } else {
          setOverlay({
            open: true,
            message: `Note added to timeline`,
            primary: dealId
              ? { label: "Back to Opportunity", href: `/sales-pipeline/${dealId}`, icon: <StickyNote size={16} /> }
              : { label: "Back to Lead", href: `/leads/${leadId}`, icon: <StickyNote size={16} /> },
            secondary: { label: "View All Activities", href: "/activities" },
          });
        }
      } else {
        toast.error(res.message || "Failed to save");
        setSaving(false);
      }
    } catch {
      toast.error("An error occurred");
      setSaving(false);
    }
  };

  const TypeButton = ({ type, icon, label }: { type: ActivityType; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => !isFollowUpLinked && setActivityType(type)}
      disabled={isFollowUpLinked && activityType !== type}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
        activityType === type
          ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]"
          : isFollowUpLinked
            ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {icon} {label}
      {isFollowUpLinked && activityType === type && <span className="text-[10px] text-slate-400 ml-1">(locked)</span>}
    </button>
  );

  // Auto-filled linked entity display
  const LinkedEntityDisplay = () => {
    if (linkedLead) {
      return (
        <FormField label="Linked Lead (auto-filled)">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <User size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-700">{linkedLead.name}</span>
            {linkedLead.companyName && <span className="text-xs text-slate-400">— {linkedLead.companyName}</span>}
          </div>
        </FormField>
      );
    }
    if (urlDealId) {
      return (
        <FormField label="Linked Opportunity (auto-filled)">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <Building2 size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-700">Opportunity ID: {urlDealId}</span>
          </div>
        </FormField>
      );
    }
    return null;
  };

  return (
    <PageShell title="Log Activity" subtitle="Record a call, meeting, or note."
      action={
        <Link href="/activities" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        {/* Type selector */}
        <div className="flex items-center gap-3 mb-6">
          <TypeButton type="call" icon={<Phone size={16} />} label="Call" />
          <TypeButton type="meeting" icon={<Video size={16} />} label="Meeting" />
          <TypeButton type="note" icon={<StickyNote size={16} />} label="Note" />
        </div>

        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {/* Auto-filled linked entity */}
          <LinkedEntityDisplay />

          {/* ── CALL FORM ── */}
          {activityType === "call" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Direction" required>
                  <Select value={callForm.direction} onChange={(e) => setCallForm(f => ({ ...f, direction: e.target.value }))}>
                    <option value="Outbound">Outbound</option>
                    <option value="Inbound">Inbound</option>
                  </Select>
                  {errors.direction && <p className="text-xs text-red-500 mt-1">{errors.direction}</p>}
                </FormField>
                <FormField label="Duration (minutes)" required>
                  <Input type="number" value={callForm.duration} onChange={(e) => setCallForm(f => ({ ...f, duration: e.target.value }))} placeholder="15" />
                  {errors.duration && <p className="text-xs text-red-500 mt-1">{errors.duration}</p>}
                </FormField>
                <FormField label="Outcome" required>
                  <Select value={callForm.outcome} onChange={(e) => setCallForm(f => ({ ...f, outcome: e.target.value }))}>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Call Back">Call Back</option>
                    <option value="Quote Requested">Quote Requested</option>
                  </Select>
                </FormField>
                <FormField label="Status">
                  <Select value={callForm.status} onChange={(e) => setCallForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="Completed">Completed</option>
                    <option value="NoAnswer">No Answer</option>
                    <option value="Scheduled">Scheduled</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Call Notes" required>
                <textarea
                  value={callForm.content}
                  onChange={(e) => setCallForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="What was discussed..."
                  rows={4}
                  className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${errors.content ? "border-red-300" : "border-slate-200"}`}
                />
                {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}
              </FormField>
            </>
          )}

          {/* ── MEETING FORM ── */}
          {activityType === "meeting" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Meeting Date & Time" required>
                  <Input type="datetime-local" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm(f => ({ ...f, meetingDate: e.target.value }))} />
                  {errors.meetingDate && <p className="text-xs text-red-500 mt-1">{errors.meetingDate}</p>}
                </FormField>
                <FormField label="Mode" required>
                  <Select value={meetingForm.mode} onChange={(e) => setMeetingForm(f => ({ ...f, mode: e.target.value }))}>
                    <option value="In-person">In-person</option>
                    <option value="Virtual">Virtual</option>
                  </Select>
                  {errors.mode && <p className="text-xs text-red-500 mt-1">{errors.mode}</p>}
                </FormField>
                <FormField label="Location">
                  <Input value={meetingForm.location} onChange={(e) => setMeetingForm(f => ({ ...f, location: e.target.value }))} placeholder="Conference Room A / Zoom link" />
                </FormField>
                <FormField label="Status">
                  <Select value={meetingForm.status} onChange={(e) => setMeetingForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Agenda" required>
                <textarea
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm(f => ({ ...f, agenda: e.target.value }))}
                  placeholder="Meeting agenda (min 20 chars)..."
                  rows={3}
                  className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${errors.agenda ? "border-red-300" : "border-slate-200"}`}
                />
                {errors.agenda && <p className="text-xs text-red-500 mt-1">{errors.agenda}</p>}
              </FormField>
              <FormField label="Outcome">
                <textarea
                  value={meetingForm.outcome}
                  onChange={(e) => setMeetingForm(f => ({ ...f, outcome: e.target.value }))}
                  placeholder="What was decided..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                />
              </FormField>
            </>
          )}

          {/* ── NOTE FORM ── */}
          {activityType === "note" && (
            <FormField label="Note Content" required>
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write your note here (min 10 chars)..."
                rows={6}
                className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${errors.content ? "border-red-300" : "border-slate-200"}`}
              />
              {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}
            </FormField>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/activities" className="btn-secondary text-sm">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? "Saving…" : <><Save size={14} /> Save {activityType}</>}
            </button>
          </div>
        </div>
      </div>

      {/* Success Overlay */}
      <SuccessOverlay
        open={overlay.open}
        message={overlay.message}
        primary={overlay.primary}
        secondary={overlay.secondary}
        alternate={overlay.alternate}
        onClose={() => setOverlay(o => ({ ...o, open: false }))}
      />
    </PageShell>
  );
}

export default function NewActivityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading...</div>}>
      <NewActivityPageInner />
    </Suspense>
  );
}
