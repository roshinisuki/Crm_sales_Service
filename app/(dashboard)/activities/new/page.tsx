"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCallAction, createMeetingAction, createNoteAction, createEmailAction } from "@/app/actions/activities";
import { getLeadByIdAction } from "@/app/actions/leads";
import { getFollowUpByIdAction, completeFollowUpWithActivityAction, updateFollowUpStatusAction } from "@/app/actions/followUps";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { ArrowLeft, Save, Phone, Video, StickyNote, User, Building2, Mail, Info, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type ActivityType = "call" | "meeting" | "note" | "email";

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
  const [linkedFollowUp, setLinkedFollowUp] = useState<any>(null);
  const [markCompleteEarly, setMarkCompleteEarly] = useState(false);

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
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", direction: "Outbound" });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load linked follow-up and lead or deal from URL params
  useEffect(() => {
    if (urlFollowUpId) {
      getFollowUpByIdAction(urlFollowUpId).then(res => {
        if (res.success && res.data) {
          const fu = res.data;
          setLinkedFollowUp(fu);
          
          // Pre-fill type
          const mappedType = fu.type ? (fu.type.toLowerCase() as ActivityType) : urlType;
          setActivityType(mappedType);

          // Pre-fill form state
          if (mappedType === "call") {
            setCallForm(prev => ({
              ...prev,
              content: fu.remarks || fu.notes || "",
              status: fu.status === "Overdue" ? "NoAnswer" : "Completed",
            }));
          } else if (mappedType === "meeting") {
            // format nextMeetingDate for datetime-local (YYYY-MM-DDTHH:MM)
            let formattedDate = "";
            if (fu.nextMeetingDate) {
              const d = new Date(fu.nextMeetingDate);
              const pad = (n: number) => String(n).padStart(2, "0");
              formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
            setMeetingForm(prev => ({
              ...prev,
              meetingDate: formattedDate,
              agenda: fu.agenda || fu.remarks || fu.notes || "",
              location: fu.location || "",
              mode: fu.mode || "Virtual",
              status: fu.status === "Completed" ? "Completed" : "Scheduled",
            }));
          }
        }
      });
    }

    if (urlLeadId) {
      getLeadByIdAction(urlLeadId).then(res => {
        if (res.success && res.data) setLinkedLead(res.data);
      });
    }
  }, [urlLeadId, urlFollowUpId, urlType]);

  // Validation
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (activityType === "call") {
      if (!callForm.direction) e.direction = "Direction is required";
      if (!callForm.duration || parseInt(callForm.duration) < 1) e.duration = "Duration must be at least 1 minute";
      if (callForm.status === "Completed") {
        if (callForm.content.trim().length < 10) e.content = "Notes must be at least 10 characters";
      }
    } else if (activityType === "meeting") {
      if (!isFollowUpLinked) {
        if (!meetingForm.meetingDate) e.meetingDate = "Meeting date is required";
        if (!meetingForm.mode) e.mode = "Mode is required";
        if (meetingForm.agenda.trim().length < 20) e.agenda = "Agenda must be at least 20 characters";
      }
      
      const isMeetingDatePassed = meetingForm.meetingDate ? new Date(meetingForm.meetingDate) < new Date() : false;
      const isTerminatedStatus = meetingForm.status === "Missed" || meetingForm.status === "Cancelled";
      const isCompletedState = !isTerminatedStatus && (meetingForm.status === "Completed" || isMeetingDatePassed || markCompleteEarly);
      
      if (isCompletedState && !meetingForm.outcome?.trim()) {
        e.outcome = "Outcome is required for completed meetings";
      }
    } else if (activityType === "note") {
      if (noteForm.content.trim().length < 10) e.content = "Note must be at least 10 characters";
    } else if (activityType === "email") {
      if (emailForm.subject.trim().length < 3) e.subject = "Subject is required";
      if (emailForm.body.trim().length < 10) e.body = "Email body must be at least 10 characters";
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
      let res: any;
      let followUpCompleted = false;
      if (activityType === "call") {
        if (isFollowUpLinked) {
          if (callForm.status === "Missed" || callForm.status === "Cancelled") {
            res = await updateFollowUpStatusAction({ id: urlFollowUpId, status: callForm.status });
            followUpCompleted = res.success;
          } else {
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
          }
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
          if (meetingForm.status === "Missed" || meetingForm.status === "Cancelled") {
            res = await updateFollowUpStatusAction({ id: urlFollowUpId, status: meetingForm.status });
            followUpCompleted = res.success;
          } else {
            res = await completeFollowUpWithActivityAction({
              followUpId: urlFollowUpId,
              activityType: "Meeting",
              content: meetingForm.content || meetingForm.agenda || meetingForm.outcome,
              meetingDate: meetingForm.meetingDate,
              location: meetingForm.location || undefined,
              mode: meetingForm.mode,
              agenda: meetingForm.agenda || undefined,
              outcome: meetingForm.outcome || undefined,
              status: meetingForm.status,
            });
            followUpCompleted = res.success;
          }
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
      } else if (activityType === "email") {
        res = await createEmailAction({
          leadId: urlLeadId || null,
          subject: emailForm.subject,
          body: emailForm.body,
          direction: emailForm.direction,
        });
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

        const returnTo = searchParams.get("returnTo");
        if (returnTo) {
          router.push(returnTo);
          return;
        }

        const leadId = urlLeadId;
        const dealId = urlDealId;

        if (activityType === "call") {
          setOverlay({
            open: true,
            message: followUpCompleted
              ? `Call recorded & follow-up completed. Outcome: ${callForm.outcome}`
              : `Call recorded: ${callForm.duration} min, Outcome: ${callForm.outcome}`,
            primary: { label: "Create Follow-Up", href: `/follow-up/new?leadId=${leadId}`, icon: <Phone size={16} /> },
            secondary: { label: "Start Qualification", href: `/leads/${leadId}?tab=bant&action=qualify`, icon: <CheckCircle2 size={16} /> },
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
        } else if (activityType === "email") {
          setOverlay({
            open: true,
            message: `Email logged: ${emailForm.subject}`,
            primary: { label: "View All Emails", href: "/activities?type=Email", icon: <Mail size={16} /> },
            secondary: { label: "Back to Activities", href: "/activities" },
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
      {isFollowUpLinked && activityType === type && (
        <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 ml-1.5 shrink-0">
          Linked to follow-up
        </span>
      )}
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

  const isMeetingDatePassed = meetingForm.meetingDate ? new Date(meetingForm.meetingDate) < new Date() : false;
  const isTerminatedStatus = meetingForm.status === "Missed" || meetingForm.status === "Cancelled";
  const showOutcomeField = !isTerminatedStatus && (meetingForm.status === "Completed" || isMeetingDatePassed || markCompleteEarly);

  return (
    <PageShell title="Log Activity" subtitle="Record a call, meeting, email, or note."
      action={
        <Link href="/activities" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        {/* Linked Follow-up Info Card */}
        {linkedFollowUp && (
          <div className="mb-5 flex items-center gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-800 text-sm">
            <Info size={16} className="text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">Linked Follow-up:</span>{" "}
              {new Date(linkedFollowUp.nextMeetingDate).toLocaleString()} &mdash; {linkedFollowUp.type || "Call"}
              {linkedFollowUp.remarks && <p className="text-xs text-blue-600/90 mt-0.5 truncate">{linkedFollowUp.remarks}</p>}
            </div>
          </div>
        )}

        {/* Type selector */}
        <div className="flex items-center gap-3 mb-6">
          <TypeButton type="call" icon={<Phone size={16} />} label="Call" />
          <TypeButton type="meeting" icon={<Video size={16} />} label="Meeting" />
          <TypeButton type="email" icon={<Mail size={16} />} label="Email" />
          <TypeButton type="note" icon={<StickyNote size={16} />} label="Note" />
        </div>

        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {/* Auto-filled linked entity */}
          <LinkedEntityDisplay />          {/* ── CALL FORM ── */}
          {activityType === "call" && (
            <>
              {isFollowUpLinked ? (
                /* Linked Follow-up Call Details */
                <div className="space-y-4">
                  {/* Reference Card */}
                  {linkedFollowUp && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <Phone size={16} className="text-[var(--primary)] text-orange-500" />
                          Linked Follow-up Details
                        </span>
                        <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          {linkedFollowUp.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-605">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Date & Time</span>
                          <span className="text-slate-750">{new Date(linkedFollowUp.nextMeetingDate).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Priority</span>
                          <span className="text-slate-750">{linkedFollowUp.priority || "Medium"}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-400 font-bold uppercase block mb-1">Scheduled Notes</span>
                        <p className="text-xs text-slate-650 leading-relaxed font-medium bg-white p-3 border border-slate-200 rounded-xl">
                          {linkedFollowUp.remarks || linkedFollowUp.notes || "No scheduled notes."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Call Completion Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Direction" required>
                      <Select value={callForm.direction} onChange={(e) => setCallForm(f => ({ ...f, direction: e.target.value }))}>
                        <option value="Outbound">Outbound</option>
                        <option value="Inbound">Inbound</option>
                      </Select>
                    </FormField>
                    <FormField label="Duration (minutes)" required>
                      <Input type="number" value={callForm.duration} onChange={(e) => setCallForm(f => ({ ...f, duration: e.target.value }))} placeholder="15" />
                      {errors.duration && <p className="text-xs text-red-500 mt-1">{errors.duration}</p>}
                    </FormField>
                    <FormField label="Call Status" required>
                      <Select value={callForm.status} onChange={(e) => setCallForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="Completed">Completed (Happened)</option>
                        <option value="NoAnswer">No Answer</option>
                        <option value="Scheduled">Scheduled (Not Completed)</option>
                        <option value="Missed">Missed</option>
                        <option value="Cancelled">Cancelled</option>
                      </Select>
                    </FormField>
                    {callForm.status === "Completed" && (
                      <FormField label="Outcome" required>
                        <Select value={callForm.outcome} onChange={(e) => setCallForm(f => ({ ...f, outcome: e.target.value }))}>
                          <option value="Interested">Interested</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="Call Back">Call Back</option>
                          <option value="Quote Requested">Quote Requested</option>
                        </Select>
                      </FormField>
                    )}
                  </div>
                </div>
              ) : (
                /* Ad-hoc Call Form */
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
              )}

              {/* Call Notes / Outcome */}
              {(callForm.status === "Completed" || !isFollowUpLinked) && (
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
              )}
            </>
          )}

          {/* ── MEETING FORM ── */}
          {activityType === "meeting" && (
            <>
              {isFollowUpLinked ? (
                /* Linked Follow-up Meeting Details */
                <div className="space-y-4">
                  {/* Reference Card */}
                  {linkedFollowUp && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <Video size={16} className="text-[var(--primary)] text-blue-500" />
                          Linked Follow-up Details
                        </span>
                        <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          {linkedFollowUp.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Date & Time</span>
                          <span className="text-slate-700">{new Date(linkedFollowUp.nextMeetingDate).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Mode</span>
                          <span className="text-slate-700">{linkedFollowUp.mode || "Virtual"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Location</span>
                          <span className="text-slate-700">{linkedFollowUp.location || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-1">Priority</span>
                          <span className="text-slate-700">{linkedFollowUp.priority || "Medium"}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-400 font-bold uppercase block mb-1">Agenda</span>
                        <p className="text-xs text-slate-655 leading-relaxed font-medium bg-white p-3 border border-slate-200 rounded-xl">
                          {linkedFollowUp.agenda || linkedFollowUp.remarks || "No agenda notes."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Meeting Completion Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Meeting Status" required>
                      <Select 
                        value={meetingForm.status} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setMeetingForm(f => ({ ...f, status: val }));
                          if (val === "Completed") setMarkCompleteEarly(true);
                          else if (val === "Scheduled") setMarkCompleteEarly(false);
                        }}
                      >
                        <option value="Scheduled">Scheduled (Not Completed)</option>
                        <option value="Completed">Completed (Happened)</option>
                        <option value="Missed">Missed</option>
                        <option value="Cancelled">Cancelled</option>
                      </Select>
                    </FormField>
                  </div>
                </div>
              ) : (
                /* Ad-hoc Meeting Form */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Meeting Date & Time" required>
                      <Input 
                        type="datetime-local" 
                        value={meetingForm.meetingDate} 
                        onChange={(e) => setMeetingForm(f => ({ ...f, meetingDate: e.target.value }))} 
                      />
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
                </>
              )}

              {/* State machine: conditional outcome view */}
              {!showOutcomeField ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 mt-4">
                  <div className="flex items-center gap-2.5 text-xs text-slate-505 font-semibold">
                    <Calendar size={14} className="text-slate-400" />
                    <span>Meeting scheduled for a future date. Outcome fields will be editable once the meeting starts.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMarkCompleteEarly(true);
                      setMeetingForm(prev => ({ ...prev, status: "Completed" }));
                    }}
                    className="btn-primary text-[11px] px-3.5 py-1.5 whitespace-nowrap"
                  >
                    Log outcome now
                  </button>
                </div>
              ) : (
                <FormField label="Outcome (Required)" required>
                  <textarea
                    value={meetingForm.outcome}
                    onChange={(e) => setMeetingForm(f => ({ ...f, outcome: e.target.value }))}
                    placeholder="What was decided..."
                    rows={3}
                    className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${errors.outcome ? "border-red-300" : "border-slate-200"}`}
                  />
                  {errors.outcome && <p className="text-xs text-red-500 mt-1">{errors.outcome}</p>}
                </FormField>
              )}
            </>
          )}

          {/* ── EMAIL FORM ── */}
          {activityType === "email" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Subject" required>
                  <Input value={emailForm.subject} onChange={(e) => setEmailForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject" />
                  {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
                </FormField>
                <FormField label="Direction" required>
                  <Select value={emailForm.direction} onChange={(e) => setEmailForm(f => ({ ...f, direction: e.target.value }))}>
                    <option value="Outbound">Outbound</option>
                    <option value="Inbound">Inbound</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Email Body" required>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your email here (min 10 chars)..."
                  rows={6}
                  className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${errors.body ? "border-red-300" : "border-slate-200"}`}
                />
                {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body}</p>}
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
