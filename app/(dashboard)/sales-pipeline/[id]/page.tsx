"use client";
import { CRMSpinner } from "@/components/CRMSpinner";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getDealByIdAction, updateDealStatusAction, saveOpportunityDetailAction } from "@/app/actions/deals";
import { getActivitiesAction, createMeetingAction, deleteActivityAction } from "@/app/actions/activities";
import { getTasksAction, createTaskAction } from "@/app/actions/tasks";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { NotePanel } from "@/components/ui/NotePanel";
import { formatDate } from "@/lib/ui-utils";
import { ArrowLeft, CheckCircle, Clock, Save, LayoutTemplate, Briefcase, FileText, Check, AlertTriangle, ChevronRight, CheckSquare, Square, FileUp, Circle, Download, Eye, X, Upload, ChevronLeft, Plus, FileText as FileIcon } from "lucide-react";

const STAGES = {
  SalesOpportunity: "Qualified",
  RequirementGathering: "Requirement Gathering",
  MeetingScheduled: "Meeting Scheduled",
  SolutionReview: "Solution Review",
  ProposalSent: "Proposal Sent",
  Negotiation: "Negotiation / Approval",
  Active: "Active Deal",
  Won: "Won",
  Lost: "Lost",
};

// Pipeline stage order for progress display
const PIPELINE_STAGES = [
  "SalesOpportunity",
  "RequirementGathering",
  "MeetingScheduled",
  "SolutionReview",
  "ProposalSent",
  "Negotiation",
];

// Stages that show the requirement gathering wizard
const RG_WIZARD_STAGES = ["SalesOpportunity", "RequirementGathering"];

// Post-meeting pipeline stages shown in the stepper
const POST_MEETING_STAGES = [
  { key: "MeetingScheduled", label: "Meeting Scheduled" },
  { key: "SolutionReview", label: "Solution Review" },
  { key: "ProposalSent", label: "Proposal Sent" },
  { key: "Negotiation", label: "Negotiation" },
];

const MODULES_LIST = ["Leads Management", "Contacts Management", "Sales Pipeline", "Follow-Ups", "Reports & Analytics", "Custom Module"];
const PAIN_POINTS_LIST = ["No CRM System", "Manual Excel Tracking", "Poor Follow-up Tracking", "No Reporting", "No Customer Visibility", "Other"];
const INTEGRATIONS_LIST = ["WhatsApp", "Email", "ERP", "Tally", "SAP", "API Integration", "Other"];
const TIMELINE_OPTIONS = ["Immediate", "1 Month", "3 Months", "6 Months", "Later"];
const BUDGET_OPTIONS = ["< â‚¹50,000", "â‚¹50,000 - â‚¹2,00,000", "â‚¹2,00,000 - â‚¹5,00,000", "â‚¹5,00,000+"];

// Wizard steps configuration
const WIZARD_STEPS = [
  { id: "customer_details", label: "Customer Details", icon: "User" },
  { id: "business_req", label: "Business Requirements", icon: "Briefcase" },
  { id: "tech_req", label: "Technical Assessment", icon: "Cpu" },
  { id: "commercial_info", label: "Commercial", icon: "DollarSign" },
  { id: "review", label: "Review", icon: "CheckCircle" },
];

// Requirement Gathering sections (for validation)
const RG_SECTIONS = ["customer_info", "business_req", "tech_req", "commercial_info", "internal_notes"];
const RG_SECTION_LABELS: Record<string, string> = {
  customer_info: "Customer Details",
  business_req: "Business Requirements",
  tech_req: "Technical Requirements",
  commercial_info: "Commercial Info",
  internal_notes: "Internal Notes",
};
const SECTION_REQUIRED: Record<string, { key: string; label: string; type?: "array"; format?: "email" | "phone" }[]> = {
  customer_info: [
    { key: "companyName", label: "Company Name" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "email", label: "Email", format: "email" },
    { key: "phone", label: "Phone", format: "phone" },
    { key: "decisionMaker", label: "Decision Maker" },
  ],
  business_req: [
    { key: "businessNeed", label: "Business Need" },
    { key: "modulesRequired", label: "Modules Required", type: "array" },
  ],
  tech_req: [
    { key: "deploymentType", label: "Deployment Type" },
  ],
  commercial_info: [
    { key: "budgetRange", label: "Budget Details" },
    { key: "timeline", label: "Implementation Timeline" },
  ],
  internal_notes: [
    { key: "nextSteps", label: "Next Steps" },
  ],
};

export default function OpportunityWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // Post-meeting stage viewer: which stage the user is viewing (defaults to deal.status)
  const [pipelineStageView, setPipelineStageView] = useState<string>("");
  
  // Form State
  const [detailsForm, setDetailsForm] = useState<any>({});
  
  // Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  // Sections the user tried to advance past while required fields were missing
  const [errorSections, setErrorSections] = useState<Record<string, boolean>>({});
  // Meeting outcome / follow-up state
  const [meetingOutcomeChoice, setMeetingOutcomeChoice] = useState("");
  const [followUpForm, setFollowUpForm] = useState<{ date: string; agenda: string; notes: string }>({ date: "", agenda: "", notes: "" });
  const [onHoldNotes, setOnHoldNotes] = useState("");

  // Success overlay for guided stage progression
  const [successOverlay, setSuccessOverlay] = useState<{ open: boolean; message: string; primary: SuccessAction; secondary?: SuccessAction; alternate?: SuccessAction }>({
    open: false, message: "", primary: { label: "", href: "" },
  });

  // Activities & Tasks for this deal
  const [dealActivities, setDealActivities] = useState<any[]>([]);
  const [dealTasks, setDealTasks] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, actRes, taskRes] = await Promise.all([
        getDealByIdAction(dealId),
        getActivitiesAction({ dealId }),
        getTasksAction({ dealId }),
      ]);
      if (res.success && res.data) {
        setDeal(res.data);
        setDetailsForm(res.data.opportunityDetail || {});
        setPipelineStageView(res.data.status);
        setDealActivities(actRes.success ? (actRes.data || []) : []);
        setDealTasks(taskRes.success ? (taskRes.data || []) : []);
      } else {
        toast.error("Opportunity not found.");
        router.push("/sales-pipeline");
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, router, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSaveDetails = async (silent = false) => {
    if (!silent) setIsSubmitting(true);
    const res = await saveOpportunityDetailAction(dealId, detailsForm);
    if (!silent) {
      if (res.success) toast.success("Draft saved successfully.");
      else toast.error(res.message);
      setIsSubmitting(false);
      load();
    }
    return res.success;
  };

  const handleAdvanceStage = async (nextStage: string) => {
    setIsSubmitting(true);
    // Save details right before advancing to ensure backend validations pass
    await saveOpportunityDetailAction(dealId, detailsForm);
    
    const res = await updateDealStatusAction(dealId, nextStage);
    if (res.success) {
      toast.success(res.message);
      setShowCompleteModal(false);
      load();

      // Success overlay with guided next steps based on stage
      const stageLabels: Record<string, string> = {
        SalesOpportunity: "New Opportunity",
        RequirementGathering: "Requirement Gathering",
        MeetingScheduled: "Meeting Scheduled",
        SolutionReview: "Solution Review",
        ProposalSent: "Proposal Sent",
        Negotiation: "Negotiation / Approval",
        Active: "Active Deal",
        Won: "Deal Won!",
        Lost: "Deal Lost",
      };
      const stageLabel = stageLabels[nextStage] || nextStage;

      if (nextStage === "RequirementGathering") {
        setSuccessOverlay({
          open: true,
          message: `Stage advanced to: ${stageLabel}. Fill in the requirement details below.`,
          primary: { label: "Fill Requirements", href: `javascript:void(0)`, icon: <FileText size={16} />, onClick: () => setCurrentStep(1) },
          secondary: { label: "Log Meeting", href: `/activities/new?dealId=${dealId}&type=Meeting` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "MeetingScheduled") {
        setSuccessOverlay({
          open: true,
          message: `Stage advanced to: ${stageLabel}. Schedule a demo/meeting with the customer.`,
          primary: { label: "Schedule Meeting", href: `/activities/new?dealId=${dealId}&type=Meeting`, icon: <CheckCircle size={16} /> },
          secondary: { label: "Create Task", href: `/tasks/new?dealId=${dealId}` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "SolutionReview") {
        setSuccessOverlay({
          open: true,
          message: `Stage advanced to: ${stageLabel}. Define the proposed solution and scope.`,
          primary: { label: "Fill Solution Details", href: `javascript:void(0)`, icon: <FileText size={16} />, onClick: () => {} },
          secondary: { label: "Log Activity", href: `/activities/new?dealId=${dealId}&type=note` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "ProposalSent") {
        setSuccessOverlay({
          open: true,
          message: `Stage advanced to: ${stageLabel}. Proposal has been sent to the customer.`,
          primary: { label: "Log Proposal Activity", href: `/activities/new?dealId=${dealId}&type=note` },
          secondary: { label: "Move to Negotiation", href: "" },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "Negotiation") {
        setSuccessOverlay({
          open: true,
          message: `Stage advanced to: ${stageLabel}. Negotiate terms and get approval.`,
          primary: { label: "Mark as Won", href: "" },
          secondary: { label: "Log Negotiation Note", href: `/activities/new?dealId=${dealId}&type=note` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "Active") {
        setSuccessOverlay({
          open: true,
          message: `Deal is now Active! Customer record updated.`,
          primary: { label: "View Customer", href: `/customer-master/${deal?.customerId || ""}` },
          secondary: { label: "Create Task", href: `/tasks/new?dealId=${dealId}` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "Won") {
        setSuccessOverlay({
          open: true,
          message: `ðŸŽ‰ Deal Won! Customer activated successfully.`,
          primary: { label: "View Customer", href: `/customer-master/${deal?.customerId || ""}` },
          secondary: { label: "Create Onboarding Task", href: `/tasks/new?dealId=${dealId}` },
          alternate: { label: "Back to Pipeline", href: "/sales-pipeline" },
        });
      } else if (nextStage === "Lost") {
        setSuccessOverlay({
          open: true,
          message: `Deal marked as Lost.`,
          primary: { label: "Back to Pipeline", href: "/sales-pipeline" },
          secondary: { label: "View All Deals", href: "/sales-pipeline" },
        });
      }
    } else {
      toast.error(res.message);
    }
    setIsSubmitting(false);
  };

  // Checkbox helpers
  const handleCheckboxToggle = (field: string, value: string) => {
    let current = [];
    try { current = detailsForm[field] ? JSON.parse(detailsForm[field]) : []; } catch (e) {}
    if (current.includes(value)) {
      current = current.filter((v: string) => v !== value);
    } else {
      current.push(value);
    }
    setDetailsForm({ ...detailsForm, [field]: JSON.stringify(current) });
  };

  const hasCheckbox = (field: string, value: string) => {
    try {
      const current = detailsForm[field] ? JSON.parse(detailsForm[field]) : [];
      return current.includes(value);
    } catch(e) { return false; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading workspace..." /></div>
    );
  }

  if (!deal) return null;

  // â”€â”€ Requirement Gathering: validation, completion & document helpers â”€â”€
  const customerFallback: Record<string, any> = {
    companyName: deal.customer?.name,
    contactPerson: deal.customer?.contactPerson,
    email: deal.customer?.email,
    phone: deal.customer?.phone,
  };
  const fieldValue = (key: string) => {
    const v = detailsForm[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    return customerFallback[key] ?? "";
  };
  const arrayFilled = (key: string) => {
    try { return JSON.parse(detailsForm[key] || "[]").length > 0; } catch { return false; }
  };
  const validateSection = (sectionId: string): string[] => {
    const reqs = SECTION_REQUIRED[sectionId] || [];
    const missing: string[] = [];
    for (const r of reqs) {
      if (r.type === "array") {
        if (!arrayFilled(r.key)) missing.push(r.label);
        continue;
      }
      const raw = String(fieldValue(r.key) ?? "").trim();
      if (raw === "") { missing.push(r.label); continue; }
      if (r.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        missing.push(`${r.label} (invalid email)`);
      } else if (r.format === "phone" && !/^\+?[0-9]{7,15}$/.test(raw.replace(/[\s()-]/g, ""))) {
        missing.push(`${r.label} (invalid phone)`);
      }
    }
    return missing;
  };

  // Wizard navigation handlers
  const handleNextStep = () => {
    const stepId = WIZARD_STEPS[currentStep].id;
    if (stepId === "review") return; // Review is final step
    const missing = validateSection(stepId);
    if (missing.length > 0) {
      toast.error(`Please fill all required fields: ${missing.join(", ")}`);
      return;
    }
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBackStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    const res = await saveOpportunityDetailAction(dealId, detailsForm);
    setIsSubmitting(false);
    if (res.success) {
      toast.success("Draft saved successfully.");
    } else {
      toast.error(res.message || "Failed to save draft.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  // Calculate completion percentage
  const completedSteps = WIZARD_STEPS.filter((step, idx) => {
    if (idx > currentStep) return false;
    if (idx === currentStep) {
      const missing = validateSection(step.id);
      return missing.length === 0;
    }
    return true;
  }).length;
  const completionPercent = Math.round((completedSteps / WIZARD_STEPS.length) * 100);
  const isSectionComplete = (sectionId: string) => validateSection(sectionId).length === 0;
  const sectionState = (sectionId: string): "complete" | "error" | "default" => {
    if (isSectionComplete(sectionId)) return "complete";
    if (errorSections[sectionId]) return "error";
    return "default";
  };
  const allSectionsComplete = RG_SECTIONS.every(isSectionComplete);
  const isReadOnly = ["Won", "Lost"].includes(deal.status);
  // True when user is viewing a completed stage (not the current active stage)
  const isReviewingPastStage = POST_MEETING_STAGES.some(s => s.key === deal.status) && pipelineStageView !== deal.status;

  // Meeting history (logged as Meeting activities) + the next scheduled follow-up
  const meetingActs = (dealActivities || []).filter((a: any) => a.channel === "Meeting");
  const upcomingFollowUp = meetingActs
    .filter((a: any) => a.status === "Scheduled" && a.meetingDate)
    .sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];

  const handleScheduleFollowUp = async () => {
    if (!followUpForm.date) { toast.error("Please pick the next meeting date."); return; }
    if (new Date(followUpForm.date).getTime() <= Date.now()) { toast.error("Next meeting must be in the future."); return; }
    setIsSubmitting(true);
    try {
      // 1. Log the meeting that just happened (if notes were captured)
      if (followUpForm.notes.trim()) {
        await createMeetingAction({
          dealId, meetingDate: new Date().toISOString(),
          mode: detailsForm.meetingMode || null, agenda: detailsForm.meetingAgenda || null,
          outcome: "Follow-up required", content: followUpForm.notes, status: "Completed",
        });
      }
      // 2. Log the next scheduled follow-up meeting
      await createMeetingAction({
        dealId, meetingDate: new Date(followUpForm.date).toISOString(),
        agenda: followUpForm.agenda || "Follow-up meeting",
        content: "Follow-up meeting scheduled", status: "Scheduled",
      });
      // 3. Auto-create a reminder Task for the follow-up
      await createTaskAction({
        title: `Follow-up meeting â€” ${deal?.dealName || "Deal"}`,
        description: followUpForm.agenda || "Follow-up meeting scheduled from sales pipeline.",
        dueDate: followUpForm.date,
        dealId,
        priority: "High",
      });
      // 4. Record the decision on the opportunity (stage stays at MeetingScheduled)
      await saveOpportunityDetailAction(dealId, { ...detailsForm, meetingOutcome: "FollowUp" });
      setFollowUpForm({ date: "", agenda: "", notes: "" });
      setMeetingOutcomeChoice("");
      toast.success("Follow-up scheduled. Deal stays in Meeting Scheduled.");
      load();
    } catch {
      toast.error("Failed to schedule follow-up.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnHold = async () => {
    setIsSubmitting(true);
    try {
      if (onHoldNotes.trim()) {
        await createMeetingAction({
          dealId, meetingDate: new Date().toISOString(),
          outcome: "On Hold", content: onHoldNotes, status: "Completed",
        });
      }
      await saveOpportunityDetailAction(dealId, { ...detailsForm, meetingOutcome: "OnHold" });
      setOnHoldNotes("");
      setMeetingOutcomeChoice("");
      toast.success("Marked on hold. You can resume anytime.");
      load();
    } catch {
      toast.error("Failed to update.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    const stepId = WIZARD_STEPS[currentStep].id;
    const missing = validateSection(stepId);
    if (missing.length) {
      setErrorSections(s => ({ ...s, [stepId]: true }));
      toast.error(`Please fill all required fields: ${missing.join(", ")}`);
      return;
    }
    setIsSubmitting(true);
    const res = await saveOpportunityDetailAction(dealId, detailsForm);
    setIsSubmitting(false);
    if (!res.success) { toast.error(res.message || "Failed to save section."); return; }
    setErrorSections(s => ({ ...s, [stepId]: false }));
    setDeal((d: any) => ({ ...d, opportunityDetail: { ...(d?.opportunityDetail || {}), ...detailsForm } }));
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      toast.success(`${WIZARD_STEPS[currentStep].label} saved.`);
      return;
    }
    // Final step saved. If every section is valid, persist completion + auto-advance the pipeline.
    if (allSectionsComplete) {
      const completedForm = { ...detailsForm, requirementCompletedAt: new Date().toISOString() };
      setDetailsForm(completedForm);
      await saveOpportunityDetailAction(dealId, completedForm);
      if (["RequirementGathering", "SalesOpportunity"].includes(deal.status)) {
        await handleAdvanceStage("MeetingScheduled");
      } else {
        toast.success("All requirement sections completed!");
      }
    } else {
      toast.success("Section saved. Complete the remaining sections to finish requirement gathering.");
    }
  };

  // Consolidated document data (used by both the View modal and PDF export)
  const buildDocSections = () => {
    const f = (k: string) => { const v = fieldValue(k); return (v === null || v === undefined || String(v).trim() === "") ? "â€”" : String(v); };
    const arr = (k: string) => { try { const a = JSON.parse(detailsForm[k] || "[]"); return a.length ? a.join(", ") : "â€”"; } catch { return "â€”"; } };
    return [
      { title: "Customer Info", rows: [
        ["Company Name", f("companyName")], ["Industry", f("industry")],
        ["Contact Person", f("contactPerson")], ["Email", f("email")],
        ["Phone", f("phone")], ["Decision Maker", f("decisionMaker")],
      ] as [string, string][] },
      { title: "Business Requirements", rows: [
        ["Business Need", f("businessNeed")], ["Expected Outcome", f("expectedOutcome")],
        ["Modules Required", arr("modulesRequired")], ["Urgency", f("urgencyPriority")],
        ["Success Criteria", f("successCriteria")],
      ] as [string, string][] },
      { title: "Technical Requirements", rows: [
        ["Deployment Type", f("deploymentType")], ["Integrations", arr("integrationsRequired")],
        ["Security / Compliance", f("securityCompliance")], ["Data Migration", f("dataMigrationRequired")],
      ] as [string, string][] },
      { title: "Commercial Info", rows: [
        ["Budget Range", f("budgetRange")], ["Implementation Timeline", f("timeline")],
        ["Expected Budget", f("expectedBudget")], ["Pricing Model", f("pricingModel")],
      ] as [string, string][] },
      { title: "Internal Notes", rows: [
        ["Internal Sales Notes", f("internalSalesNotes")], ["Next Steps", f("nextSteps")],
        ["Risks / Blockers", f("risksBlockers")],
      ] as [string, string][] },
    ];
  };

  const handleDownloadPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40; let y = margin;
      doc.setFontSize(16); doc.text("Requirement Gathering Document", margin, y); y += 20;
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`${deal.dealName} â€” ${deal.customer?.name || ""}`, margin, y); y += 8;
      for (const s of buildDocSections()) {
        autoTable(doc, {
          startY: y,
          head: [[s.title, ""]],
          body: s.rows,
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { cellWidth: 170, fontStyle: "bold", textColor: 60 } },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      }
      doc.save(`${(deal.dealName || "Deal").replace(/\s+/g, "_")}_Requirements.pdf`);
    } catch (e) {
      toast.error("Failed to generate PDF.");
    }
  };

  // Validation Check for Modal
  const isBudgetFilled = !!detailsForm.budgetRange;
  const isTimelineFilled = !!detailsForm.timeline;
  const isDecisionMakerFilled = !!detailsForm.decisionMaker;
  const isModulesFilled = (() => { try { return JSON.parse(detailsForm.modulesRequired || "[]").length > 0; } catch { return false; } })();
  const allMandatoryFilled = isBudgetFilled && isTimelineFilled && isDecisionMakerFilled && isModulesFilled;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/sales-pipeline")} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{deal.dealName}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                  {(STAGES as any)[deal.status] || deal.status}
                </span>
                <span>â€¢ {deal.customer?.name}</span>
                <span>â€¢ {formatCurrency(deal.dealValue)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-slate-500">
              {completionPercent}% Complete
            </div>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--primary)] transition-all duration-300" 
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Stepper - only for Requirement Gathering stages */}
      {RG_WIZARD_STAGES.includes(deal.status) && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {WIZARD_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                const isClickable = isCompleted || idx === currentStep;
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      onClick={() => isClickable && setCurrentStep(idx)}
                      disabled={!isClickable}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        isCurrent 
                          ? "text-blue-600" 
                          : isCompleted 
                          ? "text-emerald-600 hover:text-emerald-700" 
                          : "text-slate-400"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : isCurrent 
                          ? "bg-[var(--primary)] border-blue-600 text-white" 
                          : "bg-white border-slate-300 text-slate-400"
                      }`}>
                        {isCompleted ? <Check size={14} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </div>
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                    {idx < WIZARD_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                        isCompleted ? "bg-emerald-500" : "bg-slate-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Post-Meeting Pipeline Stepper - for MeetingScheduled and beyond */}
      {POST_MEETING_STAGES.some(s => s.key === deal.status) && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {POST_MEETING_STAGES.map((stage, idx) => {
                const currentIdx = POST_MEETING_STAGES.findIndex(s => s.key === deal.status);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isViewing = pipelineStageView === stage.key;
                const isClickable = idx <= currentIdx; // can view completed + current
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <button
                      onClick={() => isClickable && setPipelineStageView(stage.key)}
                      disabled={!isClickable}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        isViewing
                          ? "text-blue-600"
                          : isCurrent
                          ? "text-blue-600"
                          : isCompleted
                          ? "text-emerald-600 cursor-pointer hover:text-emerald-700"
                          : "text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        isViewing || isCurrent
                          ? "bg-[var(--primary)] text-white border-blue-600"
                          : isCompleted
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-400 border-slate-300"
                      }`}>
                        {isCompleted ? <Check size={14} /> : idx + 1}
                      </span>
                      <span className="hidden sm:inline">{stage.label}</span>
                    </button>
                    {idx < POST_MEETING_STAGES.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                        isCompleted ? "bg-emerald-500" : "bg-slate-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Stage Based */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stage-specific content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* REQUIREMENT GATHERING WIZARD (SalesOpportunity + RequirementGathering) */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {RG_WIZARD_STAGES.includes(deal.status) && (
                <>
              <div className="p-6 min-h-[500px]">
                {currentStep === 0 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Customer Details</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Company Name" required>
                        <Input value={detailsForm.companyName ?? deal.customer?.name ?? ""} onChange={e => setDetailsForm({...detailsForm, companyName: e.target.value})} placeholder="Company name" />
                      </FormField>
                      <FormField label="Industry">
                        <Input value={detailsForm.industry ?? deal.customer?.industry ?? ""} onChange={e => setDetailsForm({...detailsForm, industry: e.target.value})} placeholder="e.g. Manufacturing" />
                      </FormField>
                      <FormField label="Contact Person" required>
                        <Input value={detailsForm.contactPerson ?? deal.customer?.contactPerson ?? ""} onChange={e => setDetailsForm({...detailsForm, contactPerson: e.target.value})} placeholder="Contact name" />
                      </FormField>
                      <FormField label="Email" required>
                        <Input value={detailsForm.email ?? deal.customer?.email ?? ""} onChange={e => setDetailsForm({...detailsForm, email: e.target.value})} placeholder="email@example.com" />
                      </FormField>
                      <FormField label="Phone" required>
                        <Input value={detailsForm.phone ?? deal.customer?.phone ?? ""} onChange={e => setDetailsForm({...detailsForm, phone: e.target.value})} placeholder="Phone number" />
                      </FormField>
                      <FormField label="Number of Employees">
                        <Input type="number" value={detailsForm.employeeCount ?? deal.customer?.employees ?? ""} onChange={e => setDetailsForm({...detailsForm, employeeCount: parseInt(e.target.value) || null})} placeholder="e.g. 250" />
                      </FormField>
                    </div>

                    {/* File Upload Section */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Customer Profile Upload</h3>
                      <p className="text-sm text-slate-500 mb-4">Upload customer profile or requirement document (PDF, DOCX)</p>
                      
                      {!uploadedFile ? (
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" id="file-upload" />
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                                <Upload size={24} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                                <p className="text-xs text-slate-400">PDF or DOCX files only</p>
                              </div>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                              <FileIcon size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">{uploadedFile.name}</p>
                              <p className="text-xs text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button onClick={handleRemoveFile} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-colors">
                            <X size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Decision Making Section */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Decision Making</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Decision Maker (Name/Title)" required>
                          <Input value={detailsForm.decisionMaker ?? ""} onChange={e => setDetailsForm({...detailsForm, decisionMaker: e.target.value})} placeholder="e.g. CEO, MD" />
                        </FormField>
                        <FormField label="Influencer / Evaluator">
                          <Input value={detailsForm.influencer ?? ""} onChange={e => setDetailsForm({...detailsForm, influencer: e.target.value})} placeholder="e.g. IT Head" />
                        </FormField>
                        <FormField label="Budget Owner">
                          <Input value={detailsForm.budgetOwner ?? ""} onChange={e => setDetailsForm({...detailsForm, budgetOwner: e.target.value})} placeholder="e.g. CFO" />
                        </FormField>
                        <FormField label="Approval Process">
                          <Input value={detailsForm.approvalProcess ?? ""} onChange={e => setDetailsForm({...detailsForm, approvalProcess: e.target.value})} placeholder="e.g. Manager + Director sign-off" />
                        </FormField>
                        <FormField label="Expected Go-Live Date">
                          <Input type="date" value={detailsForm.expectedGoLive ? detailsForm.expectedGoLive.substring(0,10) : ""} onChange={e => setDetailsForm({...detailsForm, expectedGoLive: e.target.value ? new Date(e.target.value).toISOString() : null})} />
                        </FormField>
                        <FormField label="Buying Authority Notes">
                          <Textarea value={detailsForm.buyingAuthorityNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, buyingAuthorityNotes: e.target.value})} rows={2} placeholder="Notes on buying authority..." />
                        </FormField>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Business Requirements</h2>
                    
                    <FormField label="Business Need" required>
                      <Textarea value={detailsForm.businessNeed ?? ""} onChange={e => setDetailsForm({...detailsForm, businessNeed: e.target.value})} rows={3} placeholder="What is the core business problem the customer is trying to solve?" />
                    </FormField>

                    <FormField label="Current Process & Workflow">
                      <Textarea value={detailsForm.currentChallenges ?? ""} onChange={e => setDetailsForm({...detailsForm, currentChallenges: e.target.value})} rows={4} placeholder="How does the customer currently manage sales? What software are they using today?" />
                    </FormField>

                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">Pain Points</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {PAIN_POINTS_LIST.map(pp => (
                          <label key={pp} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                            <button type="button" onClick={() => handleCheckboxToggle('painPointsList', pp)} className="text-indigo-600 focus:outline-none">
                              {hasCheckbox('painPointsList', pp) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                            </button>
                            {pp}
                          </label>
                        ))}
                      </div>
                    </div>

                    <FormField label="Expected Outcome">
                      <Textarea value={detailsForm.expectedOutcome ?? ""} onChange={e => setDetailsForm({...detailsForm, expectedOutcome: e.target.value})} rows={3} placeholder="What does the customer expect to achieve with this solution?" />
                    </FormField>

                    <div className="grid grid-cols-2 gap-5">
                      <FormField label="Required Departments / Teams">
                        <Input value={detailsForm.requiredDepartments ?? ""} onChange={e => setDetailsForm({...detailsForm, requiredDepartments: e.target.value})} placeholder="e.g. Sales, Marketing, Finance" />
                      </FormField>
                      <FormField label="Number of Users">
                        <Input type="number" value={detailsForm.numberOfUsers ?? ""} onChange={e => setDetailsForm({...detailsForm, numberOfUsers: parseInt(e.target.value) || null})} placeholder="e.g. 50" />
                      </FormField>
                      <FormField label="Urgency / Priority">
                        <Select value={detailsForm.urgencyPriority ?? ""} onChange={e => setDetailsForm({...detailsForm, urgencyPriority: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </Select>
                      </FormField>
                      <FormField label="Timeline">
                        <Input value={detailsForm.timeline ?? ""} onChange={e => setDetailsForm({...detailsForm, timeline: e.target.value})} placeholder="e.g. Within 1 month" />
                      </FormField>
                    </div>

                    <FormField label="Business Goals">
                      <Textarea value={detailsForm.businessGoals ?? ""} onChange={e => setDetailsForm({...detailsForm, businessGoals: e.target.value})} rows={3} placeholder="What are the customer's strategic business goals?" />
                    </FormField>

                    <FormField label="Success Criteria">
                      <Textarea value={detailsForm.successCriteria ?? ""} onChange={e => setDetailsForm({...detailsForm, successCriteria: e.target.value})} rows={3} placeholder="How will the customer measure success?" />
                    </FormField>

                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">Modules Required <span className="text-rose-500">*</span></h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {MODULES_LIST.map(mod => (
                          <label key={mod} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                            <button type="button" onClick={() => handleCheckboxToggle('modulesRequired', mod)} className="text-indigo-600 focus:outline-none">
                              {hasCheckbox('modulesRequired', mod) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                            </button>
                            {mod}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Technical Assessment</h2>
                    
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">Deployment Type <span className="text-rose-500">*</span></h3>
                      <div className="flex gap-6">
                        {["Cloud SaaS", "On-Premise"].map(type => (
                          <label key={type} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <button type="button" onClick={() => setDetailsForm({...detailsForm, deploymentType: type})} className="text-indigo-600 focus:outline-none">
                              {detailsForm.deploymentType === type ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                            </button>
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">Integrations Required</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {INTEGRATIONS_LIST.map(int => (
                          <label key={int} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                            <button type="button" onClick={() => handleCheckboxToggle('integrationsRequired', int)} className="text-indigo-600 focus:outline-none">
                              {hasCheckbox('integrationsRequired', int) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                            </button>
                            {int}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">User Count</h3>
                      <div className="grid grid-cols-3 gap-5">
                        <FormField label="Sales Users"><Input type="number" value={detailsForm.userCountSales ?? ""} onChange={e => setDetailsForm({...detailsForm, userCountSales: parseInt(e.target.value) || null})} /></FormField>
                        <FormField label="Managers"><Input type="number" value={detailsForm.userCountManagers ?? ""} onChange={e => setDetailsForm({...detailsForm, userCountManagers: parseInt(e.target.value) || null})} /></FormField>
                        <FormField label="Admins"><Input type="number" value={detailsForm.userCountAdmins ?? ""} onChange={e => setDetailsForm({...detailsForm, userCountAdmins: parseInt(e.target.value) || null})} /></FormField>
                      </div>
                    </div>

                    <FormField label="Existing Software Stack">
                      <Textarea value={detailsForm.existingSoftwareStack ?? ""} onChange={e => setDetailsForm({...detailsForm, existingSoftwareStack: e.target.value})} rows={2} placeholder="e.g. Excel, Tally, Zoho CRM" />
                    </FormField>

                    <FormField label="Security / Compliance Requirements">
                      <Textarea value={detailsForm.securityCompliance ?? ""} onChange={e => setDetailsForm({...detailsForm, securityCompliance: e.target.value})} rows={2} placeholder="e.g. GDPR, ISO 27001, Data residency" />
                    </FormField>

                    <FormField label="User Roles / Permissions Needed">
                      <Textarea value={detailsForm.userRolesPermissions ?? ""} onChange={e => setDetailsForm({...detailsForm, userRolesPermissions: e.target.value})} rows={2} placeholder="e.g. Sales rep, Manager, Admin roles" />
                    </FormField>

                    <FormField label="Reporting / Dashboard Requirements">
                      <Textarea value={detailsForm.reportingRequirements ?? ""} onChange={e => setDetailsForm({...detailsForm, reportingRequirements: e.target.value})} rows={2} placeholder="e.g. Sales pipeline, conversion, activity reports" />
                    </FormField>

                    <div className="grid grid-cols-2 gap-5">
                      <FormField label="Data Migration Required">
                        <Select value={detailsForm.dataMigrationRequired ?? ""} onChange={e => setDetailsForm({...detailsForm, dataMigrationRequired: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Partial">Partial</option>
                        </Select>
                      </FormField>
                      <FormField label="Customization Needed">
                        <Input value={detailsForm.customizationNeeded ?? ""} onChange={e => setDetailsForm({...detailsForm, customizationNeeded: e.target.value})} placeholder="e.g. Custom fields, workflows" />
                      </FormField>
                    </div>

                    <FormField label="API / Third-Party Requirements">
                      <Textarea value={detailsForm.apiThirdPartyReqs ?? ""} onChange={e => setDetailsForm({...detailsForm, apiThirdPartyReqs: e.target.value})} rows={2} placeholder="e.g. WhatsApp API, ERP integration, Payment gateway" />
                    </FormField>

                    <FormField label="Technical Constraints">
                      <Textarea value={detailsForm.technicalConstraints ?? ""} onChange={e => setDetailsForm({...detailsForm, technicalConstraints: e.target.value})} rows={2} placeholder="e.g. Must work on mobile, offline support" />
                    </FormField>

                    <FormField label="IT Team Notes">
                      <Textarea value={detailsForm.itTeamNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, itTeamNotes: e.target.value})} rows={3} placeholder="Notes from IT team discussions..." />
                    </FormField>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Commercial Information</h2>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Budget Details <span className="text-rose-500">*</span></h3>
                        <div className="space-y-3">
                          {BUDGET_OPTIONS.map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <button type="button" onClick={() => setDetailsForm({...detailsForm, budgetRange: opt})} className="text-indigo-600 focus:outline-none">
                                {detailsForm.budgetRange === opt ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                              </button>
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Implementation Timeline <span className="text-rose-500">*</span></h3>
                        <div className="space-y-3">
                          {TIMELINE_OPTIONS.map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <button type="button" onClick={() => setDetailsForm({...detailsForm, timeline: opt})} className="text-indigo-600 focus:outline-none">
                                {detailsForm.timeline === opt ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                              </button>
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <FormField label="Expected Budget (â‚¹)">
                        <Input type="number" value={detailsForm.expectedBudget ?? ""} onChange={e => setDetailsForm({...detailsForm, expectedBudget: parseInt(e.target.value) || null})} placeholder="e.g. 500000" />
                      </FormField>
                      <FormField label="Probability (%)">
                        <Input type="number" value={detailsForm.probability ?? ""} onChange={e => setDetailsForm({...detailsForm, probability: parseInt(e.target.value) || null})} placeholder="e.g. 75" />
                      </FormField>
                      <FormField label="Pricing Model">
                        <Select value={detailsForm.pricingModel ?? ""} onChange={e => setDetailsForm({...detailsForm, pricingModel: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="One-time">One-time</option>
                          <option value="Subscription">Subscription</option>
                          <option value="Per User">Per User</option>
                          <option value="Usage-based">Usage-based</option>
                        </Select>
                      </FormField>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Review & Internal Notes</h2>
                    
                    <FormField label="Internal Sales Notes">
                      <Textarea value={detailsForm.internalSalesNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, internalSalesNotes: e.target.value})} rows={3} placeholder="Internal notes for the sales team..." />
                    </FormField>
                    <FormField label="Pre-sales Notes">
                      <Textarea value={detailsForm.presalesNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, presalesNotes: e.target.value})} rows={3} placeholder="Notes from pre-sales discussions..." />
                    </FormField>
                    <FormField label="Objections">
                      <Textarea value={detailsForm.objections ?? ""} onChange={e => setDetailsForm({...detailsForm, objections: e.target.value})} rows={2} placeholder="Customer objections raised..." />
                    </FormField>
                    <FormField label="Follow-up Summary">
                      <Textarea value={detailsForm.followUpSummary ?? ""} onChange={e => setDetailsForm({...detailsForm, followUpSummary: e.target.value})} rows={2} placeholder="Summary of follow-up discussions..." />
                    </FormField>
                    <FormField label="Risks / Blockers">
                      <Textarea value={detailsForm.risksBlockers ?? ""} onChange={e => setDetailsForm({...detailsForm, risksBlockers: e.target.value})} rows={2} placeholder="Any risks or potential blockers?" />
                    </FormField>
                    <FormField label="Next Steps" required>
                      <Textarea value={detailsForm.nextSteps ?? ""} onChange={e => setDetailsForm({...detailsForm, nextSteps: e.target.value})} rows={2} placeholder="What are the next steps for this opportunity?" />
                    </FormField>
                    <FormField label="Management Notes">
                      <Textarea value={detailsForm.managementNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, managementNotes: e.target.value})} rows={3} placeholder="Notes for management review..." />
                    </FormField>

                    {/* Notes Panel */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <NotePanel entityType="DEAL" entityId={deal.id} />
                    </div>

                    {/* Activities */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Activity Log</h3>
                        <a href={`/activities/new?dealId=${dealId}&type=call`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <Plus size={14} /> Log Activity
                        </a>
                      </div>
                      <div className="space-y-3">
                        {dealActivities.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-sm">No activities logged yet.</div>
                        ) : (
                          dealActivities.map(act => (
                            <div key={act.id} className="p-4 border border-slate-200 rounded-xl">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold uppercase">{act.channel}</span>
                                    <span className="text-xs text-slate-400">{formatDate(act.createdAt)}</span>
                                  </div>
                                  <p className="text-sm text-slate-700 font-medium">{act.notes || act.subject || "â€”"}</p>
                                  {act.meetingDate && (
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                      <Clock size={12} /> {formatDate(act.meetingDate)}
                                    </p>
                                  )}
                                </div>
                                <button onClick={() => deleteActivityAction(act.id)} className="text-rose-500 hover:text-rose-600 text-xs font-medium">
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Tasks */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Tasks</h3>
                        <a href={`/tasks/new?dealId=${dealId}`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <Plus size={14} /> Add Task
                        </a>
                      </div>
                      <div className="space-y-3">
                        {dealTasks.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-sm">No tasks created yet.</div>
                        ) : (
                          dealTasks.map(task => (
                            <div key={task.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-800">{task.title}</p>
                                <p className="text-xs text-slate-500 mt-1">Due: {formatDate(task.dueDate)}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                task.status === "Completed" ? "bg-emerald-100 text-emerald-700" :
                                task.status === "In Progress" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {task.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Deal Summary */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Deal Summary</h3>
                      <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Deal Value</span><span className="text-sm font-bold text-slate-900">{formatCurrency(deal.dealValue)}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Stage</span><span className="text-sm font-bold text-slate-900">{(STAGES as any)[deal.status] || deal.status}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Customer</span><span className="text-sm font-bold text-slate-900">{deal.customer?.name}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Probability</span><span className="text-sm font-bold text-slate-900">{detailsForm.probability ? detailsForm.probability + "%" : "â€”"}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Expected Close</span><span className="text-sm font-bold text-slate-900">{formatDate(deal.expectedCloseDate)}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-600">Created</span><span className="text-sm font-bold text-slate-900">{formatDate(deal.createdAt)}</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Navigation Footer - Only View Document + Download PDF + Nav buttons */}
              <div className="border-t border-slate-200 p-4 bg-slate-50">
                {/* Document Actions - only when all sections complete */}
                {allSectionsComplete && (
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                    <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                      <FileText size={14} /> View Document
                    </button>
                    <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                      <Download size={14} /> Download PDF
                    </button>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                  <button onClick={handleBackStep} disabled={currentStep === 0} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSaveDraft} disabled={isSubmitting} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                      {isSubmitting ? "Saving..." : "Save Draft"}
                    </button>
                    {currentStep < WIZARD_STEPS.length - 1 ? (
                      <button onClick={handleNextStep} disabled={isSubmitting} className="px-4 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1">
                        {isSubmitting ? "Validating..." : "Save & Continue"} <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button onClick={() => setShowCompleteModal(true)} disabled={!allSectionsComplete || isSubmitting} className="px-4 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                        {isSubmitting ? "Submitting..." : "Submit"} <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
                </>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* MEETING SCHEDULED STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {pipelineStageView === "MeetingScheduled" && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    {/* Reviewing Past Stage Banner */}
                    {isReviewingPastStage && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-sm font-bold text-amber-800">Reviewing completed stage (read-only)</p>
                        </div>
                        <button onClick={() => setPipelineStageView(deal.status)} className="px-4 py-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
                          Back to {POST_MEETING_STAGES.find(s => s.key === deal.status)?.label}
                        </button>
                      </div>
                    )}
                    {/* Requirement Completed Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle size={24} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-emerald-900">Requirements gathered successfully</h2>
                        <p className="text-sm text-emerald-700 mt-1">Move to meeting discussion. Schedule or reschedule a meeting with the customer.</p>
                      </div>
                    </div>

                    {/* Meeting Details Form */}
                    <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                      <h3 className="text-sm font-bold text-slate-900">Meeting Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Meeting Date & Time" required>
                          <Input type="datetime-local" value={detailsForm.meetingDate ? detailsForm.meetingDate.substring(0, 16) : ""} onChange={e => setDetailsForm({...detailsForm, meetingDate: e.target.value ? new Date(e.target.value).toISOString() : null})} />
                        </FormField>
                        <FormField label="Location">
                          <Input value={detailsForm.meetingLocation ?? ""} onChange={e => setDetailsForm({...detailsForm, meetingLocation: e.target.value})} placeholder="e.g. Customer Office" />
                        </FormField>
                      </div>
                      <FormField label="Mode">
                        <Select value={detailsForm.meetingMode ?? ""} onChange={e => setDetailsForm({...detailsForm, meetingMode: e.target.value})}>
                          <option value="">Select mode...</option>
                          <option value="In-person">In-person</option>
                          <option value="Virtual">Virtual</option>
                        </Select>
                      </FormField>
                      <FormField label="Participants">
                        <Input value={detailsForm.meetingParticipants ?? ""} onChange={e => setDetailsForm({...detailsForm, meetingParticipants: e.target.value})} placeholder="e.g. John, Jane from customer side" />
                      </FormField>
                      <FormField label="Agenda">
                        <Textarea value={detailsForm.meetingAgenda ?? ""} onChange={e => setDetailsForm({...detailsForm, meetingAgenda: e.target.value})} rows={3} placeholder="e.g. Demo, Technical Discussion, Proposal Review" />
                      </FormField>
                    </div>

                    {/* Meeting History */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-3">Meeting History</h3>
                      <div className="space-y-3">
                        {meetingActs.length === 0 ? (
                          <p className="text-slate-400 text-sm text-center py-6">No meetings logged yet.</p>
                        ) : (
                          meetingActs.map((meeting: any) => (
                            <div key={meeting.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-600">{formatDate(meeting.meetingDate)}</span>
                                <span className="text-xs text-slate-400">â€¢</span>
                                <span className="text-xs font-medium text-slate-700">{meeting.status}</span>
                              </div>
                              <p className="text-xs text-slate-600">{meeting.notes || meeting.agenda || "â€”"}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Meeting Outcome */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-3">Meeting Outcome</h3>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => setMeetingOutcomeChoice("follow_up")} className={`px-4 py-3 text-sm font-bold rounded-lg transition-colors ${meetingOutcomeChoice === "follow_up" ? "bg-blue-50 text-blue-700 border-2 border-blue-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent"}`}>Schedule Follow-up</button>
                        <button onClick={() => setMeetingOutcomeChoice("on_hold")} className={`px-4 py-3 text-sm font-bold rounded-lg transition-colors ${meetingOutcomeChoice === "on_hold" ? "bg-amber-50 text-amber-700 border-2 border-amber-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent"}`}>On Hold</button>
                        <button onClick={() => setMeetingOutcomeChoice("close_won")} className={`px-4 py-3 text-sm font-bold rounded-lg transition-colors ${meetingOutcomeChoice === "close_won" ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent"}`}>Close Won</button>
                        <button onClick={() => setMeetingOutcomeChoice("close_lost")} className={`px-4 py-3 text-sm font-bold rounded-lg transition-colors ${meetingOutcomeChoice === "close_lost" ? "bg-rose-50 text-rose-700 border-2 border-rose-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent"}`}>Close Lost</button>
                      </div>

                      {meetingOutcomeChoice === "follow_up" && (
                        <div className="space-y-3 animate-in fade-in p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <FormField label="Follow-up Date & Time">
                            <Input type="datetime-local" value={followUpForm.date ? followUpForm.date.substring(0, 16) : ""} onChange={e => setFollowUpForm({...followUpForm, date: e.target.value ? new Date(e.target.value).toISOString() : ""})} />
                          </FormField>
                          <FormField label="Agenda">
                            <Textarea value={followUpForm.agenda} onChange={e => setFollowUpForm({...followUpForm, agenda: e.target.value})} rows={2} placeholder="What will be discussed?" />
                          </FormField>
                          <FormField label="Notes">
                            <Textarea value={followUpForm.notes} onChange={e => setFollowUpForm({...followUpForm, notes: e.target.value})} rows={2} placeholder="Any notes from this meeting?" />
                          </FormField>
                          <div className="flex gap-2">
                            <button onClick={handleScheduleFollowUp} disabled={isSubmitting || !followUpForm.date} className="btn-primary text-sm flex-1">Schedule Follow-up</button>
                            <button onClick={() => setMeetingOutcomeChoice("")} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      )}

                      {meetingOutcomeChoice === "on_hold" && (
                        <div className="space-y-3 animate-in fade-in p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <FormField label="Notes">
                            <Textarea value={onHoldNotes} onChange={e => setOnHoldNotes(e.target.value)} rows={3} placeholder="Why is this deal on hold?" />
                          </FormField>
                          <div className="flex gap-2">
                            <button onClick={handleOnHold} disabled={isSubmitting} className="btn-primary text-sm flex-1">Save & On Hold</button>
                            <button onClick={() => setMeetingOutcomeChoice("")} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      )}

                      {meetingOutcomeChoice === "close_won" && (
                        <div className="space-y-3 animate-in fade-in p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-sm text-slate-600">Are you sure you want to mark this deal as Won?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleAdvanceStage("Won")} disabled={isSubmitting} className="btn-primary text-sm flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)]">Yes, Mark Won</button>
                            <button onClick={() => setMeetingOutcomeChoice("")} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      )}

                      {meetingOutcomeChoice === "close_lost" && (
                        <div className="space-y-3 animate-in fade-in p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-sm text-slate-600">Are you sure you want to mark this deal as Lost?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleAdvanceStage("Lost")} disabled={isSubmitting} className="btn-secondary text-sm text-rose-600 hover:bg-rose-50 flex-1">Yes, Mark Lost</button>
                            <button onClick={() => setMeetingOutcomeChoice("")} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Activities + Tasks */}
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">Activities</h3>
                          <a href={`/activities/new?dealId=${dealId}&type=call`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Log Activity</a>
                        </div>
                        <div className="space-y-2">
                          {dealActivities.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No activities logged.</p> : dealActivities.slice(0, 5).map(act => (
                            <div key={act.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                              <span className="font-bold text-slate-700">{act.channel}</span> â€” <span className="text-slate-600">{act.notes || act.subject || "â€”"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">Tasks</h3>
                          <a href={`/tasks/new?dealId=${dealId}`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Add Task</a>
                        </div>
                        <div className="space-y-2">
                          {dealTasks.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No tasks created.</p> : dealTasks.slice(0, 5).map(task => (
                            <div key={task.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
                              <span className="font-bold text-slate-700">{task.title}</span>
                              <span className="text-xs text-slate-500">Due: {formatDate(task.dueDate)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions - hidden when reviewing past stage */}
                  {!isReviewingPastStage && (
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <FileText size={14} /> View Document
                      </button>
                      <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                    <button onClick={async () => { setIsSubmitting(true); await saveOpportunityDetailAction(dealId, detailsForm); await handleAdvanceStage("SolutionReview"); setIsSubmitting(false); }} disabled={isSubmitting || !detailsForm.meetingDate} className="px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                      {isSubmitting ? "Saving..." : "Save & Move to Solution Review"} <ChevronRight size={16} />
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* SOLUTION REVIEW STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {pipelineStageView === "SolutionReview" && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    {/* Reviewing Past Stage Banner */}
                    {isReviewingPastStage && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-sm font-bold text-amber-800">Reviewing completed stage (read-only)</p>
                        </div>
                        <button onClick={() => setPipelineStageView(deal.status)} className="px-4 py-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
                          Back to {POST_MEETING_STAGES.find(s => s.key === deal.status)?.label}
                        </button>
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2">Solution Review</h2>
                      <p className="text-sm text-slate-500">Define the proposed solution, scope, and effort estimation.</p>
                    </div>

                    {/* Meeting Status */}
                    <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Meeting Status: Completed</p>
                        <p className="text-xs text-slate-500">Meeting was conducted. Now define the solution.</p>
                      </div>
                    </div>

                    {/* Solution Review Form */}
                    <FormField label="Proposed Solution / Architecture / Modules / Scope">
                      <Textarea value={detailsForm.proposedSolution ?? ""} onChange={e => setDetailsForm({...detailsForm, proposedSolution: e.target.value})} rows={4} placeholder="e.g. CRM Module with Lead Management, Custom Follow-ups..." />
                    </FormField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Scope Classification">
                        <Select value={detailsForm.scopeClassification ?? ""} onChange={e => setDetailsForm({...detailsForm, scopeClassification: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="Standard Product Fit">Standard Product Fit</option>
                          <option value="Minor Customization Required">Minor Customization Required</option>
                          <option value="Major Customization Required">Major Customization Required</option>
                          <option value="Custom Development Required">Custom Development Required</option>
                        </Select>
                      </FormField>
                      <FormField label="Estimated Duration">
                        <Input value={detailsForm.estimatedDuration ?? ""} onChange={e => setDetailsForm({...detailsForm, estimatedDuration: e.target.value})} placeholder="e.g. 4 weeks" />
                      </FormField>
                      <FormField label="Development Effort">
                        <Input value={detailsForm.developmentEffort ?? ""} onChange={e => setDetailsForm({...detailsForm, developmentEffort: e.target.value})} placeholder="e.g. 80 Hours" />
                      </FormField>
                      <FormField label="Implementation / Training">
                        <Input value={detailsForm.implementationEffort ?? ""} onChange={e => setDetailsForm({...detailsForm, implementationEffort: e.target.value})} placeholder="e.g. 40 Hours" />
                      </FormField>
                      <FormField label="Budget Range">
                        <Input value={detailsForm.budgetRange ?? ""} readOnly className="bg-slate-50" />
                      </FormField>
                      <FormField label="Timeline">
                        <Input value={detailsForm.timeline ?? ""} readOnly className="bg-slate-50" />
                      </FormField>
                    </div>

                    {/* Notes Panel */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <NotePanel entityType="DEAL" entityId={deal.id} />
                    </div>
                  </div>

                  {/* Footer Actions - hidden when reviewing past stage */}
                  {!isReviewingPastStage && (
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <FileText size={14} /> View Document
                      </button>
                      <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                    <button onClick={async () => { setIsSubmitting(true); await saveOpportunityDetailAction(dealId, detailsForm); await handleAdvanceStage("ProposalSent"); setIsSubmitting(false); }} disabled={isSubmitting || !detailsForm.proposedSolution} className="px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1">
                      {isSubmitting ? "Saving..." : "Save & Send Proposal"} <ChevronRight size={16} />
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* PROPOSAL SENT STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {pipelineStageView === "ProposalSent" && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    {/* Reviewing Past Stage Banner */}
                    {isReviewingPastStage && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-sm font-bold text-amber-800">Reviewing completed stage (read-only)</p>
                        </div>
                        <button onClick={() => setPipelineStageView(deal.status)} className="px-4 py-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
                          Back to {POST_MEETING_STAGES.find(s => s.key === deal.status)?.label}
                        </button>
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2">Proposal Sent</h2>
                      <p className="text-sm text-slate-500">Track proposal status and move to negotiation.</p>
                    </div>

                    {/* Proposal Status */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-900">Proposal has been sent to customer</p>
                        <p className="text-xs text-blue-700 mt-1">Waiting for customer response. Move to negotiation when discussions begin.</p>
                      </div>
                    </div>

                    {/* Solution Summary (read-only) */}
                    <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">Solution Summary</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-[10px] uppercase font-bold text-slate-400">Proposed Solution</p><p className="font-medium text-slate-700">{detailsForm.proposedSolution || "â€”"}</p></div>
                        <div><p className="text-[10px] uppercase font-bold text-slate-400">Scope</p><p className="font-medium text-slate-700">{detailsForm.scopeClassification || "â€”"}</p></div>
                        <div><p className="text-[10px] uppercase font-bold text-slate-400">Duration</p><p className="font-medium text-slate-700">{detailsForm.estimatedDuration || "â€”"}</p></div>
                        <div><p className="text-[10px] uppercase font-bold text-slate-400">Budget</p><p className="font-medium text-slate-700">{detailsForm.budgetRange || "â€”"}</p></div>
                      </div>
                    </div>

                    {/* Notes Panel */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <NotePanel entityType="DEAL" entityId={deal.id} />
                    </div>

                    {/* Activities + Tasks */}
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">Activities</h3>
                          <a href={`/activities/new?dealId=${dealId}&type=call`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Log Activity</a>
                        </div>
                        <div className="space-y-2">
                          {dealActivities.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No activities logged.</p> : dealActivities.slice(0, 5).map(act => (
                            <div key={act.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                              <span className="font-bold text-slate-700">{act.channel}</span> â€” <span className="text-slate-600">{act.notes || act.subject || "â€”"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions - hidden when reviewing past stage */}
                  {!isReviewingPastStage && (
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <FileText size={14} /> View Proposal Document
                      </button>
                      <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                    <button onClick={() => handleAdvanceStage("Negotiation")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1">
                      Move to Negotiation <ChevronRight size={16} />
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* NEGOTIATION STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {pipelineStageView === "Negotiation" && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2">Negotiation</h2>
                      <p className="text-sm text-slate-500">Track negotiation details, price discussions, and close the deal.</p>
                    </div>

                    {/* Proposal & Solution Summary (read-only) */}
                    <details className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" /> Proposal & Solution Summary (click to expand)
                      </summary>
                      <div className="px-5 pb-5 space-y-4 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4">
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Proposed Solution</p><p className="font-medium text-slate-700">{detailsForm.proposedSolution || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Scope</p><p className="font-medium text-slate-700">{detailsForm.scopeClassification || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Estimated Duration</p><p className="font-medium text-slate-700">{detailsForm.estimatedDuration || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Budget Range</p><p className="font-medium text-slate-700">{detailsForm.budgetRange || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Dev Effort</p><p className="font-medium text-slate-700">{detailsForm.devEffort || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Implementation Effort</p><p className="font-medium text-slate-700">{detailsForm.implementationEffort || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Timeline</p><p className="font-medium text-slate-700">{detailsForm.timeline || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Expected Budget</p><p className="font-medium text-slate-700">{detailsForm.expectedBudget ? formatCurrency(detailsForm.expectedBudget) : "â€”"}</p></div>
                        </div>
                        {detailsForm.solutionNotes && (
                          <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Solution Notes</p><p className="text-sm text-slate-600">{detailsForm.solutionNotes}</p></div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                            <Eye size={14} /> View Full Document
                          </button>
                          <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                            <Download size={14} /> Download PDF
                          </button>
                        </div>
                      </div>
                    </details>

                    {/* Negotiation Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField label="Expected Budget (â‚¹)">
                        <Input type="number" value={detailsForm.expectedBudget ?? ""} onChange={e => setDetailsForm({...detailsForm, expectedBudget: parseInt(e.target.value) || null})} placeholder="e.g. 500000" />
                      </FormField>
                      <FormField label="Probability (%)">
                        <Input type="number" value={detailsForm.probability ?? ""} onChange={e => setDetailsForm({...detailsForm, probability: parseInt(e.target.value) || null})} placeholder="e.g. 75" />
                      </FormField>
                      <FormField label="Commercial Terms">
                        <Textarea value={detailsForm.commercialTerms ?? ""} onChange={e => setDetailsForm({...detailsForm, commercialTerms: e.target.value})} rows={3} placeholder="Payment terms, discount, etc." />
                      </FormField>
                      <FormField label="Negotiation Notes">
                        <Textarea value={detailsForm.negotiationNotes ?? ""} onChange={e => setDetailsForm({...detailsForm, negotiationNotes: e.target.value})} rows={3} placeholder="Price discussion notes..." />
                      </FormField>
                    </div>

                    {/* Notes Panel */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <NotePanel entityType="DEAL" entityId={deal.id} />
                    </div>

                    {/* Activities + Tasks */}
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">Activities</h3>
                          <a href={`/activities/new?dealId=${dealId}&type=call`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Log Activity</a>
                        </div>
                        <div className="space-y-2">
                          {dealActivities.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No activities logged.</p> : dealActivities.slice(0, 5).map(act => (
                            <div key={act.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                              <span className="font-bold text-slate-700">{act.channel}</span> â€” <span className="text-slate-600">{act.notes || act.subject || "â€”"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">Tasks</h3>
                          <a href={`/tasks/new?dealId=${dealId}`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Add Task</a>
                        </div>
                        <div className="space-y-2">
                          {dealTasks.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No tasks created.</p> : dealTasks.slice(0, 5).map(task => (
                            <div key={task.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
                              <span className="font-bold text-slate-700">{task.title}</span>
                              <span className="text-xs text-slate-500">Due: {formatDate(task.dueDate)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <FileText size={14} /> View Document
                      </button>
                      <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={async () => { setIsSubmitting(true); await saveOpportunityDetailAction(dealId, detailsForm); setIsSubmitting(false); }} disabled={isSubmitting} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                        {isSubmitting ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => handleAdvanceStage("Won")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1">
                        Mark Won <CheckCircle size={16} />
                      </button>
                      <button onClick={() => handleAdvanceStage("Lost")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg disabled:opacity-50 flex items-center gap-1">
                        Mark Lost <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* ACTIVE DEAL STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {deal.status === "Active" && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Briefcase size={24} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-blue-900">Active Deal</h2>
                        <p className="text-sm text-blue-700 mt-1">This deal is active. Mark it as Won when closed, or Lost if it falls through.</p>
                      </div>
                    </div>

                    {/* Requirement Gathering Summary (read-only) */}
                    <details className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden" open>
                      <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" /> Requirement Gathering Summary
                      </summary>
                      <div className="px-5 pb-5 border-t border-slate-200">
                        {/* Step 1 - Customer Details */}
                        <div className="pt-4">
                          <p className="text-xs uppercase font-bold text-slate-400 mb-2">Step 1 â€” Customer Details</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Company</p><p className="font-medium text-slate-700">{detailsForm.companyName || deal.customer?.name || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Contact Person</p><p className="font-medium text-slate-700">{detailsForm.contactPerson || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Email</p><p className="font-medium text-slate-700">{detailsForm.email || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Phone</p><p className="font-medium text-slate-700">{detailsForm.phone || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Decision Maker</p><p className="font-medium text-slate-700">{detailsForm.decisionMaker || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Industry</p><p className="font-medium text-slate-700">{detailsForm.industry || "â€”"}</p></div>
                          </div>
                        </div>
                        {/* Step 2 - Business Requirements */}
                        <div className="pt-4 mt-4 border-t border-slate-100">
                          <p className="text-xs uppercase font-bold text-slate-400 mb-2">Step 2 â€” Business Requirements</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Current Challenges</p><p className="font-medium text-slate-700">{detailsForm.currentChallenges || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Modules Required</p><p className="font-medium text-slate-700">{Array.isArray(detailsForm.modulesList) ? detailsForm.modulesList.join(", ") : "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Pain Points</p><p className="font-medium text-slate-700">{Array.isArray(detailsForm.painPointsList) ? detailsForm.painPointsList.join(", ") : "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Users</p><p className="font-medium text-slate-700">{detailsForm.userCount || "â€”"}</p></div>
                          </div>
                        </div>
                        {/* Step 3 - Technical Assessment */}
                        <div className="pt-4 mt-4 border-t border-slate-100">
                          <p className="text-xs uppercase font-bold text-slate-400 mb-2">Step 3 â€” Technical Assessment</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Integrations</p><p className="font-medium text-slate-700">{Array.isArray(detailsForm.integrationsList) ? detailsForm.integrationsList.join(", ") : "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Data Migration</p><p className="font-medium text-slate-700">{detailsForm.dataMigration || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Hosting Preference</p><p className="font-medium text-slate-700">{detailsForm.hostingPreference || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Security Requirements</p><p className="font-medium text-slate-700">{detailsForm.securityRequirements || "â€”"}</p></div>
                          </div>
                        </div>
                        {/* Step 4 - Commercial */}
                        <div className="pt-4 mt-4 border-t border-slate-100">
                          <p className="text-xs uppercase font-bold text-slate-400 mb-2">Step 4 â€” Commercial</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Budget Range</p><p className="font-medium text-slate-700">{detailsForm.budgetRange || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Timeline</p><p className="font-medium text-slate-700">{detailsForm.timeline || "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Expected Budget</p><p className="font-medium text-slate-700">{detailsForm.expectedBudget ? formatCurrency(detailsForm.expectedBudget) : "â€”"}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400">Probability</p><p className="font-medium text-slate-700">{detailsForm.probability ? detailsForm.probability + "%" : "â€”"}</p></div>
                          </div>
                        </div>
                      </div>
                    </details>

                    {/* Notes Panel */}
                    <div>
                      <NotePanel entityType="DEAL" entityId={deal.id} />
                    </div>

                    {/* Activities */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-900">Activities</h3>
                        <a href={`/activities/new?dealId=${dealId}&type=call`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Log Activity</a>
                      </div>
                      <div className="space-y-2">
                        {dealActivities.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No activities logged yet.</p> : dealActivities.map(act => (
                          <div key={act.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                            <span className="font-bold text-slate-700">{act.channel}</span> â€” <span className="text-slate-600">{act.notes || act.subject || "â€”"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tasks */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-900">Tasks</h3>
                        <a href={`/tasks/new?dealId=${dealId}`} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Add Task</a>
                      </div>
                      <div className="space-y-2">
                        {dealTasks.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No tasks created yet.</p> : dealTasks.map(task => (
                          <div key={task.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-700">{task.title}</span>
                            <span className="text-xs text-slate-500">Due: {formatDate(task.dueDate)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-end gap-2 bg-slate-50">
                    <button onClick={() => handleAdvanceStage("Won")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1">
                      Mark Won <CheckCircle size={16} />
                    </button>
                    <button onClick={() => handleAdvanceStage("Lost")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg disabled:opacity-50 flex items-center gap-1">
                      Mark Lost <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {/* WON / LOST STAGE */}
              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              {(deal.status === "Won" || deal.status === "Lost") && (
                <div className="p-6 min-h-[500px]">
                  <div className="space-y-6">
                    <div className={`rounded-xl p-6 flex items-center gap-4 ${deal.status === "Won" ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${deal.status === "Won" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                        {deal.status === "Won" ? <CheckCircle size={28} /> : <X size={28} />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{deal.status === "Won" ? "Deal Won!" : "Deal Lost"}</h2>
                        <p className="text-sm text-slate-600 mt-1">{deal.status === "Won" ? "Congratulations! This deal has been successfully closed." : "This deal has been marked as lost."}</p>
                      </div>
                    </div>

                    {/* Deal Summary */}
                    <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 mb-2">Deal Summary</h3>
                      <div className="flex justify-between"><span className="text-sm text-slate-600">Deal Value</span><span className="text-sm font-bold text-slate-900">{formatCurrency(deal.dealValue)}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-slate-600">Customer</span><span className="text-sm font-bold text-slate-900">{deal.customer?.name}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-slate-600">Stage</span><span className="text-sm font-bold text-slate-900">{(STAGES as any)[deal.status] || deal.status}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-slate-600">Created</span><span className="text-sm font-bold text-slate-900">{formatDate(deal.createdAt)}</span></div>
                    </div>

                    {/* Proposal & Solution Summary (read-only) */}
                    <details className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" /> Proposal & Solution Summary (click to expand)
                      </summary>
                      <div className="px-5 pb-5 space-y-4 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4">
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Proposed Solution</p><p className="font-medium text-slate-700">{detailsForm.proposedSolution || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Scope</p><p className="font-medium text-slate-700">{detailsForm.scopeClassification || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Estimated Duration</p><p className="font-medium text-slate-700">{detailsForm.estimatedDuration || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Budget Range</p><p className="font-medium text-slate-700">{detailsForm.budgetRange || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Dev Effort</p><p className="font-medium text-slate-700">{detailsForm.devEffort || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Implementation Effort</p><p className="font-medium text-slate-700">{detailsForm.implementationEffort || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Timeline</p><p className="font-medium text-slate-700">{detailsForm.timeline || "â€”"}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-slate-400">Expected Budget</p><p className="font-medium text-slate-700">{detailsForm.expectedBudget ? formatCurrency(detailsForm.expectedBudget) : "â€”"}</p></div>
                        </div>
                        {detailsForm.solutionNotes && (
                          <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Solution Notes</p><p className="text-sm text-slate-600">{detailsForm.solutionNotes}</p></div>
                        )}
                        {detailsForm.negotiationNotes && (
                          <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Negotiation Notes</p><p className="text-sm text-slate-600">{detailsForm.negotiationNotes}</p></div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                            <Eye size={14} /> View Full Document
                          </button>
                          <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                            <Download size={14} /> Download PDF
                          </button>
                        </div>
                      </div>
                    </details>

                    {/* Activities + Tasks */}
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Activities</h3>
                        <div className="space-y-2">
                          {dealActivities.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No activities logged.</p> : dealActivities.map(act => (
                            <div key={act.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                              <span className="font-bold text-slate-700">{act.channel}</span> â€” <span className="text-slate-600">{act.notes || act.subject || "â€”"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Tasks</h3>
                        <div className="space-y-2">
                          {dealTasks.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No tasks created.</p> : dealTasks.map(task => (
                            <div key={task.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
                              <span className="font-bold text-slate-700">{task.title}</span>
                              <span className="text-xs text-slate-500">Due: {formatDate(task.dueDate)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDocModal(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <FileText size={14} /> View Document
                      </button>
                      <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                    <button onClick={() => router.push("/sales-pipeline")} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                      Back to Pipeline <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Deal Summary Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Deal Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Deal Value</span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(deal.dealValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Stage</span>
                  <span className="text-sm font-bold text-slate-900">{(STAGES as any)[deal.status] || deal.status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Probability</span>
                  <span className="text-sm font-bold text-slate-900">{detailsForm.probability ? detailsForm.probability + "%" : "â€”"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Expected Close</span>
                  <span className="text-sm font-bold text-slate-900">{formatDate(deal.expectedCloseDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Assigned Rep</span>
                  <span className="text-sm font-bold text-slate-900">{deal.assignedUser?.name || "â€”"}</span>
                </div>
              </div>
            </div>

            {/* Progress Card - only during Requirement Gathering */}
            {RG_WIZARD_STAGES.includes(deal.status) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Progress</h3>
              <div className="space-y-3">
                {WIZARD_STEPS.map((step, idx) => {
                  const isComplete = idx < currentStep || (idx === currentStep && validateSection(step.id).length === 0);
                  return (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      {isComplete ? (
                        <CheckCircle size={16} className="text-emerald-500" />
                      ) : (
                        <Circle size={16} className="text-slate-300" />
                      )}
                      <span className={isComplete ? "text-slate-700" : "text-slate-400"}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Pipeline Progress */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Pipeline Progress</h3>
              <div className="space-y-3">
                {PIPELINE_STAGES.map((key) => {
                  const currentIdx = PIPELINE_STAGES.indexOf(deal.status);
                  const stageIdx = PIPELINE_STAGES.indexOf(key);
                  const isDone = currentIdx > stageIdx || deal.status === "Won" || deal.status === "Active";
                  const isActive = deal.status === key;
                  return (
                    <div key={key} className="relative flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[var(--primary)] text-white shadow-md ring-4 ring-blue-50" : "bg-slate-200 text-slate-400"}`}>
                        {isDone ? <Check size={12} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <span className={`text-sm ${isDone ? "text-slate-600 font-medium" : isActive ? "text-blue-800 font-bold" : "text-slate-400 font-medium"}`}>
                        {(STAGES as any)[key] || key}
                      </span>
                    </div>
                  );
                })}
                {deal.status === "Won" && (
                  <div className="relative flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 bg-emerald-500 text-white"><Check size={12} strokeWidth={3} /></div>
                    <span className="text-sm text-emerald-700 font-bold">Deal Won</span>
                  </div>
                )}
                {deal.status === "Lost" && (
                  <div className="relative flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 bg-rose-500 text-white"><X size={12} strokeWidth={3} /></div>
                    <span className="text-sm text-rose-700 font-bold">Deal Lost</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <button onClick={() => router.push(`/activities/new?dealId=${dealId}&type=note`)} className="text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2">
                  <Plus size={14} /> Add Note
                </button>
                <button onClick={() => router.push(`/activities/new?dealId=${dealId}&type=call`)} className="text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2">
                  <Plus size={14} /> Log Activity
                </button>
                {!["Won", "Lost"].includes(deal.status) && (
                  <button onClick={() => handleAdvanceStage("Lost")} className="text-left px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2">
                    <X size={14} /> Mark Lost
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <LayoutTemplate size={24} />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">Have all customer requirements been captured?</h2>
              <p className="text-sm text-slate-500 mt-2">Ensure all mandatory discovery fields are collected before sending to the Solutions Team.</p>
            </div>
            
            <div className="p-6 bg-slate-50 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Required Checklist</p>
              
              <div className="flex items-center gap-3">
                {isBudgetFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isBudgetFilled ? "text-slate-700" : "text-amber-700"}`}>Budget Details</span>
              </div>
              <div className="flex items-center gap-3">
                {isTimelineFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isTimelineFilled ? "text-slate-700" : "text-amber-700"}`}>Implementation Timeline</span>
              </div>
              <div className="flex items-center gap-3">
                {isDecisionMakerFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isDecisionMakerFilled ? "text-slate-700" : "text-amber-700"}`}>Decision Maker Identified</span>
              </div>
              <div className="flex items-center gap-3">
                {isModulesFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isModulesFilled ? "text-slate-700" : "text-amber-700"}`}>Required Modules Selected</span>
              </div>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                Review Again
              </button>
              <button 
                onClick={() => { setShowCompleteModal(false); setShowMeetingModal(true); }}
                disabled={!allMandatoryFilled || isSubmitting} 
                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <span className="spinner-white w-4 h-4" /> : null}
                Continue to Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-teal-50">
              <h2 className="text-lg font-extrabold text-teal-900">Schedule Customer Meeting</h2>
              <p className="text-xs text-teal-600 mt-1">Book the pre-sales demo or technical discussion.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Meeting Date & Time">
                  <Input 
                    type="datetime-local" 
                    value={detailsForm.meetingDate ? detailsForm.meetingDate.substring(0, 16) : ""} 
                    onChange={e => setDetailsForm({...detailsForm, meetingDate: e.target.value ? new Date(e.target.value).toISOString() : null})}
                  />
                </FormField>
                <FormField label="Location">
                  <Input 
                    value={detailsForm.meetingLocation || ""} 
                    onChange={e => setDetailsForm({...detailsForm, meetingLocation: e.target.value})} 
                    placeholder="e.g. Customer Office" 
                  />
                </FormField>
              </div>
              <FormField label="Mode">
                <Select 
                  value={detailsForm.meetingMode || ""} 
                  onChange={e => setDetailsForm({...detailsForm, meetingMode: e.target.value})}
                >
                  <option value="">Select mode...</option>
                  <option value="In-person">In-person</option>
                  <option value="Virtual">Virtual</option>
                </Select>
              </FormField>
              <FormField label="Agenda">
                <Textarea 
                  value={detailsForm.meetingAgenda || ""} 
                  onChange={e => setDetailsForm({...detailsForm, meetingAgenda: e.target.value})} 
                  rows={3} 
                  placeholder="e.g. Demo, Technical Discussion, Proposal Review" 
                />
              </FormField>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setShowMeetingModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setIsSubmitting(true);
                  await saveOpportunityDetailAction(dealId, detailsForm);
                  await handleAdvanceStage("MeetingScheduled");
                  setShowMeetingModal(false);
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                {isSubmitting ? "Scheduling..." : "Schedule Meeting"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">Requirement Gathering Document</h2>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              {buildDocSections().map(sec => (
                <div key={sec.title}>
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">{sec.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
                    {sec.rows.map(([label, value]) => (
                      <div key={label} className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
                        <span className="text-sm text-slate-700 font-medium break-words">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button onClick={() => setShowDocModal(false)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Success Overlay (guided stage progression) â”€â”€ */}
      <SuccessOverlay
        open={successOverlay.open}
        message={successOverlay.message}
        primary={successOverlay.primary}
        secondary={successOverlay.secondary}
        alternate={successOverlay.alternate}
        onClose={() => setSuccessOverlay(o => ({ ...o, open: false }))}
      />

    </div>
  );
}

