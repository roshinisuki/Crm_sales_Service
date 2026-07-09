"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { formatDate, formatDateTime, cn, getCheckInWindow } from "@/lib/ui-utils";
import {
  MapPin, CheckCircle, Clock, CalendarClock,
  AlertTriangle, UserPlus, Briefcase, Users, FileText, Navigation,
} from "lucide-react";

const STATUS_PILLS: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  CHECKED_IN: "bg-amber-50 text-amber-700 border-amber-200",
  CHECKED_OUT: "bg-teal-50 text-teal-700 border-teal-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MISSED: "bg-rose-50 text-rose-700 border-rose-200",
  NEEDS_REVIEW: "bg-orange-50 text-orange-700 border-orange-200",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200",
  CUSTOMER_UNAVAILABLE: "bg-slate-100 text-slate-700 border-slate-300",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  COMPLETED: "Completed",
  MISSED: "Missed",
  NEEDS_REVIEW: "Needs Review",
  NO_SHOW: "No Show",
  CUSTOMER_UNAVAILABLE: "Customer Unavailable",
};

const TIMELINE_STEPS = [
  { key: "PLANNED", label: "Planned", icon: CalendarClock },
  { key: "CHECKED_IN", label: "Checked In", icon: MapPin },
  { key: "CHECKED_OUT", label: "Checked Out", icon: Clock },
  { key: "COMPLETED", label: "Completed", icon: CheckCircle },
];

const PURPOSE_OPTIONS = [
  "Demo", "Technical Discussion", "Commercial Meeting",
  "Relationship Visit", "Complaint Resolution",
];

export default function VisitDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [visit, setVisit] = useState<any>(null);
  useSyncUrlParam(visit?.status, "status");
  const [loading, setLoading] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [showCustomerUnavailable, setShowCustomerUnavailable] = useState(false);
  const [showGpsDenied, setShowGpsDenied] = useState(false);
  const [manualLocationNote, setManualLocationNote] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [accountContacts, setAccountContacts] = useState<any[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [checkInTooLate, setCheckInTooLate] = useState(false);

  const [completeForm, setCompleteForm] = useState({
    visit_summary: "",
    next_action: "",
    outcome_type: "",
    create_followup: false,
    followup_type: "",
    followup_datetime: "",
    long_visit_justification: "",
    outcomeNotes: "",
    nextActionDate: "",
    nextActionNotes: "",
  });

  const [customerUnavailableForm, setCustomerUnavailableForm] = useState({
    reason: "",
  });

  const [rescheduleForm, setRescheduleForm] = useState({
    new_planned_date: "",
    new_planned_time: "",
    reason: "",
  });

  const [attendeeForm, setAttendeeForm] = useState({
    contact_id: "",
  });

  const loadVisit = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/visits/${id}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        setVisit(json.data);
        const window = getCheckInWindow(json.data.plannedDate, json.data.plannedTime);
        setCheckInTooLate(window?.status === "TOO_LATE");
        // Fetch contacts for this account (for attendee dropdown)
        if (json.data?.customerId) {
          const contactsRes = await fetch(`/api/contacts?customerId=${json.data.customerId}`);
          if (contactsRes.ok) {
            const contactsJson = await contactsRes.json();
            setAccountContacts(contactsJson.data || []);
          }
        }
        // Fetch attachments
        const attRes = await fetch(`/api/visits/${id}/attachments`);
        if (attRes.ok) {
          const attJson = await attRes.json();
          if (attJson.success) setAttachments(attJson.data || []);
        }
      }
    } else {
      toast.error("Failed to load visit");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  const handleCheckIn = async () => {
    if (visit?.visitType === "office_visit") {
      // Office visit check-in handled via modal with checkedInBy field
      setShowOfficeCheckIn(true);
      return;
    }
    if (!navigator.geolocation) {
      setShowGpsDenied(true);
      setManualLocationNote("");
      return;
    }
    setGpsLoading(true);
    toast.info("Capturing your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`/api/visits/${id}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gps_lat: latitude, gps_lng: longitude }),
        });
        const json = await res.json();
        setGpsLoading(false);
        if (json.success) {
          toast.success("Checked in successfully");
          if (json.warning) toast.warning(json.warning);
          loadVisit();
        } else if (json.error === "TOO_EARLY") {
          toast.warning(json.message || "Too early to check in");
        } else if (json.error === "TOO_LATE") {
          setCheckInTooLate(true);
          toast.error(json.message || "Check-in window has passed for this visit.");
        } else {
          toast.error(json.message || "Check-in failed");
        }
      },
      (err) => {
        setGpsLoading(false);
        setShowGpsDenied(true);
        setManualLocationNote("");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualCheckIn = async () => {
    if (!manualLocationNote.trim()) {
      toast.error("Please enter a location note");
      return;
    }
    const res = await fetch(`/api/visits/${id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationVerified: false, manualLocationNote }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Checked in (location unverified)");
      if (json.warning) toast.warning(json.warning);
      setShowGpsDenied(false);
      setManualLocationNote("");
      loadVisit();
    } else {
      toast.error(json.message || "Check-in failed");
    }
  };

  const [showOfficeCheckIn, setShowOfficeCheckIn] = useState(false);
  const [officeCheckedInBy, setOfficeCheckedInBy] = useState("");

  const handleOfficeCheckIn = async () => {
    if (!officeCheckedInBy.trim()) {
      toast.error("Please enter the receptionist/host name");
      return;
    }
    const res = await fetch(`/api/visits/${id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkedInBy: officeCheckedInBy }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Checked in successfully");
      setShowOfficeCheckIn(false);
      setOfficeCheckedInBy("");
      loadVisit();
    } else {
      toast.error(json.message || "Check-in failed");
    }
  };

  const handleCheckOut = () => {
    if (visit?.visitType === "field_visit" && navigator.geolocation) {
      setGpsLoading(true);
      toast.info("Capturing your location...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/visits/${id}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gps_lat: latitude, gps_lng: longitude, outcomeNotes: completeForm.outcomeNotes, nextActionDate: completeForm.nextActionDate, nextActionNotes: completeForm.nextActionNotes }),
          });
          const json = await res.json();
          setGpsLoading(false);
          if (json.success) {
            toast.success("Checked out");
            if (json.warning) toast.warning(json.warning);
            loadVisit();
          } else {
            toast.error(json.message || "Failed");
          }
        },
        (err) => {
          setGpsLoading(false);
          // Allow checkout without GPS
          handleCheckOutWithoutGps();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      handleCheckOutWithoutGps();
    }
  };

  const handleCheckOutWithoutGps = async () => {
    const res = await fetch(`/api/visits/${id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomeNotes: completeForm.outcomeNotes, nextActionDate: completeForm.nextActionDate, nextActionNotes: completeForm.nextActionNotes }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Checked out");
      if (json.warning) toast.warning(json.warning);
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleComplete = async () => {
    if (!completeForm.visit_summary.trim() && !completeForm.outcomeNotes.trim()) {
      toast.error("Visit summary / outcome notes are required");
      return;
    }
    if (!completeForm.outcome_type) {
      toast.error("Outcome is required");
      return;
    }
    if (visit?.longVisit && completeForm.long_visit_justification.trim().length < 20) {
      toast.error("Justification for extended visit is required (min 20 characters)");
      return;
    }
    const res = await fetch(`/api/visits/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completeForm),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Visit completed");
      setShowComplete(false);
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleCustomerUnavailable = async () => {
    if (!customerUnavailableForm.reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    const res = await fetch(`/api/visits/${id}/customer-unavailable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: customerUnavailableForm.reason }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Marked as customer unavailable");
      setShowCustomerUnavailable(false);
      setCustomerUnavailableForm({ reason: "" });
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleForm.new_planned_date) {
      toast.error("New planned date is required");
      return;
    }
    if (!rescheduleForm.reason.trim()) {
      toast.error("Reschedule reason is required");
      return;
    }
    const res = await fetch(`/api/visits/${id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rescheduleForm),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Visit rescheduled");
      setShowReschedule(false);
      setRescheduleForm({ new_planned_date: "", new_planned_time: "", reason: "" });
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleAddAttendee = async () => {
    if (!attendeeForm.contact_id) {
      toast.error("Please select a contact");
      return;
    }
    const res = await fetch(`/api/visits/${id}/attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: attendeeForm.contact_id }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Attendee added");
      setShowAddAttendee(false);
      setAttendeeForm({ contact_id: "" });
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    const res = await fetch(`/api/visits/${id}/attendees?attendeeId=${attendeeId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Attendee removed");
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit");
      return;
    }
    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", `Attachment for visit ${visit?.purpose || ""}`);
    try {
      const res = await fetch(`/api/visits/${id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("File uploaded");
        loadVisit();
      } else {
        toast.error(json.message || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (docId: string) => {
    const res = await fetch(`/api/visits/${id}/attachments?docId=${docId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Attachment deleted");
      loadVisit();
    } else {
      toast.error(json.message || "Failed");
    }
  };

  if (loading) return <PageShell title="Visit Details"><p className="text-slate-400 p-6">Loading...</p></PageShell>;
  if (!visit) return (
    <PageShell title="Visit Details">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <AlertTriangle size={40} className="mb-3" />
        <p className="font-semibold">Visit not found</p>
        <button onClick={() => router.push("/visits")} className="mt-4 text-[var(--primary)] font-bold text-sm">← Back to Visits</button>
      </div>
    </PageShell>
  );

  const isMissed = visit.status === "MISSED";
  const isCustomerUnavailable = visit.status === "CUSTOMER_UNAVAILABLE";
  const timelineSteps = isCustomerUnavailable
    ? [
        { key: "PLANNED", label: "Planned", icon: CalendarClock },
        { key: "CHECKED_IN", label: "Checked In", icon: MapPin },
        { key: "CUSTOMER_UNAVAILABLE", label: "Customer Unavailable", icon: AlertTriangle },
      ]
    : isMissed
    ? [
        { key: "PLANNED", label: "Planned", icon: CalendarClock },
        { key: "MISSED", label: "Missed", icon: AlertTriangle },
      ]
    : TIMELINE_STEPS;
  const currentStepIndex = timelineSteps.findIndex((s) => s.key === visit.status);
  const canComplete = visit.status === "CHECKED_OUT";
  const checkInWindow = visit.status === "PLANNED" ? getCheckInWindow(visit.plannedDate, visit.plannedTime) : null;
  const completeSubmitEnabled =
    (completeForm.visit_summary.trim().length > 0 || completeForm.outcomeNotes.trim().length > 0) &&
    completeForm.outcome_type !== "" &&
    (!visit.longVisit || completeForm.long_visit_justification.trim().length >= 20);

  return (
    <PageShell
      title="Visit Details"
      subtitle={visit.customer?.name}
      breadcrumb={[{ label: "Visits", href: "/visits" }]}
    >
      <div className="space-y-5">
        {/* Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-gradient-to-br from-[var(--primary)]/[0.08] via-transparent to-transparent p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{visit.customer?.name}</h2>
                <a
                  href={`/customer-master/${visit.customerId}`}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline"
                >
                  View Account →
                </a>
              </div>
              {visit.plantLocation && (
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin size={14} /> {visit.plantLocation.locationName} — {visit.plantLocation.city}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50">
                  {visit.purpose}
                </span>
                <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border", STATUS_PILLS[visit.status])}>
                  {STATUS_LABELS[visit.status] || visit.status}
                </span>
              </div>
              {visit.parentVisit && (
                <a
                  href={`/visits/${visit.parentVisit.id}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--primary)] font-semibold hover:underline mt-1"
                >
                  <Briefcase size={12} /> Follow-up of Visit #{visit.parentVisit.id.slice(-6)}
                </a>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Assigned To</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{visit.host?.name}</p>
              {visit.plannedDate && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDate(visit.plannedDate)} at {visit.plannedTime}</p>
              )}
            </div>
          </div>
        </div>

        {visit.autoCheckedOut && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-950/20 dark:border-red-800/50 p-4 text-red-700 dark:text-red-400 flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Auto Checked Out</p>
              <p className="text-sm">
                This visit was automatically checked out by the system after 9 hours of check-in with no manual checkout.
              </p>
              {visit.autoCheckoutReason && <p className="text-xs mt-1">{visit.autoCheckoutReason}</p>}
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="crm-card p-6">
          <SectionCardHeader
            title="Visit Timeline"
            subtitle="Planned → Checked In → Checked Out → Completed"
            icon={<CalendarClock size={20} />}
          />
          
          {/* Desktop Timeline */}
          <div className="hidden md:flex items-center gap-2">
            {timelineSteps.map((step, idx) => {
              const Icon = step.icon;
              const isReached = isMissed || isCustomerUnavailable
                ? idx <= currentStepIndex
                : idx <= currentStepIndex;
              const isCurrent = step.key === visit.status;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={cn(
                    "flex flex-col items-center gap-1.5",
                    isReached ? "text-[var(--primary)]" : "text-slate-300"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      isReached ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-slate-200 bg-slate-50",
                      isCurrent && "ring-4 ring-[var(--primary)]/20"
                    )}>
                      <Icon size={18} />
                    </div>
                    <span className={cn("text-[11px] font-bold", isReached ? "text-slate-700" : "text-slate-400")}>
                      {step.label}
                    </span>
                  </div>
                  {idx < timelineSteps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-1",
                      isMissed || isCustomerUnavailable ? "bg-rose-200" : idx < currentStepIndex ? "bg-[var(--primary)]" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile Timeline (Vertical Stack) */}
          <div className="flex md:hidden flex-col gap-4 relative pl-2">
            {/* Connector line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800" />
            {timelineSteps.map((step, idx) => {
              const Icon = step.icon;
              const isReached = isMissed || isCustomerUnavailable
                ? idx <= currentStepIndex
                : idx <= currentStepIndex;
              const isCurrent = step.key === visit.status;
              return (
                <div key={step.key} className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 bg-white dark:bg-[#111] transition-all shrink-0",
                    isReached ? "border-[var(--primary)] text-[var(--primary)] bg-indigo-50/50" : "border-slate-200 text-slate-300",
                    isCurrent && "ring-4 ring-[var(--primary)]/20"
                  )}>
                    <Icon size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("text-xs font-bold", isReached ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>
                      {step.label}
                    </span>
                    {isCurrent && <span className="text-[10px] text-[var(--primary)] font-semibold">Current Status</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {visit.autoCheckedOut && visit.autoCheckoutReason && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertTriangle size={14} /> {visit.autoCheckoutReason}
            </div>
          )}
          {isMissed && (
            <div className="mt-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle size={14} /> This visit was missed — no check-in was recorded before the planned time.
            </div>
          )}
          {isCustomerUnavailable && visit.customerUnavailableReason && (
            <div className="mt-4 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 font-medium flex items-center gap-2">
              <AlertTriangle size={14} /> Customer unavailable: {visit.customerUnavailableReason}
            </div>
          )}
          {(visit.rescheduleCount > 0 || visit.rescheduleReason) && (
            <div className="mt-4 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 font-medium flex items-start gap-2">
              <CalendarClock size={14} className="mt-0.5 shrink-0" />
              <div>
                <p>Rescheduled {visit.rescheduleCount || 0} time{visit.rescheduleCount === 1 ? "" : "s"}</p>
                {visit.rescheduleReason && <p className="text-indigo-600 mt-0.5">Latest reason: {visit.rescheduleReason}</p>}
              </div>
            </div>
          )}
        </div>

        {/* GPS / Check-In Section */}
        <div className="crm-card p-6">
          <SectionCardHeader
            title="GPS & Check-In"
            subtitle="Real-time check-in and check-out logs"
            icon={<Navigation size={20} />}
          />
          {visit.gpsLat != null ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Check-In Column */}
                <div className="space-y-4 p-4 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check-In Details</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Timestamp</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{visit.checkInTime ? formatDateTime(visit.checkInTime) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">GPS Coordinates</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 break-all">
                        {visit.gpsLat.toFixed(6)}, {visit.gpsLng.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Verification Status</p>
                      <p className={cn("text-sm font-bold", visit.gpsAnomaly ? "text-amber-600" : "text-emerald-600")}>
                        {visit.gpsAnomaly ? "Anomaly (Out of bounds)" : "Verified On Site"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Check-Out Column */}
                <div className="space-y-4 p-4 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check-Out Details</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Timestamp</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{visit.checkOutTime ? formatDateTime(visit.checkOutTime) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">GPS Coordinates</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 break-all">
                        {visit.checkOutGpsLocation ? visit.checkOutGpsLocation : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Verification Status</p>
                      <p className={cn("text-sm font-bold", visit.checkOutGpsAnomaly ? "text-amber-600" : visit.checkOutGpsLocation ? "text-emerald-600" : "text-slate-400")}>
                        {visit.checkOutGpsAnomaly ? "Anomaly (Moved too far)" : visit.checkOutGpsLocation ? "Verified On Site" : "Pending Checkout"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {visit.gpsAnomaly && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} /> Check-in location was more than 1km from the registered plant address.
                </div>
              )}
              {visit.checkOutGpsAnomaly && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} /> Check-out location was more than 1km from check-in location.
                </div>
              )}
              {visit.durationMinutes != null && visit.durationMinutes < 15 && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} /> Short visit duration detected ({visit.durationMinutes} mins). Please verify.
                </div>
              )}
              <a
                href={`https://www.openstreetmap.org/?mlat=${visit.gpsLat}&mlon=${visit.gpsLng}&zoom=16`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline"
              >
                <MapPin size={12} /> View on Map
              </a>
            </div>
          ) : (
            <div className="text-center py-6">
              <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400 mb-4">No GPS check-in recorded yet.</p>
              {visit.status === "PLANNED" && (
                <button
                  onClick={handleCheckIn}
                  disabled={gpsLoading}
                  className="px-6 py-3 bg-[var(--primary)] text-white font-bold text-sm rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {gpsLoading ? (
                    <><Clock size={18} className="animate-spin" /> Capturing location...</>
                  ) : (
                    <><MapPin size={18} /> Check In Now</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Attendees Section */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users size={15} className="text-[var(--text-secondary)]" /> Attendees
            </h3>
            {visit.status !== "COMPLETED" && (
              <button
                onClick={() => setShowAddAttendee(true)}
                className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg hover:bg-[var(--primary)]/5 transition-all flex items-center gap-1"
              >
                <UserPlus size={13} /> Add Attendee
              </button>
            )}
          </div>
          {visit.visitAttendees && visit.visitAttendees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visit.visitAttendees.map((att: any) => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{att.contact?.name}</p>
                    <p className="text-xs text-slate-500">{att.contact?.designation || "—"}</p>
                    {att.contact?.phone && <p className="text-xs text-slate-400">{att.contact.phone}</p>}
                  </div>
                  {visit.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleRemoveAttendee(att.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No attendees added yet.</p>
          )}
        </div>

        {/* Visit Summary Section */}
        {visit.status === "COMPLETED" && (
          <div className="crm-card p-6">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <FileText size={15} className="text-[var(--text-secondary)]" /> Visit Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Summary</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{visit.visitSummary || "—"}</p>
              </div>
              {visit.outcomeType && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Outcome</p>
                  <span className={cn(
                    "inline-block px-2 py-0.5 text-xs font-bold rounded-md border",
                    visit.outcomeType === "POSITIVE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    visit.outcomeType === "NEUTRAL" && "bg-blue-50 text-blue-700 border-blue-200",
                    visit.outcomeType === "NEEDS_FOLLOWUP" && "bg-amber-50 text-amber-700 border-amber-200",
                    visit.outcomeType === "LOST" && "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    {visit.outcomeType.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {visit.nextAction && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Next Action</p>
                  <p className="text-sm text-slate-700">{visit.nextAction}</p>
                </div>
              )}
              {visit.longVisitJustification && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Justification for Extended Visit</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{visit.longVisitJustification}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked Opportunity */}
        {visit.linkedOpportunity && (
          <div className="crm-card p-6">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Briefcase size={15} className="text-[var(--text-secondary)]" /> Related Opportunity
            </h3>
            <a
              href={`/sales-pipeline/${visit.linkedOpportunity.id}/opportunity-detail`}
              className="block p-4 bg-indigo-50/80 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-colors"
            >
              <p className="text-sm font-bold text-indigo-800 dark:text-indigo-400">{visit.linkedOpportunity.dealName}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-500">{visit.linkedOpportunity.opportunityCode} — {visit.linkedOpportunity.status}</p>
            </a>
          </div>
        )}

        {/* Follow-up Visits */}
        {visit.childVisits && visit.childVisits.length > 0 && (
          <div className="crm-card p-6">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Briefcase size={15} className="text-[var(--text-secondary)]" /> Follow-up Visits
            </h3>
            <div className="space-y-2">
              {visit.childVisits.map((child: any) => (
                <a
                  key={child.id}
                  href={`/visits/${child.id}`}
                  className="block p-4 bg-indigo-50/80 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-indigo-800">{child.purpose}</p>
                    <span className={cn("px-2 py-0.5 text-xs font-bold rounded-md border", STATUS_PILLS[child.status] || "bg-slate-50 text-slate-600 border-slate-200")}>
                      {STATUS_LABELS[child.status] || child.status}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-600">
                    Planned: {child.plannedDate ? `${formatDate(child.plannedDate)} at ${child.plannedTime || "—"}` : "—"}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap items-start">
          {visit.status === "PLANNED" && (
            <div className="flex flex-col gap-1">
              <button
                onClick={handleCheckIn}
                disabled={gpsLoading || checkInTooLate}
                className="px-5 py-2.5 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
              >
                <MapPin size={16} /> Check In
              </button>
              {checkInWindow && (
                <span className="text-xs text-slate-500">
                  Check-in available from {formatDateTime(checkInWindow.start)} to {formatDateTime(checkInWindow.end)}
                </span>
              )}
            </div>
          )}
          {visit.status === "CHECKED_IN" && (
            <>
              <button
                onClick={handleCheckOut}
                disabled={gpsLoading}
                className="px-5 py-2.5 bg-teal-600 text-white font-semibold text-sm rounded-xl hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
              >
                <Clock size={16} /> Check Out
              </button>
              <button
                onClick={() => setShowCustomerUnavailable(true)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 flex items-center gap-2 transition-all"
              >
                <AlertTriangle size={16} /> Customer Unavailable
              </button>
            </>
          )}
          {visit.status === "CHECKED_OUT" && (
            <div className="relative group">
              <button
                onClick={() => {
                  if (!canComplete) return;
                  setCompleteForm({
                    visit_summary: "",
                    next_action: "",
                    outcome_type: "",
                    create_followup: false,
                    followup_type: "",
                    followup_datetime: "",
                    long_visit_justification: "",
                    outcomeNotes: "",
                    nextActionDate: "",
                    nextActionNotes: "",
                  });
                  setShowComplete(true);
                }}
                disabled={!canComplete}
                className={cn(
                  "px-5 py-2.5 font-semibold text-sm rounded-xl flex items-center gap-2 transition-all",
                  canComplete
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md"
                    : "bg-emerald-300 text-white cursor-not-allowed"
                )}
              >
                <CheckCircle size={16} /> Complete Visit
              </button>
              {!canComplete && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 px-2 py-1 text-xs text-white bg-slate-800 rounded-lg text-center">
                  Please complete checkout with GPS before finishing the visit
                </span>
              )}
            </div>
          )}
          {(visit.status === "PLANNED" || visit.status === "MISSED") && (
            <button
              onClick={() => setShowReschedule(true)}
              className="px-5 py-2.5 bg-[var(--primary)]/10 text-[var(--primary)] font-semibold text-sm rounded-xl hover:bg-[var(--primary)]/20 border border-[var(--primary)]/20 flex items-center gap-2 transition-all"
            >
              <CalendarClock size={16} /> Reschedule
            </button>
          )}
        </div>
      </div>

      {/* Complete Visit Modal */}
      <Modal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        title="Complete Visit"
        subtitle="Record the visit outcome"
        size="md"
        footer={
          <>
            <button onClick={() => setShowComplete(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button
              onClick={handleComplete}
              disabled={!completeSubmitEnabled}
              className={cn(
                "px-4 py-2 text-white text-sm font-bold rounded-lg",
                completeSubmitEnabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300 cursor-not-allowed"
              )}
            >
              Complete
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {visit.longVisit && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm">
                This visit was auto checked out after 9 hours. Please provide a justification below before completing.
              </p>
            </div>
          )}
          <FormField label="Visit Summary" required hint="Enter visit outcome: discussions, decisions, next steps">
            <Textarea
              rows={4}
              value={completeForm.visit_summary}
              onChange={(e) => setCompleteForm({ ...completeForm, visit_summary: e.target.value })}
              placeholder="Enter visit outcome: discussions, decisions, next steps"
            />
          </FormField>
          <FormField label="Outcome Notes" hint="Structured outcome notes (optional if summary provided)">
            <Textarea
              rows={3}
              value={completeForm.outcomeNotes}
              onChange={(e) => setCompleteForm({ ...completeForm, outcomeNotes: e.target.value })}
              placeholder="Structured outcome notes — key findings, action items, risks..."
            />
          </FormField>
          <FormField label="Outcome" required>
            <Select
              value={completeForm.outcome_type}
              onChange={(e) => setCompleteForm({ ...completeForm, outcome_type: e.target.value })}
            >
              <option value="">Select outcome...</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEUTRAL">Neutral</option>
              <option value="NEEDS_FOLLOWUP">Needs Follow-up</option>
              <option value="LOST">Lost</option>
            </Select>
          </FormField>
          <FormField label="Next Action">
            <Input
              value={completeForm.next_action}
              onChange={(e) => setCompleteForm({ ...completeForm, next_action: e.target.value })}
              placeholder="e.g. Send quotation, Schedule demo..."
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Next Action Date" hint="Sets a follow-up reminder when provided">
              <Input
                type="date"
                value={completeForm.nextActionDate}
                onChange={(e) => setCompleteForm({ ...completeForm, nextActionDate: e.target.value })}
              />
            </FormField>
            <FormField label="Next Action Notes">
              <Input
                value={completeForm.nextActionNotes}
                onChange={(e) => setCompleteForm({ ...completeForm, nextActionNotes: e.target.value })}
                placeholder="Notes for the follow-up..."
              />
            </FormField>
          </div>
          {visit.longVisit && (
            <FormField label="Justification for Extended Visit" required>
              <Textarea
                rows={3}
                value={completeForm.long_visit_justification}
                onChange={(e) => setCompleteForm({ ...completeForm, long_visit_justification: e.target.value })}
                placeholder="Please explain why the visit lasted more than 9 hours (e.g., extended demo, factory audit, customer requested longer session)"
              />
              <p className="text-xs text-slate-500 mt-1">
                Minimum 20 characters required. Current: {completeForm.long_visit_justification.trim().length}
              </p>
            </FormField>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={completeForm.create_followup}
              onChange={(e) => setCompleteForm({ ...completeForm, create_followup: e.target.checked })}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            Create Follow Up
          </label>
          {completeForm.create_followup && (
            <div className="space-y-3 pl-6 border-l-2 border-[var(--primary)]/20">
              <FormField label="Follow-up Type">
                <Select
                  value={completeForm.followup_type}
                  onChange={(e) => setCompleteForm({ ...completeForm, followup_type: e.target.value })}
                >
                  <option value="">Select type...</option>
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="Visit">Visit</option>
                </Select>
              </FormField>
              <FormField label="Follow-up Date & Time">
                <Input
                  type="datetime-local"
                  value={completeForm.followup_datetime}
                  onChange={(e) => setCompleteForm({ ...completeForm, followup_datetime: e.target.value })}
                />
              </FormField>
            </div>
          )}
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        open={showReschedule}
        onClose={() => setShowReschedule(false)}
        title="Reschedule Visit"
        subtitle="Set a new date and time"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowReschedule(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleReschedule} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Reschedule</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="New Planned Date" required>
            <Input
              type="date"
              value={rescheduleForm.new_planned_date}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_planned_date: e.target.value })}
            />
          </FormField>
          <FormField label="New Planned Time">
            <Input
              type="time"
              value={rescheduleForm.new_planned_time}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_planned_time: e.target.value })}
            />
          </FormField>
          <FormField label="Reason">
            <Textarea
              rows={2}
              value={rescheduleForm.reason}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
              placeholder="Reason for rescheduling..."
            />
          </FormField>
        </div>
      </Modal>

      {/* Customer Unavailable Modal */}
      <Modal
        open={showCustomerUnavailable}
        onClose={() => setShowCustomerUnavailable(false)}
        title="Customer Unavailable"
        subtitle="Record why the customer could not be met"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowCustomerUnavailable(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleCustomerUnavailable} className="px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800">Confirm</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Reason" required>
            <Textarea
              rows={3}
              value={customerUnavailableForm.reason}
              onChange={(e) => setCustomerUnavailableForm({ reason: e.target.value })}
              placeholder="e.g. Customer was out of office, meeting cancelled..."
            />
          </FormField>
        </div>
      </Modal>

      {/* Add Attendee Modal */}
      <Modal
        open={showAddAttendee}
        onClose={() => setShowAddAttendee(false)}
        title="Add Attendee"
        subtitle="Select a contact from this account"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowAddAttendee(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleAddAttendee} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Add</button>
          </>
        }
      >
        <div className="p-6">
          <FormField label="Contact" required>
            <Select
              value={attendeeForm.contact_id}
              onChange={(e) => setAttendeeForm({ contact_id: e.target.value })}
            >
              <option value="">Select contact...</option>
              {accountContacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.designation ? `(${c.designation})` : ""}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* GPS Denied — Manual Location Note Modal */}
      <Modal
        open={showGpsDenied}
        onClose={() => { setShowGpsDenied(false); setManualLocationNote(""); }}
        title="Check In Without GPS"
        subtitle="GPS location could not be captured. Enter a manual location note to proceed."
        size="sm"
        footer={
          <>
            <button onClick={() => { setShowGpsDenied(false); setManualLocationNote(""); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleManualCheckIn} className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700">Check In (Unverified)</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle size={14} className="inline mr-1.5" />
            Location will be marked as unverified.
          </div>
          <FormField label="Manual Location Note" required>
            <Textarea
              value={manualLocationNote}
              onChange={(e) => setManualLocationNote(e.target.value)}
              placeholder="Describe your current location..."
              rows={3}
            />
          </FormField>
        </div>
      </Modal>

      {/* Office Visit Check-In Modal */}
      <Modal
        open={showOfficeCheckIn}
        onClose={() => setShowOfficeCheckIn(false)}
        title="Office Visit Check-In"
        subtitle="Enter receptionist/host confirmation"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowOfficeCheckIn(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleOfficeCheckIn} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Check In</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Receptionist/Host Name" required>
            <Input
              value={officeCheckedInBy}
              onChange={(e) => setOfficeCheckedInBy(e.target.value)}
              placeholder="Enter the name of the person who checked in the visitor"
            />
          </FormField>
        </div>
      </Modal>

      {/* Attachments Section */}
      <div className="crm-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={15} className="text-[var(--text-secondary)]" /> Attachments
          </h3>
          <label className="px-3.5 py-2 bg-[var(--primary)] text-white font-semibold text-sm rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md">
            <FileText size={15} /> Upload File
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
          </label>
        </div>
        {uploadingFile && <p className="text-sm text-slate-400 mb-3">Uploading...</p>}
        {attachments.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No attachments yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-slate-400" />
                  <div>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-[var(--primary)]">{doc.name}</a>
                    <p className="text-xs text-slate-400">{doc.uploadedBy?.name || "Unknown"} · {formatDate(doc.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAttachment(doc.id)}
                  className="text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <AlertTriangle size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
