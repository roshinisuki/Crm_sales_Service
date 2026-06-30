"use client";
import { CRMSpinner } from "@/components/CRMSpinner";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLeadByIdAction, convertLeadToDealAction, convertLeadV2Action, updateLeadAction, contactLeadAction, qualifyLeadAction, markLeadLostAction, getLeadStatusHistoryAction } from "@/app/actions/leads";
import { createFollowUpAction, completeFollowUpAction } from "@/app/actions/followUps";
import { getNotesAction, createNoteAction } from "@/app/actions/notes";
import { getActivitiesAction } from "@/app/actions/activities";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { getInitials, getAvatarColor, formatDate, formatDateTime, cn } from "@/lib/ui-utils";
import { getLeadWorkflowActions, computeWorkflowState } from "@/lib/workflow-actions";
import {
  ArrowLeft, Briefcase, Phone, Mail, MapPin, Building2,
  CalendarClock, User, Plus, CheckCircle2, PhoneCall,
  MessageSquare, FileText, XCircle, Zap, Clock,
} from "lucide-react";

type Tab = "overview" | "followups" | "activities" | "bant";

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const leadId = resolvedParams.id;
  const router    = useRouter();
  const searchParams = useSearchParams();
  const toast     = useToast();
  const { user }  = useAuth();

  const [lead,       setLead]       = useState<any>(null);
  const [followups,  setFollowups]  = useState<any[]>([]);
  const [notes,      setNotes]      = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Executives list for assignment dropdown
  const [executives, setExecutives] = useState<any[]>([]);

  // Follow-up add modal
  const [fuModal,      setFuModal]      = useState(false);
  const [fuDate,       setFuDate]       = useState("");
  const [fuType,       setFuType]       = useState<"Call" | "Meeting" | "Note">("Call");
  const [fuNotes,      setFuNotes]      = useState("");
  const [fuAssignedTo, setFuAssignedTo] = useState("");
  const [fuPriority,   setFuPriority]   = useState<"High" | "Medium" | "Low">("Medium");
  const [fuSaving,     setFuSaving]     = useState(false);

  // Note / activity add modal
  const [noteModal, setNoteModal] = useState(false);
  const [noteType,  setNoteType]  = useState<"Note" | "Call" | "Meeting">("Note");
  const [noteText,  setNoteText]  = useState("");
  const [noteSaving,setNoteSaving]= useState(false);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>("overview");

  const [convertModal,       setConvertModal]       = useState(false);
  const [dealName,           setDealName]           = useState("");
  const [dealValue,          setDealValue]          = useState("");
  const [expectedCloseDate,  setExpectedCloseDate]  = useState("");
  const [converting,  setConverting]  = useState(false);
  const [markingLost, setMarkingLost] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [qualifying, setQualifying] = useState(false);

  // V2 BANT checklist state
  const [bantBudget, setBantBudget] = useState(false);
  const [bantAuthority, setBantAuthority] = useState(false);
  const [bantNeed, setBantNeed] = useState(false);
  const [bantTimeline, setBantTimeline] = useState("");
  const [bantSaving, setBantSaving] = useState(false);

  // V2 Convert modal state (3-section accordion)
  const [convertV2Modal, setConvertV2Modal] = useState(false);
  const [convertV2Saving, setConvertV2Saving] = useState(false);
  const [convertSection, setConvertSection] = useState(0); // 0=account, 1=contact, 2=opportunity
  const [convertForm, setConvertForm] = useState({
    companyName: "", gstNumber: "", accountType: "Customer", industryType: "", billingAddress: "",
    contactName: "", contactDesignation: "", contactEmail: "", contactPhone: "", contactCategory: "Technical",
    oppName: "", oppValue: "", oppCloseDate: "",
  });

  // V2 Mark Lost with loss reason dropdown
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [selectedLossReasonId, setSelectedLossReasonId] = useState("");

  // Qualification fields
  const [budgetAsked, setBudgetAsked] = useState("");
  const [timelineAsked, setTimelineAsked] = useState("");
  const [isGenuine, setIsGenuine] = useState(false);
  const [sqlSaving, setSqlSaving] = useState(false);
  const [qualModalOpen, setQualModalOpen] = useState(false);

  // Success overlay for guided flow
  const [successOverlay, setSuccessOverlay] = useState<{ open: boolean; message: string; primary: SuccessAction; secondary?: SuccessAction; alternate?: SuccessAction }>({
    open: false, message: "", primary: { label: "", href: "" },
  });

  // Call Log modal state
  const [callLogModal, setCallLogModal] = useState(false);
  const [callForm, setCallForm] = useState({ direction: "Outbound", duration: "15", status: "Completed", content: "" });
  const [callSaving, setCallSaving] = useState(false);

  // Follow-up prompt after call log
  const [fuPromptModal, setFuPromptModal] = useState(false);
  const [fuFromCallLog, setFuFromCallLog] = useState(false);

  // Next action suggestions after "still in discussion"
  const [nextActionModal, setNextActionModal] = useState(false);

  // Complete follow-up modal state
  const [completeFuModal, setCompleteFuModal] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState<any>(null);
  const [completeRemarks, setCompleteRemarks] = useState("");
  const [completeLeadStatus, setCompleteLeadStatus] = useState("Contacted");
  const [completeSaving, setCompleteSaving] = useState(false);

  // Post-complete suggestion modal
  const [postCompleteModal, setPostCompleteModal] = useState(false);

  // Load executives for assignment
  useEffect(() => {
    if (!user) return;
    if (user.role === "Admin" || user.role === "SalesManager") {
      getUsersAction().then(res => {
        if (res.success && res.data) {
          setExecutives((res.data as any[]).filter(
            (u: any) => u.role === "SalesExecutive" || u.role === "SalesManager"
          ));
        }
      });
    }
  }, [user]);

  const openConvertModal = () => {
    if (!lead) return;
    setDealName(`${lead.name} - Initial Deal`);
    setDealValue("150000");
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setExpectedCloseDate(d.toISOString().substring(0, 10));
    setConvertModal(true);
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName || !dealValue || !expectedCloseDate) { toast.error("Please fill in all fields"); return; }
    const val = parseFloat(dealValue);
    if (isNaN(val) || val <= 0) { toast.error("Deal value must be positive"); return; }
    setConverting(true);
    const res = await convertLeadToDealAction(lead.id, dealName, val, expectedCloseDate);
    if (res.success && res.dealId) {
      toast.success("Lead converted to Deal successfully!");
      router.push(`/sales-pipeline/${res.dealId}`);
    } else {
      toast.error(res.message || "Failed to convert lead.");
      setConverting(false);
    }
  };

  // Unified handler for both "Mark Contacted" (lead details) and "Log First Call"
  // (post lead creation). Both UI entry points open the Call Log modal first.
  // The lead status is NOT updated here - it only changes after the user fills
  // the call details and saves (see handleSaveCallLog -> contactLeadAction).
  const [contacting, setContacting] = useState(false);
  const handleLeadContact = (leadId: string) => {
    if (!leadId || contacting) return;
    // Open the Call Log modal pre-filled with lead context
    setCallForm({ direction: "Outbound", duration: "15", status: "Completed", content: "" });
    setCallLogModal(true);
  };

  // Save call log via the unified contactLeadAction - creates the Call activity
  // AND updates lead status to Contacted in a single atomic operation.
  // Status only changes AFTER the call log is saved with user-provided details.
  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callForm.content.trim()) { toast.error("Please enter call notes/outcome."); return; }
    setCallSaving(true);
    const res = await contactLeadAction(lead.id, {
      content: callForm.content,
      direction: callForm.direction,
      duration: callForm.duration ? parseInt(callForm.duration) : null,
      status: callForm.status,
    });
    if (res.success) {
      toast.success("Call logged & lead marked as Contacted!");
      setCallLogModal(false);
      load();
      setFuPromptModal(true);
    } else {
      toast.error(res.message || "Failed to log call.");
    }
    setCallSaving(false);
  };

  // After follow-up prompt: "No, still in discussion" -> show next actions
  // (Lead is already Contacted from contactLeadAction - no status update needed)
  const handleNoFollowUp = () => {
    setFuPromptModal(false);
    setNextActionModal(true);
  };

  // After follow-up prompt: "Yes, schedule follow-up" -> open follow-up form
  const handleYesFollowUp = () => {
    setFuPromptModal(false);
    setFuFromCallLog(true);
    setFuModal(true);
  };

  // Open complete follow-up modal
  const openCompleteFuModal = (f: any) => {
    setActiveFollowUp(f);
    setCompleteRemarks("");
    setCompleteLeadStatus(lead?.status || "Contacted");
    setCompleteFuModal(true);
  };

  // Save complete follow-up
  const handleCompleteFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeRemarks.trim()) { toast.error("Please enter outcome remarks."); return; }
    setCompleteSaving(true);
    const res = await completeFollowUpAction({
      id: activeFollowUp.id,
      customerStatus: completeLeadStatus,
      completionNotes: completeRemarks,
      remarks: completeRemarks,
    });
    if (res.success) {
      toast.success("Follow-up completed!");
      setCompleteFuModal(false);
      load();
      setPostCompleteModal(true);
    } else {
      toast.error(res.message || "Failed to complete follow-up.");
    }
    setCompleteSaving(false);
  };

  // Post-complete suggestion handlers
  const handlePostCompleteSQL = async () => {
    setPostCompleteModal(false);
    const res = await updateLeadAction(lead.id, { status: "SQL" });
    if (res.success) { toast.success("Lead marked as SQL."); load(); }
    else { toast.error(res.message || "Failed"); }
  };
  const handlePostCompleteQualify = async () => {
    setPostCompleteModal(false);
    if (!lead || qualifying) return;
    setQualifying(true);
    const res = await updateLeadAction(lead.id, { status: "Qualified" });
    if (res.success) { toast.success("Lead qualified! Customer record created."); load(); }
    else { toast.error(res.message || "Failed to qualify lead."); }
    setQualifying(false);
  };
  const handlePostCompleteFollowUp = () => {
    setPostCompleteModal(false);
    setFuFromCallLog(false);
    setFuModal(true);
  };
  const handlePostCompleteNote = () => {
    setPostCompleteModal(false);
    setNoteType("Note");
    setNoteModal(true);
  };
  const handlePostCompleteLost = () => {
    setPostCompleteModal(false);
    handleMarkLost();
  };
  const handlePostCompleteDone = () => {
    setPostCompleteModal(false);
  };

  // Next action handlers
  const handleNextActionSQL = async () => {
    setNextActionModal(false);
    const res = await updateLeadAction(lead.id, { status: "SQL" });
    if (res.success) { toast.success("Lead marked as SQL."); load(); }
    else { toast.error(res.message || "Failed"); }
  };
  const handleNextActionNote = () => {
    setNextActionModal(false);
    setNoteType("Note");
    setNoteModal(true);
  };
  const handleNextActionFollowUp = () => {
    setNextActionModal(false);
    setFuFromCallLog(false);
    setFuModal(true);
  };
  const handleNextActionDone = () => {
    setNextActionModal(false);
  };

  // After follow-up form saved from the guided flow, update lead status to Contacted
  const handleGuidedFollowUpSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuDate) { toast.error("Please select a date"); return; }
    setFuSaving(true);
    const res = await createFollowUpAction({
      leadId: lead.id,
      nextMeetingDate: fuDate,
      remarks: `${fuType}: ${fuNotes}`.trim(),
      notes: fuNotes || null,
      priority: fuPriority,
      assignedUserId: fuAssignedTo || lead.assignedUserId || undefined,
      sourceType: "MANUAL",
      type: fuType,
    });
    if (res.success) {
      // Also update lead status to Contacted
      await updateLeadAction(lead.id, { status: "Contacted" });
      toast.success("Follow-up scheduled! Log the activity now.");
      setFuModal(false); setFuDate(""); setFuType("Call"); setFuNotes(""); setFuPriority("Medium");
      load();
      // MANDATORY: redirect to activity form to log the actual interaction
      const newFollowUpId = res.data?.id || "";
      router.push(`/activities/new?type=${fuType.toLowerCase()}&leadId=${lead.id}&followUpId=${newFollowUpId}`);
    } else {
      toast.error(res.message || "Failed to add follow-up.");
    }
    setFuSaving(false);
  };

  // Mark as SQL with qualification fields
  const handleMarkSQL = async () => {
    if (!lead) return;
    if (!budgetAsked.trim() || !timelineAsked.trim()) {
      toast.error("Please fill Budget and Timeline before marking as SQL.");
      return;
    }
    setSqlSaving(true);
    const res = await updateLeadAction(lead.id, {
      status: "SQL",
      budgetAsked,
      timelineAsked,
      isGenuine,
    });
    if (res.success) {
      toast.success("Lead qualified as SQL!");
      setQualModalOpen(false);
      load();
      setSuccessOverlay({
        open: true,
        message: `Lead is now Sales Qualified (SQL). Budget: Rs.${budgetAsked}, Timeline: ${timelineAsked}`,
        primary: { label: "View SQL Leads", href: "/leads?status=SQL", icon: <CheckCircle2 size={16} /> },
        alternate: { label: "Stay on this lead", onClick: () => {} },
      });
    } else {
      toast.error(res.message || "Failed to mark as SQL.");
    }
    setSqlSaving(false);
  };

  const handleMarkLost = () => {
    if (!lead || markingLost) return;
    setLostReason("");
    setShowLostModal(true);
  };

  const handleConfirmLost = async () => {
    if (!lead || markingLost) return;
    if (!selectedLossReasonId && !lostReason.trim()) {
      toast.error("Please select a loss reason.");
      return;
    }
    setMarkingLost(true);
    // V2: Use markLeadLostAction if we have a lossReasonId, fallback to updateLeadAction
    if (selectedLossReasonId) {
      const res = await markLeadLostAction(lead.id, selectedLossReasonId, lostReason.trim() || undefined);
      if (res.success) { toast.success("Lead marked as lost. Follow-ups cancelled."); setShowLostModal(false); load(); }
      else { toast.error(res.message || "Failed to update lead."); }
    } else {
      const res = await updateLeadAction(lead.id, { status: "Lost", lostReason: lostReason.trim() });
      if (res.success) { toast.success("Lead marked as lost."); setShowLostModal(false); load(); }
      else { toast.error(res.message || "Failed to update lead."); }
    }
    setMarkingLost(false);
  };

  // V2: BANT Qualify handler
  const handleBANTQualify = async () => {
    if (!lead || bantSaving) return;
    if (!bantBudget || !bantAuthority || !bantNeed) {
      toast.error("Budget, Authority, and Need must all be confirmed.");
      return;
    }
    if (!bantTimeline || parseInt(bantTimeline) <= 0) {
      toast.error("Timeline (months) is required.");
      return;
    }
    setBantSaving(true);
    const res = await qualifyLeadAction(lead.id, {
      hasBudget: bantBudget,
      hasAuthority: bantAuthority,
      hasNeed: bantNeed,
      timelineMonths: parseInt(bantTimeline),
    });
    if (res.success) {
      toast.success("Lead qualified as SQL via BANT checklist!");
      load();
    } else {
      toast.error(res.message || "Failed to qualify.");
    }
    setBantSaving(false);
  };

  // V2: Open Convert modal with pre-filled data
  const openConvertV2 = () => {
    if (!lead) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setConvertForm({
      companyName: lead.companyName || lead.name || "",
      gstNumber: "", accountType: "Customer", industryType: lead.industryType || "", billingAddress: "",
      contactName: lead.name || "", contactDesignation: lead.designation || "",
      contactEmail: lead.email || "", contactPhone: lead.phone || "", contactCategory: "Technical",
      oppName: `Supply - ${lead.companyName || lead.name}`, oppValue: lead.estimatedValue ? String(lead.estimatedValue) : "",
      oppCloseDate: d.toISOString().substring(0, 10),
    });
    setConvertSection(0);
    setConvertV2Modal(true);
  };

  // V2: Submit Convert
  const handleConvertV2 = async () => {
    if (!lead || convertV2Saving) return;
    if (!convertForm.companyName.trim()) { toast.error("Company name is required."); return; }
    if (!convertForm.contactName.trim()) { toast.error("Contact name is required."); return; }
    if (!convertForm.oppName.trim()) { toast.error("Opportunity name is required."); return; }
    if (!convertForm.oppCloseDate) { toast.error("Expected close date is required."); return; }
    setConvertV2Saving(true);
    const res = await convertLeadV2Action(lead.id, {
      account: {
        companyName: convertForm.companyName,
        gstNumber: convertForm.gstNumber || undefined,
        accountType: convertForm.accountType,
        industryType: convertForm.industryType || undefined,
        billingAddress: convertForm.billingAddress || undefined,
      },
      contact: {
        fullName: convertForm.contactName,
        designation: convertForm.contactDesignation || undefined,
        email: convertForm.contactEmail || undefined,
        phone: convertForm.contactPhone || undefined,
        contactCategory: convertForm.contactCategory,
      },
      opportunity: {
        opportunityName: convertForm.oppName,
        estimatedValue: convertForm.oppValue ? parseFloat(convertForm.oppValue) : undefined,
        expectedCloseDate: convertForm.oppCloseDate,
      },
    });
    if (res.success && res.opportunityId) {
      toast.success("Lead converted successfully!");
      setConvertV2Modal(false);
      router.push(`/sales-pipeline/${res.opportunityId}`);
    } else {
      toast.error(res.message || "Failed to convert lead.");
    }
    setConvertV2Saving(false);
  };

  const handleQualify = async () => {
    if (!lead || qualifying) return;
    setQualifying(true);
    const res = await updateLeadAction(lead.id, { status: "Qualified" });
    if (res.success) {
      toast.success("Lead qualified! Customer record created.");
      load();
    } else {
      toast.error(res.message || "Failed to qualify lead.");
    }
    setQualifying(false);
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuDate) { toast.error("Please select a date"); return; }
    setFuSaving(true);
    const res = await createFollowUpAction({
      leadId: lead.id,
      nextMeetingDate: fuDate,
      remarks: `${fuType}: ${fuNotes}`.trim(),
      notes: fuNotes || null,
      priority: fuPriority,
      assignedUserId: fuAssignedTo || lead.assignedUserId || undefined,
      sourceType: "MANUAL",
      type: fuType,
    });
    if (res.success) {
      toast.success("Follow-up scheduled! Log the activity now.");
      setFuModal(false); setFuDate(""); setFuType("Call"); setFuNotes(""); setFuPriority("Medium");
      load();
      // MANDATORY: redirect to activity form to log the actual interaction
      const newFollowUpId = res.data?.id || "";
      router.push(`/activities/new?type=${fuType.toLowerCase()}&leadId=${lead.id}&followUpId=${newFollowUpId}`);
    } else {
      toast.error(res.message || "Failed to add follow-up.");
      setFuSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) { toast.error("Note cannot be empty"); return; }
    setNoteSaving(true);
    const prefix = noteType !== "Note" ? `[${noteType}] ` : "";
    const res = await createNoteAction("LEAD", lead.id, `${prefix}${noteText}`);
    if (res.success) {
      toast.success("Activity added!");
      setNoteModal(false); setNoteText(""); setNoteType("Note");
      setNotes(prev => [res.data, ...prev]);
    } else {
      toast.error(res.message || "Failed to add note.");
      setNoteSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, notesRes, activitiesRes] = await Promise.all([
        getLeadByIdAction(leadId),
        getNotesAction("LEAD", leadId),
        getActivitiesAction({ leadId }),
      ]);
      if (res.success && res.data) {
        setLead(res.data);
        setFollowups((res.data as any).followUps || []);
        setNotes(notesRes.success ? (notesRes.data || []) : []);
        setActivities(activitiesRes.success ? (activitiesRes.data || []) : []);
        // Pre-fill qualification fields
        const ld = res.data as any;
        if (ld.budgetAsked) setBudgetAsked(ld.budgetAsked);
        if (ld.timelineAsked) setTimelineAsked(ld.timelineAsked);
        if (ld.isGenuine) setIsGenuine(true);
        // V2: Pre-fill BANT from existing lead data
        if (ld.budgetAsked?.includes("Confirmed")) setBantBudget(true);
        if (ld.isGenuine) setBantNeed(true);
        if (ld.timelineAsked) {
          const m = ld.timelineAsked.match(/(\d+)/);
          if (m) setBantTimeline(m[1]);
        }
      } else {
        toast.error("Lead not found.");
        router.push("/leads");
      }
      // V2: Load loss reasons for mark-lost dropdown
      try {
        const lrRes = await fetch("/api/loss-reasons?isActive=true");
        const lrData = await lrRes.json();
        if (lrData.success) setLossReasons(lrData.data || []);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  // Auto-open Call Log modal when arriving via "Log First Call" (?action=contact)
  useEffect(() => {
    if (searchParams?.get("action") === "contact" && lead && lead.status === "New" && !callLogModal) {
      handleLeadContact(lead.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, lead]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading lead details..." /></div>
    );
  }

  if (!lead) return null;

  const initials    = getInitials(lead.name);
  const avatarColor = getAvatarColor(lead.name);
  const isConverted = lead.status === "Converted";
  const isLost      = lead.status === "Lost";

  // Centralized workflow state + actions
  const wfState = computeWorkflowState(lead, followups);
  const wfActions = getLeadWorkflowActions(wfState);

  const handleWorkflowAction = (actionId: string) => {
    switch (actionId) {
      case "log-first-call":
        handleLeadContact(lead.id);
        break;
      case "mark-lost":
        handleMarkLost();
        break;
      case "create-followup":
      case "add-followup":
        setFuDate(""); setFuType("Call"); setFuNotes(""); setFuPriority("Medium");
        setFuAssignedTo(lead.assignedUserId || ""); setFuSaving(false); setFuFromCallLog(false); setFuModal(true);
        break;
      case "log-followup-activity": {
        // Find the pending follow-up and redirect to activity form
        const pendingFu = followups.find((f: any) => f.status === "Pending" || f.status === "Overdue");
        if (pendingFu) {
          const fuType = (pendingFu.type || "Call").toLowerCase();
          router.push(`/activities/new?type=${fuType}&leadId=${lead.id}&followUpId=${pendingFu.id}`);
        } else {
          toast.error("No pending follow-up found.");
        }
        break;
      }
      case "reschedule-followup": {
        const pendingFu = followups.find((f: any) => f.status === "Pending" || f.status === "Overdue");
        if (pendingFu) {
          router.push(`/follow-up/${pendingFu.id}`);
        } else {
          toast.error("No pending follow-up to reschedule.");
        }
        break;
      }
      case "start-qualification":
      case "mark-sql":
        setQualModalOpen(true);
        break;
      case "add-activity":
      case "add-sql-activity":
        setNoteText(""); setNoteType("Note"); setNoteSaving(false); setNoteModal(true);
        break;
      case "convert-lead":
        openConvertV2();
        break;
      case "view-sql-leads":
        router.push("/leads?status=SQL");
        break;
      case "view-opportunity":
        router.push("/deals");
        break;
      case "view-account":
        router.push("/customer-master");
        break;
      case "view-contact":
        router.push("/contacts");
        break;
      default:
        break;
    }
  };

  // Icon mapping for workflow actions
  const wfIcon = (iconName?: string) => {
    switch (iconName) {
      case "PhoneCall": return <PhoneCall size={13} />;
      case "CalendarClock": return <CalendarClock size={13} />;
      case "CheckCircle2": return <CheckCircle2 size={13} />;
      case "Briefcase": return <Briefcase size={14} />;
      case "FileText": return <FileText size={13} />;
      case "XCircle": return <XCircle size={14} />;
      case "Building2": return <Building2 size={14} />;
      case "User": return <User size={14} />;
      default: return null;
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",   label: "Overview" },
    { key: "followups",  label: `Follow Ups (${followups.length})` },
    { key: "activities", label: `Activities (${notes.length})` },
    { key: "bant",       label: "BANT Checklist" },
  ];

  return (
    <div className="page-shell space-y-5">

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between gap-3 py-1">
        <button
          onClick={() => router.push("/leads")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[var(--primary)] font-medium transition-colors shrink-0"
        >
          <ArrowLeft size={15} /> Back to Leads
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {wfActions.danger && !isConverted && !isLost && (
            <button
              onClick={() => handleWorkflowAction(wfActions.danger!.id)}
              disabled={markingLost}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {wfIcon(wfActions.danger.icon)}
              {markingLost ? "Marking..." : wfActions.danger.label}
            </button>
          )}
          {isConverted && (
            <span className="h-8 px-3 text-xs bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-100 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Converted
            </span>
          )}
        </div>
      </div>

      {/* ---- SLA Countdown Banner (prominent, near top) ---- */}
      {lead.slaStatus === "Pending" && lead.slaResponseDeadline && !isConverted && !isLost && (() => {
        const minsLeft = Math.floor((new Date(lead.slaResponseDeadline).getTime() - Date.now()) / 60000);
        if (minsLeft <= 0) return (
          <div className="crm-card p-3 flex items-center gap-3 border-red-200 bg-red-50">
            <Clock className="text-red-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-red-700">SLA Breached - Response overdue</p>
              <p className="text-xs text-red-500">This lead has exceeded the 15-minute response SLA. Log a call immediately.</p>
            </div>
          </div>
        );
        return (
          <div className={`crm-card p-3 flex items-center gap-3 ${minsLeft <= 5 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <Clock className={`shrink-0 ${minsLeft <= 5 ? "text-red-600" : "text-amber-600"}`} size={20} />
            <div>
              <p className={`text-sm font-bold ${minsLeft <= 5 ? "text-red-700" : "text-amber-700"}`}>
                SLA Countdown: {minsLeft} min remaining
              </p>
              <p className={`text-xs ${minsLeft <= 5 ? "text-red-500" : "text-amber-600"}`}>
                Respond within {minsLeft} minutes to meet the response SLA.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ---- Guided Workflow Banner ---- */}
      {!isConverted && !isLost && (
        <div className="crm-card p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              wfActions.stage === "New" ? "bg-blue-100 text-blue-600" :
              wfActions.stage === "Contacted" || wfActions.stage === "FollowUpPending" || wfActions.stage === "FollowUpDone" || wfActions.stage === "FollowUpDue" ? "bg-amber-100 text-amber-600" :
              wfActions.stage === "SQL" || wfActions.stage === "Qualification" ? "bg-purple-100 text-purple-600" :
              wfActions.stage === "Qualified" ? "bg-emerald-100 text-emerald-600" :
              "bg-slate-100 text-slate-500"
            )}>
              <Zap size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{wfActions.stage}</p>
              <p className="text-sm text-slate-600">{wfActions.stageDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Primary action from workflow config */}
            {wfActions.primary && (
              <button
                onClick={() => handleWorkflowAction(wfActions.primary!.id)}
                disabled={wfActions.primary.disabled || contacting || qualifying}
                title={wfActions.primary.disabledReason}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {wfIcon(wfActions.primary.icon)}
                {contacting ? "Contacting..." : qualifying ? "Qualifying..." : wfActions.primary.label}
              </button>
            )}
            {/* Secondary actions from workflow config */}
            {wfActions.secondary.map((action) => (
              <button
                key={action.id}
                onClick={() => handleWorkflowAction(action.id)}
                disabled={action.disabled}
                title={action.disabledReason}
                className="text-xs font-semibold text-slate-600 hover:text-[var(--primary)] bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Lead Progress Tracker ---- */}
      {(() => {
        const STAGES = ["New", "Contacted", "SQL", "Qualified", "Converted"];
        const currentIdx = STAGES.indexOf(lead.status);
        const activeIdx = currentIdx === -1 ? (lead.status === "Lost" ? -2 : 0) : currentIdx;
        return (
          <div className="crm-card p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {STAGES.map((stage, idx) => {
                const isDone = idx < activeIdx;
                const isActive = idx === activeIdx;
                const isLost = lead.status === "Lost";
                return (
                  <div key={stage} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        isDone ? "bg-emerald-500 text-white" :
                        isActive && !isLost ? "bg-[var(--primary)] text-white" :
                        isActive && isLost ? "bg-red-500 text-white" :
                        "bg-slate-200 text-slate-400"
                      )}>
                        {isDone ? <CheckCircle2 size={14} /> : idx + 1}
                      </div>
                      <span className={cn(
                        "text-xs font-semibold hidden sm:inline whitespace-nowrap",
                        isActive ? "text-[var(--primary)]" : isDone ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {stage}
                      </span>
                    </div>
                    {idx < STAGES.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-1.5 sm:mx-2 rounded-full transition-all",
                        isDone ? "bg-emerald-400" : "bg-slate-200"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ---- Lead Summary Card ---- */}
      <div className="crm-card p-5">
        <div className="flex items-start gap-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-base font-black shrink-0", avatarColor)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{lead.name}</h1>
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">{lead.leadCode}</span>
              <StatusBadge status={lead.status} showDot size="md" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-6 gap-y-2 mt-3">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  {lead.phone}
                </div>
              )}
              {lead.leadSource && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  {lead.leadSource}
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  {lead.city}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User size={13} className="text-slate-400 shrink-0" />
                Assigned to{" "}
                <span className="font-semibold">{lead.assignedUser?.name || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarClock size={13} className="text-slate-400 shrink-0" />
                Created {formatDate(lead.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mt-6 border-t border-slate-100 pt-4">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "text-sm font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap",
                tab === key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Overview Tab ---- */}
      {tab === "overview" && (
        <div className="crm-card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Lead Information</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-4">
            {[
              { label: "Full Name",   value: lead.name },
              { label: "Lead Code",   value: lead.leadCode },
              { label: "Company",     value: lead.companyName || "-" },
              { label: "Designation", value: lead.designation || "-" },
              { label: "Email",       value: lead.email || "-" },
              { label: "Phone",       value: lead.phone || "-" },
              { label: "Lead Source", value: lead.leadSource || "-" },
              { label: "Industry",    value: lead.industryType || "-" },
              { label: "Est. Value",  value: lead.estimatedValue ? `Rs.${lead.estimatedValue.toLocaleString("en-IN")}` : "-" },
              { label: "Lead Score",  value: (() => {
                const score = lead.leadScore ?? 0;
                const cls = score <= 40 ? "text-rose-600" : score <= 70 ? "text-amber-600" : "text-emerald-600";
                return <span className={cn("font-bold", cls)}>{score}/100</span>;
              })() },
              { label: "Location",    value: lead.city || "-" },
              { label: "Assigned To", value: lead.assignedUser?.name || "Unassigned" },
              { label: "Created",     value: formatDate(lead.createdAt) },
              { label: "SLA Status",  value: (() => {
                const sla = lead.slaStatus;
                if (sla === "Met") return <span className="text-emerald-600 font-bold">Met</span>;
                if (sla === "Breached") return <span className="text-red-600 font-bold">Breached</span>;
                if (sla === "Pending" && lead.slaResponseDeadline) {
                  const minsLeft = Math.floor((new Date(lead.slaResponseDeadline).getTime() - Date.now()) / 60000);
                  if (minsLeft <= 0) return <span className="text-red-600 font-bold">Breached</span>;
                  return <span className="text-amber-600 font-bold">{minsLeft} min remaining</span>;
                }
                return "-";
              })() },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-slate-400 mb-1">{label}</dt>
                <dd className="text-sm font-semibold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>

          {lead.notes && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Notes</h4>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">
                {lead.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Follow Ups Tab ---- */}
      {tab === "followups" && (
        <div className="crm-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-700">Follow Ups</h3>
            <button
              onClick={() => { setFuDate(""); setFuType("Call"); setFuNotes(""); setFuPriority("Medium"); setFuAssignedTo(lead.assignedUserId || ""); setFuSaving(false); setFuModal(true); }}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={13} /> Add Follow-up
            </button>
          </div>
          {followups.length === 0 ? (
            <div className="text-center py-12">
              <CalendarClock size={36} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No follow-ups scheduled</p>
              <p className="text-xs text-slate-300 mt-1 mb-4">Schedule a follow-up to keep this lead warm</p>
              <button
                onClick={() => { setFuDate(""); setFuType("Call"); setFuNotes(""); setFuPriority("Medium"); setFuAssignedTo(lead.assignedUserId || ""); setFuSaving(false); setFuModal(true); }}
                className="btn-primary text-xs flex items-center gap-1.5 mx-auto"
              >
                <Plus size={13} /> Add Follow-up
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {followups.map((f: any) => (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border text-sm",
                    f.status === "Completed" ? "bg-emerald-50 border-emerald-100" :
                    f.status === "Overdue"   ? "bg-red-50 border-red-100" :
                    "bg-slate-50 border-slate-100"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    f.status === "Completed" ? "bg-emerald-400" :
                    f.status === "Overdue"   ? "bg-red-400" : "bg-amber-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">{f.status}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(f.nextMeetingDate)}</span>
                        {f.status !== "Completed" && f.status !== "Cancelled" && (
                          <button
                            onClick={() => {
                              const fuType = (f.type || "Call").toLowerCase();
                              router.push(`/activities/new?type=${fuType}&leadId=${lead.id}&followUpId=${f.id}`);
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            Log Activity
                          </button>
                        )}
                      </div>
                    </div>
                    {(f.remarks || f.notes) && (
                      <p className="text-xs text-slate-500 mt-1">{f.remarks || f.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Activities Tab ---- */}
      {tab === "activities" && (
        <div className="crm-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-700">Activities &amp; Notes</h3>
            <div className="flex items-center gap-2">
              <Link
                href={`/activities/new?leadId=${leadId}&type=call`}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <PhoneCall size={13} /> Log Call
              </Link>
              <button
                onClick={() => { setNoteText(""); setNoteType("Note"); setNoteSaving(false); setNoteModal(true); }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={13} /> Add Note
              </button>
            </div>
          </div>

          {/* CommunicationLog activities (Calls, Meetings, Emails, WhatsApp) */}
          {activities.length > 0 && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Logged Activities</p>
              <div className="space-y-3 mb-5">
                {activities.map((a: any) => {
                  const isCall    = a.channel === "Call";
                  const isMeeting = a.channel === "Meeting";
                  const isEmail   = a.channel === "Email";
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/40 border border-blue-100">
                      {isCall ? (
                        <PhoneCall size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      ) : isMeeting ? (
                        <MessageSquare size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      ) : isEmail ? (
                        <Mail size={14} className="text-purple-500 mt-0.5 shrink-0" />
                      ) : (
                        <FileText size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{a.channel}</span>
                          {a.direction && <span className="text-[10px] text-slate-400">{a.direction}</span>}
                          {a.duration && <span className="text-[10px] text-slate-400">{a.duration} min</span>}
                          {a.followUpId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Follow-Up</span>}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{a.content || a.agenda || "-"}</p>
                        {a.outcome && <p className="text-xs text-slate-500 mt-1">Outcome: {a.outcome}</p>}
                        <p className="text-xs text-slate-400 mt-1.5">
                          {a.sentByUser?.name || "System"} &middot; {formatDateTime(a.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
              <div className="space-y-3">
                {notes.map((n: any) => {
                  const isCall    = n.content?.startsWith("[Call]");
                  const isMeeting = n.content?.startsWith("[Meeting]");
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      {isCall ? (
                        <PhoneCall size={14} className="text-blue-400 mt-0.5 shrink-0" />
                      ) : isMeeting ? (
                        <MessageSquare size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <FileText size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                        <p className="text-xs text-slate-400 mt-1.5">
                          {n.createdBy?.name || "System"} &middot; {formatDate(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activities.length === 0 && notes.length === 0 && (
            <div className="text-center py-12">
              <FileText size={36} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No activities recorded</p>
              <p className="text-xs text-slate-300 mt-1 mb-4">Log a call, meeting, or note to track interactions</p>
              <div className="flex items-center gap-2 justify-center">
                <Link
                  href={`/activities/new?leadId=${leadId}&type=call`}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <PhoneCall size={13} /> Log Call
                </Link>
                <button
                  onClick={() => { setNoteText(""); setNoteType("Note"); setNoteSaving(false); setNoteModal(true); }}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Plus size={13} /> Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- BANT Checklist Tab ---- */}
      {tab === "bant" && (
        <div className="crm-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-700">BANT Qualification Checklist</h3>
              <p className="text-xs text-slate-400 mt-1">Confirm Budget, Authority, Need, and Timeline to qualify as SQL</p>
            </div>
            {lead.status === "SQL" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Already SQL Qualified
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Budget */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              bantBudget ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
            )}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bantBudget}
                  onChange={e => setBantBudget(e.target.checked)}
                  disabled={lead.status === "SQL"}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-bold text-slate-700">B - Budget</span>
                  <p className="text-xs text-slate-500 mt-0.5">Does the prospect have confirmed budget for this purchase?</p>
                </div>
              </label>
            </div>

            {/* Authority */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              bantAuthority ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
            )}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bantAuthority}
                  onChange={e => setBantAuthority(e.target.checked)}
                  disabled={lead.status === "SQL"}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-bold text-slate-700">A - Authority</span>
                  <p className="text-xs text-slate-500 mt-0.5">Is the contact person the decision maker / approver?</p>
                </div>
              </label>
            </div>

            {/* Need */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              bantNeed ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
            )}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bantNeed}
                  onChange={e => setBantNeed(e.target.checked)}
                  disabled={lead.status === "SQL"}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-bold text-slate-700">N - Need</span>
                  <p className="text-xs text-slate-500 mt-0.5">Is there a genuine business need / pain point identified?</p>
                </div>
              </label>
            </div>

            {/* Timeline */}
            <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">T - Timeline (months)</span>
                <p className="text-xs text-slate-500 mt-0.5 mb-2">Expected purchase decision timeline in months</p>
                <input
                  type="number"
                  value={bantTimeline}
                  onChange={e => setBantTimeline(e.target.value)}
                  disabled={lead.status === "SQL"}
                  placeholder="e.g. 3"
                  min="1"
                  className="w-32 px-3 py-2 text-sm rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </label>
            </div>

            {/* Qualify button */}
            {lead.status !== "SQL" && lead.status !== "Converted" && lead.status !== "Lost" && (
              <div className="pt-3">
                <button
                  onClick={handleBANTQualify}
                  disabled={bantSaving || !bantBudget || !bantAuthority || !bantNeed || !bantTimeline}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                >
                  {bantSaving ? "Saving..." : <><CheckCircle2 size={15} /> Qualify as SQL</>}
                </button>
                {(!bantBudget || !bantAuthority || !bantNeed) && (
                  <p className="text-xs text-slate-400 mt-2">All three checkboxes (B, A, N) must be confirmed to qualify.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Qualification Modal (Mark as SQL) ---- */}
      <Modal
        open={qualModalOpen}
        onClose={() => setQualModalOpen(false)}
        title="Qualify Lead as SQL"
        subtitle="Fill in qualification details to promote this lead."
        footer={
          <>
            <button type="button" onClick={() => setQualModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button
              type="button"
              onClick={handleMarkSQL}
              disabled={sqlSaving || !budgetAsked.trim() || !timelineAsked.trim()}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              {sqlSaving ? "Saving..." : <><CheckCircle2 size={14} /> Mark as SQL</>}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Budget Asked (Rs.)" required>
            <Input
              type="text"
              value={budgetAsked}
              onChange={e => setBudgetAsked(e.target.value)}
              placeholder="e.g. 500000"
            />
            <p className="text-xs text-slate-400 mt-1">Enter the budget discussed with the prospect (in INR).</p>
          </FormField>
          <FormField label="Timeline Asked" required>
            <Input
              type="text"
              value={timelineAsked}
              onChange={e => setTimelineAsked(e.target.value)}
              placeholder="e.g. Within 1 month"
            />
            <p className="text-xs text-slate-400 mt-1">When does the prospect plan to make a decision?</p>
          </FormField>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isGenuine}
                onChange={e => setIsGenuine(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-sm text-slate-700">Lead is Genuine (verified requirement)</span>
            </label>
            <p className="text-xs text-slate-400 ml-7">Optional: Check if you've verified the prospect's requirement is real.</p>
          </div>
          <div className={`p-3 rounded-xl text-xs ${budgetAsked.trim() && timelineAsked.trim() ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
            {budgetAsked.trim() && timelineAsked.trim()
              ? "\u2713 Budget and timeline provided. Ready to mark as SQL!"
              : "! Fill Budget and Timeline to enable SQL promotion."}
          </div>
        </div>
      </Modal>

      {/* ---- Success Overlay (guided flow) ---- */}
      <SuccessOverlay
        open={successOverlay.open}
        message={successOverlay.message}
        primary={successOverlay.primary}
        secondary={successOverlay.secondary}
        alternate={successOverlay.alternate}
        onClose={() => setSuccessOverlay(o => ({ ...o, open: false }))}
      />

      {/* ---- Complete Follow-up Modal ---- */}
      <Modal
        open={completeFuModal}
        onClose={() => setCompleteFuModal(false)}
        title="Complete Follow-up"
        subtitle={`Follow-up for: ${lead?.name || ""}`}
        footer={
          <>
            <button type="button" onClick={() => setCompleteFuModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="complete-fu-form" disabled={completeSaving} className="btn-primary text-sm">
              {completeSaving ? <><span className="spinner-brand" /> Saving...</> : "Complete Follow-up"}
            </button>
          </>
        }
      >
        <form id="complete-fu-form" onSubmit={handleCompleteFollowUp} className="p-6 space-y-4">
          <FormField label="Update Lead Status To">
            <Select value={completeLeadStatus} onChange={e => setCompleteLeadStatus(e.target.value)}>
              <option value="Contacted">Contacted - still in discussion</option>
              <option value="SQL">SQL - Sales Qualified Lead</option>
              <option value="Qualified">Qualified - ready to convert</option>
              <option value="Lost">Lost - no longer interested</option>
            </Select>
          </FormField>
          <FormField label="Outcome Remarks" required>
            <textarea
              value={completeRemarks}
              onChange={e => setCompleteRemarks(e.target.value)}
              placeholder="What was the outcome of this follow-up? What was discussed?"
              rows={4}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>
        </form>
      </Modal>

      {/* ---- Post-Complete Suggestion Modal ---- */}
      <Modal
        open={postCompleteModal}
        onClose={() => setPostCompleteModal(false)}
        title="Follow-up Completed - What's Next?"
        subtitle="Choose your next action for this lead."
        footer={
          <button type="button" onClick={handlePostCompleteDone} className="btn-secondary text-sm">
            Done - I'll handle it later
          </button>
        }
      >
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 mb-2">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Follow-up completed!</p>
              <p className="text-xs text-emerald-600 mt-0.5">The follow-up has been marked as completed and lead status updated.</p>
            </div>
          </div>

          <button
            onClick={handlePostCompleteSQL}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-800">Mark as SQL</p>
              <p className="text-xs text-purple-600">Promote to Sales Qualified Lead for deeper sales engagement</p>
            </div>
          </button>

          <button
            onClick={handlePostCompleteQualify}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Qualify Lead</p>
              <p className="text-xs text-emerald-600">Mark as Qualified and auto-create a Customer record</p>
            </div>
          </button>

          <button
            onClick={handlePostCompleteFollowUp}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <CalendarClock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">Schedule Another Follow-up</p>
              <p className="text-xs text-amber-600">Need another call or meeting? Schedule it now</p>
            </div>
          </button>

          <button
            onClick={handlePostCompleteNote}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800">Add Note</p>
              <p className="text-xs text-blue-600">Record additional details about this follow-up</p>
            </div>
          </button>

          <button
            onClick={handlePostCompleteLost}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <XCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Mark Lost</p>
              <p className="text-xs text-red-600">Lead is no longer interested - close as lost</p>
            </div>
          </button>
        </div>
      </Modal>

      {/* ---- Call Log Modal (mandatory flow from "Mark Contacted" / "Log First Call") ---- */}
      <Modal
        open={callLogModal}
        onClose={() => setCallLogModal(false)}
        title="Log Call Activity"
        subtitle={`Required to mark as Contacted: ${lead?.name || ""} (${lead?.leadCode || ""})`}
        footer={
          <>
            <button type="button" onClick={() => setCallLogModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="call-log-form" disabled={callSaving} className="btn-primary text-sm">
              {callSaving ? <><span className="spinner-brand" /> Saving...</> : "Save Call Log"}
            </button>
          </>
        }
      >
        <form id="call-log-form" onSubmit={handleSaveCallLog} className="p-6 space-y-4">
          {/* Auto-filled lead name - no manual search needed */}
          <FormField label="Linked Lead">
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700">
              {lead?.name} <span className="text-xs font-mono text-slate-400 ml-1">{lead?.leadCode}</span>
            </div>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Direction">
              <Select value={callForm.direction} onChange={e => setCallForm(f => ({ ...f, direction: e.target.value }))}>
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </Select>
            </FormField>
            <FormField label="Duration (minutes)">
              <Input type="number" value={callForm.duration} onChange={e => setCallForm(f => ({ ...f, duration: e.target.value }))} placeholder="15" />
            </FormField>
            <FormField label="Status">
              <Select value={callForm.status} onChange={e => setCallForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Completed">Completed</option>
                <option value="NoAnswer">No Answer</option>
                <option value="Scheduled">Scheduled</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Notes / Outcome" required>
            <textarea
              value={callForm.content}
              onChange={e => setCallForm(f => ({ ...f, content: e.target.value }))}
              placeholder="What was discussed? What was the outcome?"
              rows={4}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>
        </form>
      </Modal>

      {/* ---- Follow-up Prompt Modal (after call log saved) ---- */}
      <Modal
        open={fuPromptModal}
        onClose={() => setFuPromptModal(false)}
        title="Call Logged - Next Step?"
        subtitle="Does this lead need a follow-up?"
        footer={
          <>
            <button type="button" onClick={handleNoFollowUp} className="btn-secondary text-sm">
              No, still in discussion
            </button>
            <button type="button" onClick={handleYesFollowUp} className="btn-primary text-sm flex items-center gap-1.5">
              <CalendarClock size={14} /> Yes, Schedule Follow-up
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Call logged successfully!</p>
              <p className="text-xs text-emerald-600 mt-0.5">The call activity has been recorded in the timeline.</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Would you like to schedule a follow-up for this lead? If the prospect is interested,
            you can schedule a call or meeting right now.
          </p>
        </div>
      </Modal>

      {/* ---- Next Action Modal (after "still in discussion") ---- */}
      <Modal
        open={nextActionModal}
        onClose={() => setNextActionModal(false)}
        title="What's Next?"
        subtitle="Lead is now Contacted. Choose your next action."
        footer={
          <button type="button" onClick={handleNextActionDone} className="btn-secondary text-sm">
            Done - I'll handle it later
          </button>
        }
      >
        <div className="p-6 space-y-3">
          <button
            onClick={handleNextActionSQL}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-800">Mark as SQL</p>
              <p className="text-xs text-purple-600">Promote this lead to Sales Qualified Lead for deeper sales engagement</p>
            </div>
          </button>

          <button
            onClick={handleNextActionNote}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800">Add Note</p>
              <p className="text-xs text-blue-600">Record additional details about this discussion</p>
            </div>
          </button>

          <button
            onClick={handleNextActionFollowUp}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <CalendarClock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">Schedule Follow-up</p>
              <p className="text-xs text-amber-600">Changed your mind? Schedule a follow-up call or meeting now</p>
            </div>
          </button>
        </div>
      </Modal>

      {/* ---- Add Follow-up Modal ---- */}
      <Modal
        open={fuModal}
        onClose={() => { setFuModal(false); setFuFromCallLog(false); }}
        title="Add Follow-up"
        subtitle="Schedule a call or meeting follow-up for this lead."
        footer={
          <>
            <button type="button" onClick={() => setFuModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="add-followup-form" disabled={fuSaving} className="btn-primary text-sm">
              {fuSaving ? <><span className="spinner-brand" /> Saving...</> : "Save Follow-up"}
            </button>
          </>
        }
      >
        <form id="add-followup-form" onSubmit={fuFromCallLog ? handleGuidedFollowUpSave : handleAddFollowUp} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date & Time" required>
              <Input type="datetime-local" value={fuDate} onChange={e => setFuDate(e.target.value)} required />
            </FormField>
            <FormField label="Type" required>
              <select
                value={fuType}
                onChange={e => setFuType(e.target.value as any)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Note">Note</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Assign To" required>
              {user?.role === "SalesExecutive" ? (
                <Input
                  value={user.name || "You (default)"}
                  disabled
                  className="bg-slate-50 text-slate-500"
                />
              ) : (
                <select
                  value={fuAssignedTo}
                  onChange={e => setFuAssignedTo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">Lead owner (default)</option>
                  {executives.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} - {ex.role}</option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Priority">
              <select
                value={fuPriority}
                onChange={e => setFuPriority(e.target.value as any)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="High">" High</option>
                <option value="Medium"> Medium</option>
                <option value="Low"> Low</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea
              value={fuNotes}
              onChange={e => setFuNotes(e.target.value)}
              placeholder="What should be discussed or planned..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>
        </form>
      </Modal>

      {/* ---- Add Activity / Note Modal ---- */}
      <Modal
        open={noteModal}
        onClose={() => setNoteModal(false)}
        title="Log Activity"
        subtitle="Add a call log, meeting note, or general note for this lead."
        footer={
          <>
            <button type="button" onClick={() => setNoteModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="add-note-form" disabled={noteSaving} className="btn-primary text-sm">
              {noteSaving ? <><span className="spinner-brand" /> Saving...</> : "Save Activity"}
            </button>
          </>
        }
      >
        <form id="add-note-form" onSubmit={handleAddNote} className="p-6 space-y-4">
          <FormField label="Type" required>
            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="Note">Note</option>
              <option value="Call">Call Log</option>
              <option value="Meeting">Meeting</option>
            </select>
          </FormField>
          <FormField label="Details" required>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder={noteType === "Call" ? "e.g. Called to discuss delivery timeline. Follow-up needed." : noteType === "Meeting" ? "e.g. Plant visit at Pune facility - discussed requirements." : "Add your note here..."}
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* ---- Convert to Deal Modal ---- */}
      <Modal
        open={convertModal}
        onClose={() => setConvertModal(false)}
        title="Convert Lead to Deal"
        subtitle="This will promote the lead to an active customer and create a new deal."
        footer={
          <>
            <button type="button" onClick={() => setConvertModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="convert-lead-form" disabled={converting} className="btn-primary text-sm">
              {converting ? <><span className="spinner-brand" /> Converting...</> : "Convert & Create Deal"}
            </button>
          </>
        }
      >
        <form id="convert-lead-form" onSubmit={handleConvert} className="p-6 space-y-4">
          <FormField label="Deal Name" required>
            <Input value={dealName} onChange={e => setDealName(e.target.value)} placeholder="e.g. Acme Corp - Initial Deal" required />
          </FormField>
          <FormField label="Deal Value (INR)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rs.</span>
              <Input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0.00" className="pl-7" required />
            </div>
          </FormField>
          <FormField label="Expected Close Date" required>
            <Input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} required />
          </FormField>
        </form>
      </Modal>

      {/* ---- Lost Reason Modal ---- */}
      <Modal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        title="Mark Lead as Lost"
        subtitle={`Reason required for: ${lead?.name || ""} (${lead?.leadCode || ""})`}
        footer={
          <>
            <button type="button" onClick={() => setShowLostModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button
              type="button"
              onClick={handleConfirmLost}
              disabled={markingLost || (!selectedLossReasonId && !lostReason.trim())}
              className="btn-danger text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              {markingLost ? "Marking..." : <><XCircle size={14} /> Confirm Mark Lost</>}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {(lead?.status === "SQL" || lead?.status === "Qualified") && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <XCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">This lead is already {lead?.status}</p>
                <p className="text-xs text-amber-600 mt-0.5">Marking it as lost will discard the qualification progress. This action cannot be undone.</p>
              </div>
            </div>
          )}
          <FormField label="Loss Reason" required>
            <Select
              value={selectedLossReasonId}
              onChange={e => setSelectedLossReasonId(e.target.value)}
            >
              <option value="">Select a reason...</option>
              {lossReasons.map(lr => (
                <option key={lr.id} value={lr.id}>{lr.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Additional notes (optional)">
            <textarea
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              placeholder="Any additional context about why this lead was lost..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>
        </div>
      </Modal>

      {/* V2 Convert Lead Modal (3-section accordion) */}
      <Modal
        open={convertV2Modal}
        onClose={() => setConvertV2Modal(false)}
        title="Convert Lead"
        subtitle="Create Account + Contact + Opportunity atomically"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setConvertV2Modal(false)} className="btn-secondary text-sm">Cancel</button>
            {convertSection > 0 && (
              <button type="button" onClick={() => setConvertSection(s => s - 1)} className="btn-ghost text-sm">Back</button>
            )}
            {convertSection < 2 ? (
              <button type="button" onClick={() => setConvertSection(s => s + 1)} className="btn-primary text-sm">Next</button>
            ) : (
              <button
                type="button"
                onClick={handleConvertV2}
                disabled={convertV2Saving}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40"
              >
                {convertV2Saving ? <><span className="spinner-brand" /> Converting...</> : <><CheckCircle2 size={14} /> Convert Lead</>}
              </button>
            )}
          </>
        }
      >
        <div className="p-6 space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-4">
            {["Account", "Contact", "Opportunity"].map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  idx === convertSection
                    ? "bg-[var(--primary)] text-white"
                    : idx < convertSection
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
                )}>
                  {idx < convertSection ? "\u2713" : idx + 1}
                </div>
                <span className={cn("text-xs font-semibold", idx === convertSection ? "text-slate-700" : "text-slate-400")}>{label}</span>
                {idx < 2 && <div className="w-8 h-px bg-slate-200" />}
              </div>
            ))}
          </div>

          {/* Section 0: Account */}
          {convertSection === 0 && (
            <div className="space-y-4">
              <FormField label="Company Name" required>
                <Input
                  value={convertForm.companyName}
                  onChange={e => setConvertForm(p => ({ ...p, companyName: e.target.value }))}
                  placeholder="ABC Industries Pvt Ltd"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="GSTIN (optional)">
                  <Input
                    value={convertForm.gstNumber}
                    onChange={e => setConvertForm(p => ({ ...p, gstNumber: e.target.value.toUpperCase() }))}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                  />
                </FormField>
                <FormField label="Account Type">
                  <Select
                    value={convertForm.accountType}
                    onChange={e => setConvertForm(p => ({ ...p, accountType: e.target.value }))}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Reseller">Reseller</option>
                    <option value="Partner">Partner</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Industry">
                <Select
                  value={convertForm.industryType}
                  onChange={e => setConvertForm(p => ({ ...p, industryType: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {["Automotive", "Pharma", "Textile", "FMCG", "Infrastructure", "Others"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Billing Address (optional)">
                <textarea
                  value={convertForm.billingAddress}
                  onChange={e => setConvertForm(p => ({ ...p, billingAddress: e.target.value }))}
                  placeholder="Plot No, Street, City, State, PIN"
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                />
              </FormField>
            </div>
          )}

          {/* Section 1: Contact */}
          {convertSection === 1 && (
            <div className="space-y-4">
              <FormField label="Contact Name" required>
                <Input
                  value={convertForm.contactName}
                  onChange={e => setConvertForm(p => ({ ...p, contactName: e.target.value }))}
                  placeholder="John Doe"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Designation">
                  <Input
                    value={convertForm.contactDesignation}
                    onChange={e => setConvertForm(p => ({ ...p, contactDesignation: e.target.value }))}
                    placeholder="Purchase Manager"
                  />
                </FormField>
                <FormField label="Contact Category">
                  <Select
                    value={convertForm.contactCategory}
                    onChange={e => setConvertForm(p => ({ ...p, contactCategory: e.target.value }))}
                  >
                    <option value="Technical">Technical</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Finance">Finance</option>
                    <option value="Management">Management</option>
                  </Select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email">
                  <Input
                    type="email"
                    value={convertForm.contactEmail}
                    onChange={e => setConvertForm(p => ({ ...p, contactEmail: e.target.value }))}
                    placeholder="john@abc.com"
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    type="tel"
                    value={convertForm.contactPhone}
                    onChange={e => setConvertForm(p => ({ ...p, contactPhone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Section 2: Opportunity */}
          {convertSection === 2 && (
            <div className="space-y-4">
              <FormField label="Opportunity Name" required>
                <Input
                  value={convertForm.oppName}
                  onChange={e => setConvertForm(p => ({ ...p, oppName: e.target.value }))}
                  placeholder="Supply of industrial equipment"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Estimated Value (Rs.)">
                  <Input
                    type="number"
                    value={convertForm.oppValue}
                    onChange={e => setConvertForm(p => ({ ...p, oppValue: e.target.value }))}
                    placeholder="500000"
                    min="0"
                  />
                </FormField>
                <FormField label="Expected Close Date" required>
                  <Input
                    type="date"
                    value={convertForm.oppCloseDate}
                    onChange={e => setConvertForm(p => ({ ...p, oppCloseDate: e.target.value }))}
                  />
                </FormField>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  This will atomically create an Account, Contact, and Opportunity.
                  The lead will be marked as Converted and all follow-ups will be linked to the new account.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

