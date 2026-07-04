"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { formatDate, cn } from "@/lib/ui-utils";
import {
  ArrowLeft, CheckCircle, XCircle,
  ChevronRight, Save, AlertTriangle, Calendar,
  Edit3, FileText, MessageSquare,
} from "lucide-react";
import { CompetitorIntelligenceTab } from "@/components/competitor-intelligence/CompetitorIntelligenceTab";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGE_VALUES } from "@/lib/module-status-config";

const STAGE_DISPLAY_LABELS: Record<string, string> = {
  Qualified: "Qualified",
  RequirementGathering: "Req. Gathering",
  MeetingScheduled: "Meeting Scheduled",
  DemoConducted: "Demo Conducted",
  Rejected: "Rejected",
  Lost: "Lost",
};

const PIPELINE_STAGES = PIPELINE_STAGE_VALUES
  .filter((s) => s !== "Lost" && s !== "Rejected")
  .map((s, i) => ({
    key: s,
    label: STAGE_DISPLAY_LABELS[s] || s,
    order: PIPELINE_STAGE_ORDER[s] ?? i + 1,
  }));

const STAKEHOLDER_ROLES = [
  "Decision Maker",
  "Technical Evaluator",
  "Influencer",
  "Gatekeeper",
  "Finance Approver",
];

const ROLE_COLORS: Record<string, string> = {
  "Decision Maker": "bg-rose-100 text-rose-700 border-rose-200",
  "Technical Evaluator": "bg-violet-100 text-violet-700 border-violet-200",
  "Influencer": "bg-blue-100 text-blue-700 border-blue-200",
  "Gatekeeper": "bg-amber-100 text-amber-700 border-amber-200",
  "Finance Approver": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const STAGE_LABELS: Record<string, string> = {
  Qualified: "Qualified",
  RequirementGathering: "Requirement Gathering",
  MeetingScheduled: "Meeting Scheduled",
  DemoConducted: "Demo Conducted",
  Lost: "Lost",
  Rejected: "Rejected",
};

// Required fields per stage — must be saved before moving forward
const STAGE_REQUIRED_FIELDS: Record<string, { field: string; label: string }[]> = {
  RequirementGathering: [
    { field: "contactPerson", label: "Contact Person" },
    { field: "email", label: "Email" },
    { field: "phone", label: "Phone" },
    { field: "currentChallenges", label: "Current Challenges" },
    { field: "businessNeed", label: "Business Need" },
    { field: "urgencyPriority", label: "Urgency / Priority" },
    { field: "deploymentType", label: "Deployment Type" },
    { field: "budgetRange", label: "Budget Range" },
    { field: "expectedBudget", label: "Expected Budget" },
    { field: "decisionMaker", label: "Decision Maker" },
  ],
  MeetingScheduled: [
    { field: "meetingDate", label: "Meeting/Demo Date" },
    { field: "meetingType", label: "Meeting/Demo Type" },
    { field: "meetingStatus", label: "Outcome / Status" },
    { field: "nextFollowUpDate", label: "Next Follow-up Date" },
  ],
  DemoConducted: [
    { field: "demoDate", label: "Demo Date" },
    { field: "demoType", label: "Demo Type" },
    { field: "demoInterestLevel", label: "Interest Level" },
  ],
  // Rejected is terminal — no required fields
  Rejected: [],
};

const RG_MANDATORY_FIELDS = [
  { key: "contactPerson", label: "Contact Person", section: "Customer Details" },
  { key: "email", label: "Email", section: "Customer Details" },
  { key: "phone", label: "Phone", section: "Customer Details" },
  { key: "currentChallenges", label: "Current Challenges", section: "Business Requirements" },
  { key: "businessNeed", label: "Business Need", section: "Business Requirements" },
  { key: "urgencyPriority", label: "Urgency / Priority", section: "Business Requirements" },
  { key: "deploymentType", label: "Deployment Type", section: "Technical Requirements" },
  { key: "budgetRange", label: "Budget Range", section: "Commercial Information" },
  { key: "expectedBudget", label: "Expected Budget", section: "Commercial Information" },
  { key: "decisionMaker", label: "Decision Maker", section: "Commercial Information" },
];

const getMissingMandatoryFields = (formData: any) => {
  return RG_MANDATORY_FIELDS.filter((f) => {
    const val = formData[f.key];
    return !val || (typeof val === "string" && val.trim() === "");
  }).map((f) => f.label);
};

type StepState = "completed" | "active" | "future";

const getStepState = (stageKey: string, currentStage: string): StepState => {
  // Terminal stages — all pipeline steps are completed
  if (currentStage === "Lost" || currentStage === "Rejected" || currentStage === "Won") {
    return "completed";
  }
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === stageKey);
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "active";
  return "future";
};

const getStepTooltip = (stageKey: string, state: StepState, currentStageLabel: string) => {
  if (state === "completed") {
    const label = STAGE_LABELS[stageKey] || stageKey;
    return `Click to review and edit ${label} details`;
  }
  if (state === "active") return `Current stage — ${currentStageLabel}`;
  return "Complete current stage to unlock";
};

type Role = "SuperAdmin" | "Admin" | "SalesManager" | "SalesExecutive" | "CostingEngineer" | "Customer";

const MANAGER_ROLES: Role[] = ["Admin", "SalesManager", "SuperAdmin"];
const SALES_ROLES: Role[] = ["Admin", "SalesManager", "SuperAdmin", "SalesExecutive"];

const canEditOpportunity = (user: { role: Role; id: string } | null, deal: any) => {
  if (!user) return false;
  if (MANAGER_ROLES.includes(user.role)) return true;
  if (user.role === "SalesExecutive" && deal.assignedUserId === user.id) return true;
  return false;
};

const canChangeStage = (user: { role: Role; id: string } | null, deal: any) => {
  if (!user || deal.status === "Won" || deal.status === "Lost" || deal.status === "Rejected") return false;
  if (MANAGER_ROLES.includes(user.role)) return true;
  if (user.role === "SalesExecutive" && deal.assignedUserId === user.id) return true;
  return false;
};

const canAddFollowUp = (user: { role: Role; id: string } | null, deal: any) => {
  if (!user || deal.status === "Won" || deal.status === "Lost" || deal.status === "Rejected") return false;
  if (SALES_ROLES.includes(user.role)) return true;
  return false;
};


function ProposalQuotationGuide({
  opportunityId,
  linkedQuotations,
  loading,
  formatCurrency,
  onRefresh,
}: {
  opportunityId: string;
  linkedQuotations: any[];
  loading: boolean;
  formatCurrency: (amount: number) => string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [markingWon, setMarkingWon] = useState(false);

  const hasQuotation = linkedQuotations.length > 0;
  const latestQuote = linkedQuotations[0];
  const hasAcceptedQuote = linkedQuotations.some((q: any) => q.status === "Accepted");
  const hasSentQuote = linkedQuotations.some((q: any) => q.status === "Sent");
  const hasDraftQuote = linkedQuotations.some((q: any) => q.status === "Draft");
  const hasUnderReviewQuote = linkedQuotations.some((q: any) => q.status === "UnderReview");

  const handleSendQuote = async (quoteId: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/quotations/${quoteId}/send`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation sent to customer"); onRefresh(); }
      else toast.error(data.message || "Failed to send");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  const handleAcceptQuote = async (quoteId: string) => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/quotations/${quoteId}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation accepted"); onRefresh(); }
      else toast.error(data.message || "Failed to accept");
    } catch { toast.error("Failed to accept"); }
    finally { setAccepting(false); }
  };

  const handleNegotiate = async (quoteId: string) => {
    setNegotiating(true);
    try {
      const res = await fetch(`/api/quotations/${quoteId}/negotiate`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Moved to negotiation"); onRefresh(); }
      else toast.error(data.message || "Failed to move to negotiation");
    } catch { toast.error("Failed to move to negotiation"); }
    finally { setNegotiating(false); }
  };

  const handleMarkWon = async () => {
    setMarkingWon(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/mark-won`, { method: "POST" });
      const data = await res.json();
      if (res.ok || data.success) { toast.success("Deal marked as Won!"); window.location.reload(); }
      else toast.error(data.message || "Failed to mark as Won");
    } catch { toast.error("Failed to mark as Won"); }
    finally { setMarkingWon(false); }
  };

  if (loading) {
    return <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />;
  }

  // State D — Accepted quotation
  if (hasAcceptedQuote) {
    const q = linkedQuotations.find((q: any) => q.status === "Accepted") || latestQuote;
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Quotation accepted — ready to mark deal as Won!</p>
              <p className="text-xs text-green-600">
                {q.quotationCode} • Final value: {formatCurrency(q.finalAmount || q.totalAmount)}
              </p>
            </div>
          </div>
          <button
            onClick={handleMarkWon}
            disabled={markingWon}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {markingWon ? "Marking..." : "🏆 Mark Deal as Won"}
          </button>
        </div>
      </div>
    );
  }

  // State C — Sent quotation
  if (hasSentQuote) {
    const q = linkedQuotations.find((q: any) => q.status === "Sent") || latestQuote;
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Quotation sent — waiting for customer response</p>
              <p className="text-xs text-green-600">
                {q.quotationCode} • Valid until {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push(`/quotations/${q.id}`)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              View Quotation
            </button>
            <button
              onClick={() => handleAcceptQuote(q.id)}
              disabled={accepting}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {accepting ? "Accepting..." : "Mark as Accepted ✓"}
            </button>
            <button
              onClick={() => handleNegotiate(q.id)}
              disabled={negotiating}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {negotiating ? "Opening..." : "Negotiate Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State E — Under negotiation (UnderReview)
  if (hasUnderReviewQuote) {
    const q = linkedQuotations.find((q: any) => q.status === "UnderReview") || latestQuote;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤝</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Quotation under negotiation</p>
              <p className="text-xs text-amber-600">
                {q.quotationCode} • Final value: {formatCurrency(q.finalAmount || q.totalAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push(`/quotations/${q.id}`)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              View Quotation
            </button>
            <button
              onClick={() => handleAcceptQuote(q.id)}
              disabled={accepting}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {accepting ? "Accepting..." : "Mark as Accepted ✓"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State B — Draft quotation
  if (hasQuotation) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Quotation draft created — send it to the customer</p>
              <p className="text-xs text-blue-600">
                {latestQuote.quotationCode} • {formatCurrency(latestQuote.finalAmount || latestQuote.totalAmount)}
                • Valid until {latestQuote.validUntil ? new Date(latestQuote.validUntil).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/quotations/${latestQuote.id}`)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              View Quotation
            </button>
            <button
              onClick={() => handleSendQuote(latestQuote.id)}
              disabled={sending}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send to Customer →"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: "✓ Quotation Created", done: true },
            { label: "2. Send to Customer", done: false, active: true },
            { label: "3. Customer Accepts", done: false },
            { label: "4. Mark as Won", done: false },
          ].map((s, i) => (
            <div
              key={i}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${
                s.done ? "bg-green-100 text-green-800 border-green-200" : s.active ? "bg-blue-100 text-blue-800 border-blue-200 font-medium" : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // State A — No quotation: choose RFQ-based or direct quotation path
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 mb-1">Create a quotation for this opportunity</p>
          <p className="text-xs text-amber-700 mb-3">
            Choose how to proceed. RFQ is optional — you can create a quotation directly.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { step: "1", label: "Create RFQ (optional)", done: false },
              { step: "1", label: "Direct Quotation", done: false },
              { step: "2", label: "Send to Customer", done: false },
              { step: "3", label: "Customer Accepts", done: false },
              { step: "4", label: "Mark Deal as Won", done: false },
            ].map((s, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full border ${
                  s.done ? "bg-green-100 text-green-800 border-green-200" : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                <span>{s.done ? "✓" : s.step}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push(`/rfq/new?opportunityId=${opportunityId}`)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              + Create RFQ
            </button>
            <button
              onClick={() => router.push(`/quotations/new?opportunityId=${opportunityId}`)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-amber-700 bg-white border border-amber-300 hover:bg-amber-100 transition-colors"
            >
              + Direct Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const toast = useToast();

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);

  // Modals
  const [showLostModal, setShowLostModal] = useState(false);
  const [showStakeholderModal, setShowStakeholderModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rejectForm, setRejectForm] = useState({ rejectedReason: "", notes: "" });
  const [followUpForm, setFollowUpForm] = useState({ title: "", nextMeetingDate: "", priority: "Medium", notes: "" });

  // Stage review/edit state: which stage form is currently rendered (does NOT mutate deal.status)
  const [viewingStage, setViewingStage] = useState<string | null>(null);

  // Form state
  const [lostForm, setLostForm] = useState({ lost_reason_id: "", competitor_id: "", notes: "" });
  const [stakeholderForm, setStakeholderForm] = useState({ contact_id: "", stakeholder_role: "Influencer", is_primary: false });
  const [editForm, setEditForm] = useState<any>({});

  // RG form state
  const [rgForm, setRgForm] = useState<any>({});
  const [rgExpanded, setRgExpanded] = useState<Record<string, boolean>>({ customer_info: true, business_req: false, tech_req: false, tech_discussion: false, commercial_info: false, internal_notes: false });
  const [rgSaving, setRgSaving] = useState(false);
  const [rgAttempted, setRgAttempted] = useState(false);
  const [stageMoving, setStageMoving] = useState(false);
  const [linkedQuotations, setLinkedQuotations] = useState<any[]>([]);
  const [linkedQuotationsLoading, setLinkedQuotationsLoading] = useState(false);
  // V2: Sample management state
  const [products, setProducts] = useState<any[]>([]);
  const [linkedSample, setLinkedSample] = useState<any>(null);
  const [sampleForm, setSampleForm] = useState({ productId: "", quantity: "1", specifications: "" });
  const [sampleSaving, setSampleSaving] = useState(false);

  const fetchLinkedQuotations = useCallback(async () => {
    setLinkedQuotationsLoading(true);
    try {
      const res = await fetch(`/api/opportunities/${id}/quotations`);
      const data = await res.json();
      if (data.success) setLinkedQuotations(data.data || []);
    } catch {
      // silent fail
    } finally {
      setLinkedQuotationsLoading(false);
    }
  }, [id]);

  const fetchDeal = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/opportunities/${id}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDeal(json.data);
      setEditForm({
        dealName: json.data.dealName,
        dealValue: json.data.dealValue,
        expectedCloseDate: json.data.expectedCloseDate?.split("T")[0],
        probabilityPercent: json.data.probabilityPercent,
        notes: json.data.notes || "",
        assignedUserId: json.data.assignedUserId || "",
      });
      // Initialize RG form from opportunityDetail
      const d = json.data.opportunityDetail || {};
      setRgForm({
        currentChallenges: d.currentChallenges || "",
        painPoints: d.painPoints || "",
        painPointsList: d.painPointsList || "",
        modulesRequired: d.modulesRequired || "",
        deploymentType: d.deploymentType || "",
        integrationsRequired: d.integrationsRequired || "",
        userCountSales: d.userCountSales || "",
        userCountManagers: d.userCountManagers || "",
        userCountAdmins: d.userCountAdmins || "",
        budgetRange: d.budgetRange || "",
        timeline: d.timeline || "",
        procurementProcess: d.procurementProcess || "",
        decisionMaker: d.decisionMaker || "",
        influencer: d.influencer || "",
        budgetOwner: d.budgetOwner || "",
        expectedGoLive: d.expectedGoLive ? d.expectedGoLive.split("T")[0] : "",
        currentVendor: d.currentVendor || "",
        competitorsEvaluated: d.competitorsEvaluated || "",
        businessNeed: d.businessNeed || "",
        expectedOutcome: d.expectedOutcome || "",
        requiredDepartments: d.requiredDepartments || "",
        numberOfUsers: d.numberOfUsers || "",
        urgencyPriority: d.urgencyPriority || "",
        businessGoals: d.businessGoals || "",
        successCriteria: d.successCriteria || "",
        existingSoftwareStack: d.existingSoftwareStack || "",
        securityCompliance: d.securityCompliance || "",
        userRolesPermissions: d.userRolesPermissions || "",
        reportingRequirements: d.reportingRequirements || "",
        dataMigrationRequired: d.dataMigrationRequired || "",
        customizationNeeded: d.customizationNeeded || "",
        apiThirdPartyReqs: d.apiThirdPartyReqs || "",
        technicalConstraints: d.technicalConstraints || "",
        itTeamNotes: d.itTeamNotes || "",
        expectedBudget: d.expectedBudget || "",
        finalDiscussedBudget: d.finalDiscussedBudget || "",
        pricingModel: d.pricingModel || "",
        licenseCount: d.licenseCount || "",
        paymentTerms: d.paymentTerms || "",
        billingCycle: d.billingCycle || "",
        competitorInfo: d.competitorInfo || "",
        commercialRisks: d.commercialRisks || "",
        discountRequested: d.discountRequested || "",
        proposalValue: d.proposalValue || "",
        negotiationNotes: d.negotiationNotes || "",
        internalSalesNotes: d.internalSalesNotes || "",
        presalesNotes: d.presalesNotes || "",
        objections: d.objections || "",
        followUpSummary: d.followUpSummary || "",
        risksBlockers: d.risksBlockers || "",
        nextSteps: d.nextSteps || "",
        managementNotes: d.managementNotes || "",
        companyName: d.companyName || "",
        industry: d.industry || "",
        contactPerson: d.contactPerson || "",
        email: d.email || "",
        phone: d.phone || "",
        employeeCount: d.employeeCount || "",
        approvalProcess: d.approvalProcess || "",
        buyingAuthorityNotes: d.buyingAuthorityNotes || "",
        // Meeting Scheduled
        meetingType: d.meetingType || "",
        meetingMode: d.meetingMode || "",
        meetingDate: d.meetingDate ? d.meetingDate.split("T")[0] : "",
        meetingStatus: d.meetingStatus || "",
        meetingDuration: d.meetingDuration || "",
        meetingParticipants: d.meetingParticipants || "",
        meetingLocation: d.meetingLocation || "",
        meetingAgenda: d.meetingAgenda || "",
        meetingOutcome: d.meetingOutcome || "",
        nextFollowUpDate: d.nextFollowUpDate ? d.nextFollowUpDate.split("T")[0] : "",
        // Demo Conducted
        demoType: d.demoType || "",
        demoDate: d.demoDate ? d.demoDate.split("T")[0] : "",
        demoPresenter: d.demoPresenter || "",
        demoDuration: d.demoDuration || "",
        demoAttendees: d.demoAttendees || "",
        demoCustomerRating: d.demoCustomerRating || "",
        demoInterestLevel: d.demoInterestLevel || "",
        demoQuestionsRaised: d.demoQuestionsRaised || "",
        demoRejectionReason: d.demoRejectionReason || "",
        demoRejectionRemarks: d.demoRejectionRemarks || "",
        demoCompetitorName: d.demoCompetitorName || "",
        // Proposal Sent
        proposedSolution: d.proposedSolution || "",
        scopeClassification: d.scopeClassification || "",
        estimatedDuration: d.estimatedDuration || "",
        developmentEffort: d.developmentEffort || "",
        implementationEffort: d.implementationEffort || "",
        supportRequirements: d.supportRequirements || "",
        // V2: Sample management + technical discussion
        requiresSamples: d.requiresSamples || "",
        sampleStatus: d.sampleStatus || "",
        techDiscussionDate: d.techDiscussionDate ? d.techDiscussionDate.split("T")[0] : "",
        techDiscussionAttendees: d.techDiscussionAttendees || "",
        techDiscussionQuestions: d.techDiscussionQuestions || "",
        techDiscussionConfirmed: d.techDiscussionConfirmed || false,
        demoFollowUpDate: d.demoFollowUpDate ? d.demoFollowUpDate.split("T")[0] : "",
      });
      } else {
        const msg = json.message || `Failed to load opportunity (HTTP ${res.status})`;
        setFetchError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err?.message || "Network error while loading opportunity";
      setFetchError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, [id]);

  // V2: Fetch linked sample for this opportunity
  const fetchLinkedSample = useCallback(async () => {
    try {
      const res = await fetch(`/api/samples?opportunityId=${id}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setLinkedSample(json.data[0]); // first sample linked to this deal
      } else {
        setLinkedSample(null);
      }
    } catch {
      setLinkedSample(null);
    }
  }, [id]);

  // V2: Fetch products for sample creation
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalogue/products?pageSize=100`);
      const json = await res.json();
      if (json.success) setProducts(json.data || []);
    } catch {
      // silent
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${id}/contacts`);
    if (res.ok) {
      const json = await res.json();
      setContacts(json.data);
    }
  }, [id]);

  const fetchLossReasons = useCallback(async () => {
    const res = await fetch(`/api/loss-reasons?isActive=true`);
    if (res.ok) {
      const json = await res.json();
      setLossReasons(json.data);
    }
  }, []);

  const fetchCompetitors = useCallback(async () => {
    const res = await fetch(`/api/competitors`);
    if (res.ok) {
      const json = await res.json();
      setCompetitors(json.data || []);
    }
  }, []);

  const fetchAllContacts = useCallback(async () => {
    if (!deal?.customerId) return;
    const res = await fetch(`/api/contacts?customerId=${deal.customerId}`);
    if (res.ok) {
      const json = await res.json();
      setAllContacts(json.data || []);
    }
  }, [deal?.customerId]);

  useEffect(() => {
    fetchDeal();
    fetchContacts();
    fetchLossReasons();
    fetchCompetitors();
    fetchLinkedQuotations();
    fetchLinkedSample();
    fetchProducts();
  }, [fetchDeal, fetchContacts, fetchLossReasons, fetchCompetitors, fetchLinkedQuotations, fetchLinkedSample, fetchProducts]);

  useEffect(() => {
    if (showStakeholderModal) fetchAllContacts();
  }, [showStakeholderModal, fetchAllContacts]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveOverview = async () => {
    const res = await fetch(`/api/opportunities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      toast.success("Opportunity updated");
      setShowEditModal(false);
      fetchDeal();
    } else {
      const json = await res.json();
      toast.error(json.message || "Failed to update");
    }
  };

  const getNextStageKey = (currentStage: string) => {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);
    if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return null;
    return PIPELINE_STAGES[idx + 1].key;
  };

  const handleSaveAndMove = async (toStage: string, options?: { demoOutcome?: "Accepted" | "Rejected" | "Follow-up needed" }) => {
    if (!toStage) return;
    setStageMoving(true);
    try {
      // V2: Sample Management branch — if Qualified and requiresSamples=yes, save sampleStatus and hold
      if (deal.status === "Qualified" && rgForm.requiresSamples === "yes" && toStage === "RequirementGathering") {
        // Save details with sampleStatus pending
        const saveRes = await fetch(`/api/opportunities/${id}/details`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...rgForm, sampleStatus: "pending" }),
        });
        if (!saveRes.ok) {
          const json = await saveRes.json().catch(() => ({}));
          toast.error(json.message || "Failed to save stage details");
          setStageMoving(false);
          return;
        }
        toast.success("Sample request flagged. Opportunity held at Qualified until sample is resolved.");
        fetchDeal();
        fetchLinkedSample();
        setStageMoving(false);
        return;
      }

      // 1. Save current stage details first
      const saveRes = await fetch(`/api/opportunities/${id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rgForm),
      });
      if (!saveRes.ok) {
        const json = await saveRes.json().catch(() => ({}));
        toast.error(json.message || "Failed to save stage details");
        setStageMoving(false);
        return;
      }

      // 2. Move to next stage
      const res = await fetch(`/api/opportunities/${id}/stage-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_stage: toStage,
          ...(options?.demoOutcome ? { demoOutcome: options.demoOutcome } : {}),
          ...(options?.demoOutcome === "Follow-up needed" && rgForm.demoFollowUpDate ? { demoFollowUpDate: rgForm.demoFollowUpDate } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Moved to ${STAGE_LABELS[toStage] || toStage} ✓`);
        fetchDeal();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const message = json.message || "Failed to change stage";
        if (typeof message === "string" && message.toLowerCase().includes("accepted quotation")) {
          toast.error(
            <div className="flex flex-col gap-2">
              <span>An accepted quotation is required before marking this opportunity as Won.</span>
              <button
                onClick={() => router.push(`/quotations/new?opportunityId=${id}`)}
                className="self-start px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors"
              >
                Create Quotation →
              </button>
            </div>,
            undefined,
            8000
          );
        } else {
          toast.error(message);
        }
      }
    } finally {
      setStageMoving(false);
    }
  };

  const handleMarkRejected = async () => {
    if (!rejectForm.rejectedReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    const res = await fetch(`/api/opportunities/${id}/stage-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_stage: "Rejected",
        rejectedReason: rejectForm.rejectedReason,
        notes: rejectForm.notes || undefined,
      }),
    });
    if (res.ok) {
      toast.success("Opportunity marked as Rejected");
      setShowRejectModal(false);
      setRejectForm({ rejectedReason: "", notes: "" });
      fetchDeal();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Failed to mark as Rejected");
    }
  };

  const handleMarkLost = async () => {
    if (!lostForm.lost_reason_id) {
      toast.error("Loss reason is required");
      return;
    }
    const res = await fetch(`/api/opportunities/${id}/mark-lost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lost_reason_id: lostForm.lost_reason_id,
        competitor_id: lostForm.competitor_id || undefined,
        notes: lostForm.notes || undefined,
      }),
    });
    if (res.ok) {
      toast.success("Opportunity marked as Lost");
      setShowLostModal(false);
      setLostForm({ lost_reason_id: "", competitor_id: "", notes: "" });
      fetchDeal();
    } else {
      const json = await res.json();
      toast.error(json.message || "Failed to mark as Lost");
    }
  };

  const handleCreateFollowUp = async () => {
    if (!followUpForm.nextMeetingDate) {
      toast.error("Due date is required");
      return;
    }
    const res = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: deal.customerId,
        nextMeetingDate: followUpForm.nextMeetingDate,
        remarks: followUpForm.title || `Follow-up for ${deal.dealName}`,
        notes: followUpForm.notes || null,
        priority: followUpForm.priority,
        sourceType: "DEAL",
        sourceId: id,
      }),
    });
    if (res.ok) {
      toast.success("Follow-up created");
      setShowFollowUpModal(false);
      setFollowUpForm({ title: "", nextMeetingDate: "", priority: "Medium", notes: "" });
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Failed to create follow-up");
    }
  };

  const handleAddStakeholder = async () => {
    if (!stakeholderForm.contact_id) {
      toast.error("Please select a contact");
      return;
    }
    const res = await fetch(`/api/opportunities/${id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stakeholderForm),
    });
    if (res.ok) {
      toast.success("Stakeholder added");
      setShowStakeholderModal(false);
      setStakeholderForm({ contact_id: "", stakeholder_role: "Influencer", is_primary: false });
      fetchContacts();
    } else {
      const json = await res.json();
      toast.error(json.message || "Failed to add stakeholder");
    }
  };

  const handleRemoveStakeholder = async (stakeholderId: string) => {
    const res = await fetch(`/api/opportunities/${id}/contacts?stakeholderId=${stakeholderId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Stakeholder removed");
      fetchContacts();
    } else {
      toast.error("Failed to remove stakeholder");
    }
  };

  // ─── Stage-Gate Validation ──────────────────────────────────────────────────
  // Checks that current stage's required fields are saved before moving forward.
  // Backward moves (reviewing) are always allowed (subject to Manager/Admin API check).

  const handleSaveRG = async () => {
    setRgSaving(true);
    const res = await fetch(`/api/opportunities/${id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rgForm),
    });
    setRgSaving(false);
    if (res.ok) {
      toast.success("Requirement Gathering details saved");
      fetchDeal();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Failed to save details");
    }
  };

  const handleStepClick = (stageKey: string, state: StepState) => {
    if (state === "future") return;
    setViewingStage(stageKey);
  };

  const handleSaveCompletedStage = async () => {
    if (!viewingStage) return;
    setRgSaving(true);
    const res = await fetch(`/api/opportunities/${id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rgForm, stage_context: viewingStage }),
    });
    setRgSaving(false);
    if (res.ok) {
      toast.success(`${STAGE_LABELS[viewingStage] || viewingStage} details updated`);
      fetchDeal();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Failed to save details");
    }
  };

  const toggleRGSection = (key: string) => {
    setRgExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateStageGate = (fromStage: string, toStage: string): string | null => {
    const fromOrder = PIPELINE_STAGES.find((s) => s.key === fromStage)?.order ?? 0;
    const toOrder = PIPELINE_STAGES.find((s) => s.key === toStage)?.order ?? 0;
    if (toOrder <= fromOrder) return null;

    const required = STAGE_REQUIRED_FIELDS[fromStage];
    if (!required) return null;

    const d = deal.opportunityDetail || {};
    const missing = required.filter((r) => {
      const val = (d as any)[r.field];
      return val === null || val === undefined || val === "";
    });

    if (missing.length > 0) {
      return `Cannot move to ${STAGE_LABELS[toStage] || toStage}. Please save the following in the stage form first: ${missing.map((m) => m.label).join(", ")}.`;
    }
    return null;
  };


  // ─── Stage Form Renderer ──────────────────────────────────────────────────
  // Replaces the old Req. Gathering tab (red box) with a stage-specific form
  // inside the second box. The form content changes based on deal.status.

  const renderStageForm = () => {
    const effectiveStage = viewingStage || deal.status;
    const isReviewingCompleted = effectiveStage !== deal.status;

    const title: Record<string, string> = {
      Qualified: "Qualified Details",
      RequirementGathering: "Requirement Gathering",
      MeetingScheduled: "Meeting Details",
      DemoConducted: "Demo Details",
      Rejected: "Rejection Details",
      Lost: "Opportunity Summary",
    };
    const stageTitle = isReviewingCompleted
      ? `Review: ${title[effectiveStage] || "Stage Details"}`
      : title[effectiveStage] || "Stage Details";

    return (
      <div className="p-6 border-t border-slate-100">
        {isReviewingCompleted && (
          <div className="bg-[#EFF6FF] border border-[#93C5FD] rounded-lg px-3.5 py-2.5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-[13px] text-[#1D4ED8]">
                📋 Reviewing completed stage: <strong>{STAGE_LABELS[effectiveStage] || effectiveStage}</strong>
              </span>
              <span className="text-[11px] text-[#3B82F6]">
                You can edit and save changes. This will not affect the current stage.
              </span>
            </div>
            <button
              onClick={() => setViewingStage(null)}
              className="text-xs text-[#2563EB] underline bg-transparent border-none cursor-pointer text-left sm:text-right"
            >
              Back to current stage →
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stageTitle}</h3>
          {canEditOpportunity(user, deal) && !isTerminalStage && (
            <span className="text-xs text-slate-400">Save changes at the bottom of the form</span>
          )}
        </div>

        {effectiveStage === "Qualified" && (
          <div className="space-y-4">
            {/* V2: Inline Sample Management Panel */}
            {rgForm.requiresSamples === "yes" && (
              <div className="border-2 border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                <div className="px-4 py-3 bg-amber-100/50 border-b border-amber-200">
                  <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    📦 Sample Management
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">Opportunity is held at Qualified until sample is resolved</p>
                </div>
                <div className="p-4 space-y-4">
                  {/* No sample yet — show creation form */}
                  {!linkedSample && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField label="Select Product" required>
                          <Select
                            value={sampleForm.productId}
                            onChange={(e) => setSampleForm({ ...sampleForm, productId: e.target.value })}
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Quantity" required>
                          <Input
                            type="number"
                            min="1"
                            value={sampleForm.quantity}
                            onChange={(e) => setSampleForm({ ...sampleForm, quantity: e.target.value })}
                          />
                        </FormField>
                        <div className="flex items-end">
                          <button
                            onClick={async () => {
                              if (!sampleForm.productId) { toast.error("Please select a product"); return; }
                              setSampleSaving(true);
                              try {
                                const res = await fetch("/api/samples", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    customerId: deal.customerId,
                                    productId: sampleForm.productId,
                                    quantity: sampleForm.quantity,
                                    specifications: sampleForm.specifications,
                                    opportunityId: id,
                                  }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  toast.success("Sample request created (New)");
                                  setLinkedSample(data.data);
                                  setSampleForm({ productId: "", quantity: "1", specifications: "" });
                                } else {
                                  toast.error(data.message || "Failed to create sample");
                                }
                              } catch {
                                toast.error("Failed to create sample");
                              } finally {
                                setSampleSaving(false);
                              }
                            }}
                            disabled={sampleSaving}
                            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {sampleSaving ? "Creating..." : "Create Sample Request"}
                          </button>
                        </div>
                      </div>
                      <FormField label="Specifications / Notes">
                        <Textarea
                          rows={2}
                          value={sampleForm.specifications}
                          onChange={(e) => setSampleForm({ ...sampleForm, specifications: e.target.value })}
                          placeholder="Sample specifications or special requirements..."
                        />
                      </FormField>
                    </div>
                  )}

                  {/* Sample exists — show status flow */}
                  {linkedSample && (
                    <div className="space-y-3">
                      {/* Sample info card */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{linkedSample.sampleCode}</p>
                            <p className="text-xs text-slate-500">
                              {linkedSample.product ? `${linkedSample.product.productCode} - ${linkedSample.product.name}` : "—"}
                              {" · Qty: "}{linkedSample.quantity}
                            </p>
                          </div>
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium",
                            linkedSample.status === "New" && "bg-blue-100 text-blue-700",
                            linkedSample.status === "UnderReview" && "bg-amber-100 text-amber-700",
                            linkedSample.status === "SentToCustomer" && "bg-purple-100 text-purple-700",
                            linkedSample.status === "Approved" && "bg-green-100 text-green-700",
                            linkedSample.status === "Rejected" && "bg-red-100 text-red-700",
                            linkedSample.status === "Revision" && "bg-orange-100 text-orange-700",
                          )}>
                            {linkedSample.status}
                          </span>
                        </div>
                        <button
                          onClick={() => router.push(`/samples/${linkedSample.id}`)}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          View Details →
                        </button>
                      </div>

                      {/* Status flow buttons */}
                      {linkedSample.status !== "Approved" && linkedSample.status !== "Rejected" && (
                        <div className="flex flex-wrap gap-2">
                          {linkedSample.status === "New" && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "UnderReview" }),
                                });
                                if (res.ok) { toast.success("Sample moved to Under Review"); fetchLinkedSample(); }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                            >
                              → Under Review
                            </button>
                          )}
                          {linkedSample.status === "UnderReview" && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "SentToCustomer" }),
                                });
                                if (res.ok) { toast.success("Sample sent to customer"); fetchLinkedSample(); }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                            >
                              → Sent to Customer
                            </button>
                          )}
                          {linkedSample.status === "SentToCustomer" && (
                            <>
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "Approved", customerFeedback: "Sample approved by customer" }),
                                  });
                                  if (res.ok) {
                                    toast.success("Sample Approved — advancing to Requirement Gathering");
                                    // Update opportunity sampleStatus + advance stage
                                    await fetch(`/api/opportunities/${id}/details`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ sampleStatus: "approved" }),
                                    });
                                    await fetch(`/api/opportunities/${id}/stage-change`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ to_stage: "RequirementGathering" }),
                                    });
                                    fetchDeal();
                                    fetchLinkedSample();
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                              >
                                ✓ Approve Sample → Advance to RG
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "Rejected", customerFeedback: "Sample rejected by customer" }),
                                  });
                                  if (res.ok) {
                                    toast.error("Sample Rejected — moving opportunity to Rejected");
                                    await fetch(`/api/opportunities/${id}/details`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ sampleStatus: "rejected" }),
                                    });
                                    await fetch(`/api/opportunities/${id}/stage-change`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ to_stage: "Rejected", rejectedReason: "Sample rejected" }),
                                    });
                                    fetchDeal();
                                    fetchLinkedSample();
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                              >
                                ✗ Reject Sample → Move to Rejected
                              </button>
                            </>
                          )}
                          {(linkedSample.status === "UnderReview" || linkedSample.status === "SentToCustomer") && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "Revision", revisionNotes: "Revision requested" }),
                                });
                                if (res.ok) { toast.success("Sample sent for revision"); fetchLinkedSample(); }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
                            >
                              ↻ Revision
                            </button>
                          )}
                          {linkedSample.status === "Revision" && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/samples/${linkedSample.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "UnderReview" }),
                                });
                                if (res.ok) { toast.success("Sample back to Under Review"); fetchLinkedSample(); }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                            >
                              → Under Review
                            </button>
                          )}
                        </div>
                      )}

                      {/* Approved/Rejected final state */}
                      {linkedSample.status === "Approved" && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium">
                          ✅ Sample approved — opportunity advanced to Requirement Gathering
                        </div>
                      )}
                      {linkedSample.status === "Rejected" && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-medium">
                          ❌ Sample rejected — opportunity moved to Rejected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-sm text-slate-600">
              Opportunity is qualified. Review or update the qualification details below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Budget discussed">
                <Input value={rgForm.budgetRange || ""} onChange={(e) => setRgForm({ ...rgForm, budgetRange: e.target.value })} />
              </FormField>
              <FormField label="Timeline">
                <Input value={rgForm.timeline || ""} onChange={(e) => setRgForm({ ...rgForm, timeline: e.target.value })} />
              </FormField>
              <FormField label="Lead is Genuine (verified requirement)" className="md:col-span-2">
                <Select
                  value={rgForm.businessNeed ? "Yes" : "No"}
                  onChange={(e) => setRgForm({ ...rgForm, businessNeed: e.target.value === "Yes" ? "Verified requirement" : "" })}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </Select>
              </FormField>
              <FormField label="Customer requires samples?" className="md:col-span-2">
                <Select
                  value={rgForm.requiresSamples || ""}
                  onChange={(e) => setRgForm({ ...rgForm, requiresSamples: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes — route to Sample Management</option>
                  <option value="no">No — proceed to Requirement Gathering</option>
                </Select>
              </FormField>
              <FormField label="Notes" className="md:col-span-2">
                <Textarea rows={3} value={rgForm.internalSalesNotes || ""} onChange={(e) => setRgForm({ ...rgForm, internalSalesNotes: e.target.value })} />
              </FormField>
            </div>
          </div>
        )}

        {effectiveStage === "RequirementGathering" && (
          <div className="space-y-6">
            {(() => {
              const missingFields = getMissingMandatoryFields(rgForm);
              const filledCount = RG_MANDATORY_FIELDS.length - missingFields.length;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", missingFields.length === 0 ? "bg-emerald-500" : "bg-[var(--primary)]")}
                        style={{ width: `${(filledCount / RG_MANDATORY_FIELDS.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap font-medium">{filledCount}/{RG_MANDATORY_FIELDS.length} required fields filled</span>
                  </div>
                  {rgAttempted && missingFields.length > 0 && (
                    <p className="text-xs text-rose-500 font-medium">Please fill: {missingFields.join(", ")}</p>
                  )}
                </div>
              );
            })()}

            {/* Customer Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("customer_info")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Customer Details</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.customer_info && "rotate-90")} />
              </button>
              {rgExpanded.customer_info && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Company Name"><Input value={rgForm.companyName || ""} onChange={(e) => setRgForm({ ...rgForm, companyName: e.target.value })} /></FormField>
                  <FormField label="Industry"><Input value={rgForm.industry || ""} onChange={(e) => setRgForm({ ...rgForm, industry: e.target.value })} /></FormField>
                  <FormField label="Contact Person" required error={rgAttempted && !rgForm.contactPerson ? "This field is required" : ""}><Input value={rgForm.contactPerson || ""} onChange={(e) => setRgForm({ ...rgForm, contactPerson: e.target.value })} className={cn(rgAttempted && !rgForm.contactPerson && "border-rose-500")} /></FormField>
                  <FormField label="Email" required error={rgAttempted && !rgForm.email ? "This field is required" : ""}><Input value={rgForm.email || ""} onChange={(e) => setRgForm({ ...rgForm, email: e.target.value })} className={cn(rgAttempted && !rgForm.email && "border-rose-500")} /></FormField>
                  <FormField label="Phone" required error={rgAttempted && !rgForm.phone ? "This field is required" : ""}><Input value={rgForm.phone || ""} onChange={(e) => setRgForm({ ...rgForm, phone: e.target.value })} className={cn(rgAttempted && !rgForm.phone && "border-rose-500")} /></FormField>
                  <FormField label="Employee Count"><Input type="number" value={rgForm.employeeCount || ""} onChange={(e) => setRgForm({ ...rgForm, employeeCount: e.target.value })} /></FormField>
                  <FormField label="Approval Process"><Textarea rows={2} value={rgForm.approvalProcess || ""} onChange={(e) => setRgForm({ ...rgForm, approvalProcess: e.target.value })} /></FormField>
                  <FormField label="Buying Authority Notes"><Textarea rows={2} value={rgForm.buyingAuthorityNotes || ""} onChange={(e) => setRgForm({ ...rgForm, buyingAuthorityNotes: e.target.value })} /></FormField>
                </div>
              )}
            </div>

            {/* Business Requirements */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("business_req")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Business Requirements</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.business_req && "rotate-90")} />
              </button>
              {rgExpanded.business_req && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Current Challenges" required error={rgAttempted && !rgForm.currentChallenges ? "This field is required" : ""}><Textarea rows={3} value={rgForm.currentChallenges || ""} onChange={(e) => setRgForm({ ...rgForm, currentChallenges: e.target.value })} className={cn(rgAttempted && !rgForm.currentChallenges && "border-rose-500")} /></FormField>
                  <FormField label="Pain Points"><Textarea rows={3} value={rgForm.painPoints || ""} onChange={(e) => setRgForm({ ...rgForm, painPoints: e.target.value })} /></FormField>
                  <FormField label="Business Need" required error={rgAttempted && !rgForm.businessNeed ? "This field is required" : ""}><Textarea rows={3} value={rgForm.businessNeed || ""} onChange={(e) => setRgForm({ ...rgForm, businessNeed: e.target.value })} className={cn(rgAttempted && !rgForm.businessNeed && "border-rose-500")} /></FormField>
                  <FormField label="Expected Outcome"><Textarea rows={3} value={rgForm.expectedOutcome || ""} onChange={(e) => setRgForm({ ...rgForm, expectedOutcome: e.target.value })} /></FormField>
                  <FormField label="Required Departments"><Input value={rgForm.requiredDepartments || ""} onChange={(e) => setRgForm({ ...rgForm, requiredDepartments: e.target.value })} /></FormField>
                  <FormField label="Number of Users"><Input type="number" value={rgForm.numberOfUsers || ""} onChange={(e) => setRgForm({ ...rgForm, numberOfUsers: e.target.value })} /></FormField>
                  <FormField label="Urgency / Priority" required error={rgAttempted && !rgForm.urgencyPriority ? "This field is required" : ""}>
                    <Select value={rgForm.urgencyPriority || ""} onChange={(e) => setRgForm({ ...rgForm, urgencyPriority: e.target.value })} className={cn(rgAttempted && !rgForm.urgencyPriority && "border-rose-500")}>
                      <option value="">Select...</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </Select>
                  </FormField>
                  <FormField label="Business Goals"><Textarea rows={2} value={rgForm.businessGoals || ""} onChange={(e) => setRgForm({ ...rgForm, businessGoals: e.target.value })} /></FormField>
                  <FormField label="Success Criteria"><Textarea rows={2} value={rgForm.successCriteria || ""} onChange={(e) => setRgForm({ ...rgForm, successCriteria: e.target.value })} /></FormField>
                  <FormField label="Modules Required"><Textarea rows={2} value={rgForm.modulesRequired || ""} onChange={(e) => setRgForm({ ...rgForm, modulesRequired: e.target.value })} /></FormField>
                </div>
              )}
            </div>

            {/* Technical Requirements */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("tech_req")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Technical Requirements</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.tech_req && "rotate-90")} />
              </button>
              {rgExpanded.tech_req && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Deployment Type" required error={rgAttempted && !rgForm.deploymentType ? "This field is required" : ""}>
                    <Select value={rgForm.deploymentType || ""} onChange={(e) => setRgForm({ ...rgForm, deploymentType: e.target.value })} className={cn(rgAttempted && !rgForm.deploymentType && "border-rose-500")}>
                      <option value="">Select...</option>
                      <option value="Cloud SaaS">Cloud SaaS</option>
                      <option value="On-Premise">On-Premise</option>
                      <option value="Hybrid">Hybrid</option>
                    </Select>
                  </FormField>
                  <FormField label="Integrations Required"><Textarea rows={2} value={rgForm.integrationsRequired || ""} onChange={(e) => setRgForm({ ...rgForm, integrationsRequired: e.target.value })} /></FormField>
                  <FormField label="Existing Software Stack"><Textarea rows={2} value={rgForm.existingSoftwareStack || ""} onChange={(e) => setRgForm({ ...rgForm, existingSoftwareStack: e.target.value })} /></FormField>
                  <FormField label="Security & Compliance"><Textarea rows={2} value={rgForm.securityCompliance || ""} onChange={(e) => setRgForm({ ...rgForm, securityCompliance: e.target.value })} /></FormField>
                  <FormField label="User Roles & Permissions"><Textarea rows={2} value={rgForm.userRolesPermissions || ""} onChange={(e) => setRgForm({ ...rgForm, userRolesPermissions: e.target.value })} /></FormField>
                  <FormField label="Reporting Requirements"><Textarea rows={2} value={rgForm.reportingRequirements || ""} onChange={(e) => setRgForm({ ...rgForm, reportingRequirements: e.target.value })} /></FormField>
                  <FormField label="Data Migration Required">
                    <Select value={rgForm.dataMigrationRequired || ""} onChange={(e) => setRgForm({ ...rgForm, dataMigrationRequired: e.target.value })}>
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </Select>
                  </FormField>
                  <FormField label="Customization Needed"><Textarea rows={2} value={rgForm.customizationNeeded || ""} onChange={(e) => setRgForm({ ...rgForm, customizationNeeded: e.target.value })} /></FormField>
                  <FormField label="API / Third-Party Reqs"><Textarea rows={2} value={rgForm.apiThirdPartyReqs || ""} onChange={(e) => setRgForm({ ...rgForm, apiThirdPartyReqs: e.target.value })} /></FormField>
                  <FormField label="Technical Constraints"><Textarea rows={2} value={rgForm.technicalConstraints || ""} onChange={(e) => setRgForm({ ...rgForm, technicalConstraints: e.target.value })} /></FormField>
                  <FormField label="IT Team Notes"><Textarea rows={2} value={rgForm.itTeamNotes || ""} onChange={(e) => setRgForm({ ...rgForm, itTeamNotes: e.target.value })} /></FormField>
                  <FormField label="User Count — Sales"><Input type="number" value={rgForm.userCountSales || ""} onChange={(e) => setRgForm({ ...rgForm, userCountSales: e.target.value })} /></FormField>
                  <FormField label="User Count — Managers"><Input type="number" value={rgForm.userCountManagers || ""} onChange={(e) => setRgForm({ ...rgForm, userCountManagers: e.target.value })} /></FormField>
                  <FormField label="User Count — Admins"><Input type="number" value={rgForm.userCountAdmins || ""} onChange={(e) => setRgForm({ ...rgForm, userCountAdmins: e.target.value })} /></FormField>
                </div>
              )}
            </div>

            {/* V2 Part B — Technical Discussion (closing step of Requirement Gathering) */}
            <div className="border-2 border-[var(--primary)]/30 rounded-xl overflow-hidden bg-[var(--primary)]/[0.02]">
              <button onClick={() => toggleRGSection("tech_discussion")} className="w-full px-4 py-3 bg-[var(--primary)]/5 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-[var(--primary)]/10 transition-colors">
                <span>Part B — Technical Discussion (Closing Step)</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.tech_discussion && "rotate-90")} />
              </button>
              {rgExpanded.tech_discussion && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Discussion Date" required>
                    <Input type="date" value={rgForm.techDiscussionDate || ""} onChange={(e) => setRgForm({ ...rgForm, techDiscussionDate: e.target.value })} />
                  </FormField>
                  <FormField label="Attendees" required>
                    <Input value={rgForm.techDiscussionAttendees || ""} onChange={(e) => setRgForm({ ...rgForm, techDiscussionAttendees: e.target.value })} placeholder="Names of participants" />
                  </FormField>
                  <FormField label="Technical Questions Raised" className="md:col-span-2">
                    <Textarea rows={3} value={rgForm.techDiscussionQuestions || ""} onChange={(e) => setRgForm({ ...rgForm, techDiscussionQuestions: e.target.value })} placeholder="Key technical questions and concerns discussed..." />
                  </FormField>
                  <FormField label="Requirements technically confirmed?" required className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rgForm.techDiscussionConfirmed || false}
                        onChange={(e) => setRgForm({ ...rgForm, techDiscussionConfirmed: e.target.checked })}
                        className="w-5 h-5 rounded border-2 border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        I confirm that requirements have been technically validated with the customer
                      </span>
                    </label>
                  </FormField>
                </div>
              )}
            </div>

            {/* Commercial Information */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("commercial_info")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Commercial Information</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.commercial_info && "rotate-90")} />
              </button>
              {rgExpanded.commercial_info && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Budget Range" required error={rgAttempted && !rgForm.budgetRange ? "This field is required" : ""}><Input value={rgForm.budgetRange || ""} onChange={(e) => setRgForm({ ...rgForm, budgetRange: e.target.value })} className={cn(rgAttempted && !rgForm.budgetRange && "border-rose-500")} /></FormField>
                  <FormField label="Expected Budget" required error={rgAttempted && !rgForm.expectedBudget ? "This field is required" : ""}><Input type="number" value={rgForm.expectedBudget || ""} onChange={(e) => setRgForm({ ...rgForm, expectedBudget: e.target.value })} className={cn(rgAttempted && !rgForm.expectedBudget && "border-rose-500")} /></FormField>
                  <FormField label="Final Discussed Budget"><Input type="number" value={rgForm.finalDiscussedBudget || ""} onChange={(e) => setRgForm({ ...rgForm, finalDiscussedBudget: e.target.value })} /></FormField>
                  <FormField label="Pricing Model">
                    <Select value={rgForm.pricingModel || ""} onChange={(e) => setRgForm({ ...rgForm, pricingModel: e.target.value })}>
                      <option value="">Select...</option>
                      <option value="Subscription">Subscription</option>
                      <option value="One-time">One-time</option>
                      <option value="Usage-based">Usage-based</option>
                    </Select>
                  </FormField>
                  <FormField label="License Count"><Input type="number" value={rgForm.licenseCount || ""} onChange={(e) => setRgForm({ ...rgForm, licenseCount: e.target.value })} /></FormField>
                  <FormField label="Payment Terms"><Input value={rgForm.paymentTerms || ""} onChange={(e) => setRgForm({ ...rgForm, paymentTerms: e.target.value })} /></FormField>
                  <FormField label="Billing Cycle">
                    <Select value={rgForm.billingCycle || ""} onChange={(e) => setRgForm({ ...rgForm, billingCycle: e.target.value })}>
                      <option value="">Select...</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annual">Annual</option>
                    </Select>
                  </FormField>
                  <FormField label="Timeline"><Input value={rgForm.timeline || ""} onChange={(e) => setRgForm({ ...rgForm, timeline: e.target.value })} /></FormField>
                  <FormField label="Procurement Process"><Textarea rows={2} value={rgForm.procurementProcess || ""} onChange={(e) => setRgForm({ ...rgForm, procurementProcess: e.target.value })} /></FormField>
                  <FormField label="Expected Go-Live Date"><Input type="date" value={rgForm.expectedGoLive || ""} onChange={(e) => setRgForm({ ...rgForm, expectedGoLive: e.target.value })} /></FormField>
                  <FormField label="Current Vendor"><Input value={rgForm.currentVendor || ""} onChange={(e) => setRgForm({ ...rgForm, currentVendor: e.target.value })} /></FormField>
                  <FormField label="Competitors Evaluated"><Textarea rows={2} value={rgForm.competitorsEvaluated || ""} onChange={(e) => setRgForm({ ...rgForm, competitorsEvaluated: e.target.value })} /></FormField>
                  <FormField label="Competitor Info"><Textarea rows={2} value={rgForm.competitorInfo || ""} onChange={(e) => setRgForm({ ...rgForm, competitorInfo: e.target.value })} /></FormField>
                  <FormField label="Commercial Risks"><Textarea rows={2} value={rgForm.commercialRisks || ""} onChange={(e) => setRgForm({ ...rgForm, commercialRisks: e.target.value })} /></FormField>
                  <FormField label="Discount Requested"><Input type="number" value={rgForm.discountRequested || ""} onChange={(e) => setRgForm({ ...rgForm, discountRequested: e.target.value })} /></FormField>
                  <FormField label="Proposal Value"><Input type="number" value={rgForm.proposalValue || ""} onChange={(e) => setRgForm({ ...rgForm, proposalValue: e.target.value })} /></FormField>
                  <FormField label="Negotiation Notes"><Textarea rows={2} value={rgForm.negotiationNotes || ""} onChange={(e) => setRgForm({ ...rgForm, negotiationNotes: e.target.value })} /></FormField>
                  <FormField label="Decision Maker" required error={rgAttempted && !rgForm.decisionMaker ? "This field is required" : ""}><Input value={rgForm.decisionMaker || ""} onChange={(e) => setRgForm({ ...rgForm, decisionMaker: e.target.value })} className={cn(rgAttempted && !rgForm.decisionMaker && "border-rose-500")} /></FormField>
                  <FormField label="Influencer"><Input value={rgForm.influencer || ""} onChange={(e) => setRgForm({ ...rgForm, influencer: e.target.value })} /></FormField>
                  <FormField label="Budget Owner"><Input value={rgForm.budgetOwner || ""} onChange={(e) => setRgForm({ ...rgForm, budgetOwner: e.target.value })} /></FormField>
                </div>
              )}
            </div>

            {/* Internal Notes */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("internal_notes")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Internal Notes</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.internal_notes && "rotate-90")} />
              </button>
              {rgExpanded.internal_notes && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Internal Sales Notes"><Textarea rows={3} value={rgForm.internalSalesNotes || ""} onChange={(e) => setRgForm({ ...rgForm, internalSalesNotes: e.target.value })} /></FormField>
                  <FormField label="Pre-Sales Notes"><Textarea rows={3} value={rgForm.presalesNotes || ""} onChange={(e) => setRgForm({ ...rgForm, presalesNotes: e.target.value })} /></FormField>
                  <FormField label="Objections"><Textarea rows={2} value={rgForm.objections || ""} onChange={(e) => setRgForm({ ...rgForm, objections: e.target.value })} /></FormField>
                  <FormField label="Follow-Up Summary"><Textarea rows={2} value={rgForm.followUpSummary || ""} onChange={(e) => setRgForm({ ...rgForm, followUpSummary: e.target.value })} /></FormField>
                  <FormField label="Risks & Blockers"><Textarea rows={2} value={rgForm.risksBlockers || ""} onChange={(e) => setRgForm({ ...rgForm, risksBlockers: e.target.value })} /></FormField>
                  <FormField label="Next Steps"><Textarea rows={2} value={rgForm.nextSteps || ""} onChange={(e) => setRgForm({ ...rgForm, nextSteps: e.target.value })} /></FormField>
                  <FormField label="Management Notes"><Textarea rows={2} value={rgForm.managementNotes || ""} onChange={(e) => setRgForm({ ...rgForm, managementNotes: e.target.value })} /></FormField>
                </div>
              )}
            </div>
          </div>
        )}

        {(effectiveStage === "MeetingScheduled" || effectiveStage === "DemoConducted") && (
          <div className="space-y-6">
            {/* Required fields for stage transition */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)]">Required for Stage Transition</div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Meeting/Demo Type">
                  <Select value={rgForm.meetingType || ""} onChange={(e) => setRgForm({ ...rgForm, meetingType: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Discovery Call">Discovery Call</option>
                    <option value="Product Demo">Product Demo</option>
                    <option value="Technical Discussion">Technical Discussion</option>
                    <option value="Site Visit">Site Visit</option>
                    <option value="Solution Review">Solution Review</option>
                  </Select>
                </FormField>
                <FormField label="Meeting/Demo Date" required>
                  <Input type="date" value={rgForm.meetingDate || ""} onChange={(e) => setRgForm({ ...rgForm, meetingDate: e.target.value })} />
                  {rgForm.meetingDate && (
                    <span className="text-xs text-slate-500 mt-1 block">
                      {(() => {
                        const d = new Date(rgForm.meetingDate);
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (diff === 0) return "📅 Today";
                        if (diff === 1) return "📅 Tomorrow";
                        if (diff > 1) return `📅 In ${diff} days`;
                        if (diff === -1) return "📅 Yesterday";
                        return `📅 ${Math.abs(diff)} days ago`;
                      })()}
                    </span>
                  )}
                </FormField>
                <FormField label="Meeting Mode">
                  <Select value={rgForm.meetingMode || ""} onChange={(e) => setRgForm({ ...rgForm, meetingMode: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Customer site visit">Customer site visit</option>
                    <option value="Direct visit">Direct visit</option>
                    <option value="Call">Call</option>
                  </Select>
                </FormField>
                <FormField label="Assigned Rep">
                  <Input value={deal.assignedUserName || rgForm.assignedRep || ""} onChange={(e) => setRgForm({ ...rgForm, assignedRep: e.target.value })} placeholder="Auto-assigned" />
                </FormField>
                <FormField label="Outcome / Status">
                  <Select value={rgForm.meetingStatus || ""} onChange={(e) => setRgForm({ ...rgForm, meetingStatus: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Held">Held — mark meeting as conducted</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Rescheduled">Rescheduled</option>
                  </Select>
                </FormField>
                <FormField label="Next Follow-up Date"><Input type="date" value={rgForm.nextFollowUpDate || ""} onChange={(e) => setRgForm({ ...rgForm, nextFollowUpDate: e.target.value })} /></FormField>
                <FormField label="Demo Follow-up Date (if follow-up needed)">
                  <Input type="date" value={rgForm.demoFollowUpDate || ""} onChange={(e) => setRgForm({ ...rgForm, demoFollowUpDate: e.target.value })} />
                </FormField>
              </div>
            </div>

            {/* Optional additional details - expandable */}
            <details className="border border-slate-200 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between">
                <span>Additional Demo Details (Optional)</span>
                <ChevronRight size={16} className="transform group-open:rotate-90 transition-transform" />
              </summary>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200">
                <FormField label="Meeting Mode">
                  <Select value={rgForm.meetingMode || ""} onChange={(e) => setRgForm({ ...rgForm, meetingMode: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="In-person">In-person</option>
                    <option value="Video Call">Video Call</option>
                    <option value="Phone Call">Phone Call</option>
                  </Select>
                </FormField>
                <FormField label="Duration (minutes)"><Input type="number" value={rgForm.meetingDuration || ""} onChange={(e) => setRgForm({ ...rgForm, meetingDuration: e.target.value })} /></FormField>
                <FormField label="Location"><Input value={rgForm.meetingLocation || ""} onChange={(e) => setRgForm({ ...rgForm, meetingLocation: e.target.value })} /></FormField>
                <FormField label="Participants"><Input value={rgForm.meetingParticipants || ""} onChange={(e) => setRgForm({ ...rgForm, meetingParticipants: e.target.value })} /></FormField>
                <FormField label="Agenda"><Textarea rows={2} value={rgForm.meetingAgenda || ""} onChange={(e) => setRgForm({ ...rgForm, meetingAgenda: e.target.value })} /></FormField>
                <FormField label="Outcome Notes" className="md:col-span-2"><Textarea rows={3} value={rgForm.meetingOutcome || ""} onChange={(e) => setRgForm({ ...rgForm, meetingOutcome: e.target.value })} /></FormField>
                
                <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                  <div className="text-xs font-semibold text-slate-500 mb-3">Demo-Specific Details</div>
                </div>
                <FormField label="Demo Type"><Input value={rgForm.demoType || ""} onChange={(e) => setRgForm({ ...rgForm, demoType: e.target.value })} /></FormField>
                <FormField label="Demo Date"><Input type="date" value={rgForm.demoDate || ""} onChange={(e) => setRgForm({ ...rgForm, demoDate: e.target.value })} /></FormField>
                <FormField label="Presenter"><Input value={rgForm.demoPresenter || ""} onChange={(e) => setRgForm({ ...rgForm, demoPresenter: e.target.value })} /></FormField>
                <FormField label="Duration (minutes)"><Input type="number" value={rgForm.demoDuration || ""} onChange={(e) => setRgForm({ ...rgForm, demoDuration: e.target.value })} /></FormField>
                <FormField label="Attendees"><Input value={rgForm.demoAttendees || ""} onChange={(e) => setRgForm({ ...rgForm, demoAttendees: e.target.value })} /></FormField>
                <FormField label="Customer Rating">
                  <Select value={rgForm.demoCustomerRating || ""} onChange={(e) => setRgForm({ ...rgForm, demoCustomerRating: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="1">1 - Poor</option>
                    <option value="2">2 - Fair</option>
                    <option value="3">3 - Good</option>
                    <option value="4">4 - Very Good</option>
                    <option value="5">5 - Excellent</option>
                  </Select>
                </FormField>
                <FormField label="Interest Level">
                  <Select value={rgForm.demoInterestLevel || ""} onChange={(e) => setRgForm({ ...rgForm, demoInterestLevel: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </Select>
                </FormField>
                <FormField label="Questions Raised"><Textarea rows={2} value={rgForm.demoQuestionsRaised || ""} onChange={(e) => setRgForm({ ...rgForm, demoQuestionsRaised: e.target.value })} /></FormField>
              </div>
            </details>

            {/* Demo Outcome Banner — shown when DemoConducted stage is active or being reviewed */}
            {effectiveStage === "DemoConducted" && deal.demoOutcome && (
              <div className={cn(
                "rounded-xl p-4 flex items-center gap-3",
                deal.demoOutcome === "Accepted" ? "bg-green-50 border border-green-200" :
                deal.demoOutcome === "Follow-up needed" ? "bg-amber-50 border border-amber-200" :
                "bg-orange-50 border border-orange-200"
              )}>
                {deal.demoOutcome === "Accepted" ? (
                  <CheckCircle size={20} className="text-green-600 shrink-0" />
                ) : deal.demoOutcome === "Follow-up needed" ? (
                  <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                ) : (
                  <XCircle size={20} className="text-orange-600 shrink-0" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-bold",
                    deal.demoOutcome === "Accepted" ? "text-green-800" :
                    deal.demoOutcome === "Follow-up needed" ? "text-amber-800" :
                    "text-orange-800"
                  )}>
                    Demo {deal.demoOutcome}
                  </p>
                  <p className={cn(
                    "text-xs mt-0.5",
                    deal.demoOutcome === "Accepted" ? "text-green-600" :
                    deal.demoOutcome === "Follow-up needed" ? "text-amber-600" :
                    "text-orange-600"
                  )}>
                    {deal.demoOutcome === "Accepted"
                      ? "RFQ has been auto-created. The opportunity will proceed to RFQ → Quotation → Negotiation → Deal Won in the Deals module."
                      : deal.demoOutcome === "Follow-up needed"
                      ? `Follow-up pending${deal.demoFollowUpDate ? ` on ${new Date(deal.demoFollowUpDate).toLocaleDateString("en-IN")}` : ""}. Card stays here until the follow-up date.`
                      : "The customer rejected the demo. Opportunity has been moved to Rejected terminal stage."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {effectiveStage === "ProposalSent" && (
          <div className="space-y-4">
            <ProposalQuotationGuide
              opportunityId={id}
              linkedQuotations={linkedQuotations}
              loading={linkedQuotationsLoading}
              formatCurrency={formatCurrency}
              onRefresh={fetchLinkedQuotations}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Proposed Solution" className="md:col-span-2"><Textarea rows={4} value={rgForm.proposedSolution || ""} onChange={(e) => setRgForm({ ...rgForm, proposedSolution: e.target.value })} /></FormField>
              <FormField label="Scope Classification"><Input value={rgForm.scopeClassification || ""} onChange={(e) => setRgForm({ ...rgForm, scopeClassification: e.target.value })} /></FormField>
              <FormField label="Estimated Duration"><Input value={rgForm.estimatedDuration || ""} onChange={(e) => setRgForm({ ...rgForm, estimatedDuration: e.target.value })} /></FormField>
              <FormField label="Development Effort"><Input value={rgForm.developmentEffort || ""} onChange={(e) => setRgForm({ ...rgForm, developmentEffort: e.target.value })} /></FormField>
              <FormField label="Implementation Effort"><Input value={rgForm.implementationEffort || ""} onChange={(e) => setRgForm({ ...rgForm, implementationEffort: e.target.value })} /></FormField>
              <FormField label="Support Requirements" className="md:col-span-2"><Textarea rows={3} value={rgForm.supportRequirements || ""} onChange={(e) => setRgForm({ ...rgForm, supportRequirements: e.target.value })} /></FormField>
            </div>
          </div>
        )}

        {effectiveStage === "Negotiation" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Final Discussed Budget"><Input type="number" value={rgForm.finalDiscussedBudget || ""} onChange={(e) => setRgForm({ ...rgForm, finalDiscussedBudget: e.target.value })} /></FormField>
            <FormField label="Pricing Model">
              <Select value={rgForm.pricingModel || ""} onChange={(e) => setRgForm({ ...rgForm, pricingModel: e.target.value })}>
                <option value="">Select...</option>
                <option value="Subscription">Subscription</option>
                <option value="One-time">One-time</option>
                <option value="Usage-based">Usage-based</option>
              </Select>
            </FormField>
            <FormField label="License Count"><Input type="number" value={rgForm.licenseCount || ""} onChange={(e) => setRgForm({ ...rgForm, licenseCount: e.target.value })} /></FormField>
            <FormField label="Payment Terms"><Input value={rgForm.paymentTerms || ""} onChange={(e) => setRgForm({ ...rgForm, paymentTerms: e.target.value })} /></FormField>
            <FormField label="Billing Cycle">
              <Select value={rgForm.billingCycle || ""} onChange={(e) => setRgForm({ ...rgForm, billingCycle: e.target.value })}>
                <option value="">Select...</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </Select>
            </FormField>
            <FormField label="Competitor Info"><Input value={rgForm.competitorInfo || ""} onChange={(e) => setRgForm({ ...rgForm, competitorInfo: e.target.value })} /></FormField>
            <FormField label="Commercial Risks"><Textarea rows={2} value={rgForm.commercialRisks || ""} onChange={(e) => setRgForm({ ...rgForm, commercialRisks: e.target.value })} /></FormField>
            <FormField label="Discount Requested"><Input type="number" value={rgForm.discountRequested || ""} onChange={(e) => setRgForm({ ...rgForm, discountRequested: e.target.value })} /></FormField>
            <FormField label="Proposal Value"><Input type="number" value={rgForm.proposalValue || ""} onChange={(e) => setRgForm({ ...rgForm, proposalValue: e.target.value })} /></FormField>
            <FormField label="Negotiation Notes" className="md:col-span-2"><Textarea rows={4} value={rgForm.negotiationNotes || ""} onChange={(e) => setRgForm({ ...rgForm, negotiationNotes: e.target.value })} /></FormField>
          </div>
        )}

        {(effectiveStage === "Won" || effectiveStage === "Lost") && (
          <div className="text-sm text-slate-600">
            <p>This opportunity is closed as <strong>{effectiveStage}</strong>. Details are read-only.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-500">Deal Value</span><p className="font-bold text-slate-800">{formatCurrency(deal.dealValue)}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-500">Customer</span><p className="font-bold text-slate-800">{deal.customer?.name}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-500">Expected Close</span><p className="font-bold text-slate-800">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-500">Assigned To</span><p className="font-bold text-slate-800">{deal.assignedUser?.name || "Unassigned"}</p></div>
            </div>
          </div>
        )}

        {canEditOpportunity(user, deal) && (
          <div className="pt-6 border-t border-slate-100 mt-6">
            {(() => {
              if (isTerminalStage) {
                return (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveRG}
                      disabled={rgSaving}
                      style={{
                        background: "transparent",
                        border: "0.5px solid var(--border-default)",
                        color: "var(--text-secondary)",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        fontWeight: 500,
                      }}
                      className="text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {rgSaving ? "Saving..." : "Save Details"}
                    </button>
                  </div>
                );
              }

              if (isReviewingCompleted) {
                return (
                  <div className="flex items-center gap-3 justify-end">
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                      Editing completed stage — changes saved without moving stages
                    </span>
                    <button
                      onClick={handleSaveCompletedStage}
                      disabled={rgSaving}
                      style={{
                        background: "var(--brand-primary, var(--primary))",
                        color: "#fff",
                        padding: "10px 24px",
                        borderRadius: "8px",
                        fontWeight: 500,
                        border: "none",
                        transition: "background 0.15s",
                      }}
                      className="text-sm font-medium disabled:opacity-50"
                    >
                      {rgSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                );
              }

              const nextStage = getNextStageKey(deal.status);
              const stageRequired = STAGE_REQUIRED_FIELDS[deal.status] || [];
              const missing = stageRequired.filter((r) => {
                const val = (rgForm as any)[r.field];
                return !val || (typeof val === "string" && val.trim() === "");
              });
              const allMandatoryFilled = missing.length === 0;
              const isRg = effectiveStage === "RequirementGathering";
              const attemptedFlag = isRg ? rgAttempted : false;
              // V2: RG exit gate requires tech discussion confirmed
              const techGatePassed = !isRg || rgForm.techDiscussionConfirmed === true;
              const canAdvance = allMandatoryFilled && techGatePassed;

              return (
                <div className="flex flex-col items-end gap-3">
                  {attemptedFlag && missing.length > 0 && (
                    <p className="text-xs text-rose-500 font-medium">Please fill: {missing.map((m) => m.label).join(", ")}</p>
                  )}
                  {attemptedFlag && isRg && !techGatePassed && (
                    <p className="text-xs text-rose-500 font-medium">Please confirm technical discussion in Part B to proceed</p>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveRG}
                      disabled={rgSaving || stageMoving}
                      style={{
                        background: "transparent",
                        border: "0.5px solid var(--border-default)",
                        color: "var(--text-secondary)",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        fontWeight: 500,
                      }}
                      className="text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {rgSaving ? "Saving..." : "Save Details"}
                    </button>
                    {nextStage && nextStage === "DemoConducted" && (
                      <>
                        <button
                          onClick={() => {
                            if (isRg) setRgAttempted(true);
                            if (canAdvance) handleSaveAndMove(nextStage, { demoOutcome: "Accepted" });
                          }}
                          disabled={!canAdvance || stageMoving}
                          style={{
                            background: canAdvance ? "#16A34A" : "var(--color-background-secondary, #e2e8f0)",
                            color: canAdvance ? "#fff" : "var(--text-tertiary, #64748b)",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            fontWeight: 500,
                            cursor: allMandatoryFilled ? "pointer" : "not-allowed",
                            border: "none",
                            transition: "background 0.15s",
                          }}
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          {stageMoving ? "Moving..." : <><CheckCircle size={16} /> Demo Accepted →</>}
                        </button>
                        <button
                          onClick={() => {
                            if (isRg) setRgAttempted(true);
                            if (canAdvance) {
                              if (!rgForm.demoFollowUpDate) {
                                toast.error("Please set a follow-up date in the demo details above");
                                return;
                              }
                              handleSaveAndMove(nextStage, { demoOutcome: "Follow-up needed" });
                            }
                          }}
                          disabled={!canAdvance || stageMoving}
                          style={{
                            background: canAdvance ? "#F59E0B" : "var(--color-background-secondary, #e2e8f0)",
                            color: canAdvance ? "#fff" : "var(--text-tertiary, #64748b)",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            fontWeight: 500,
                            cursor: canAdvance ? "pointer" : "not-allowed",
                            border: "none",
                            transition: "background 0.15s",
                          }}
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          {stageMoving ? "Moving..." : <><AlertTriangle size={16} /> Follow-up Needed →</>}
                        </button>
                        <button
                          onClick={() => {
                            if (isRg) setRgAttempted(true);
                            if (canAdvance) handleSaveAndMove(nextStage, { demoOutcome: "Rejected" });
                          }}
                          disabled={!canAdvance || stageMoving}
                          style={{
                            background: canAdvance ? "#EA580C" : "var(--color-background-secondary, #e2e8f0)",
                            color: canAdvance ? "#fff" : "var(--text-tertiary, #64748b)",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            fontWeight: 500,
                            cursor: allMandatoryFilled ? "pointer" : "not-allowed",
                            border: "none",
                            transition: "background 0.15s",
                          }}
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          {stageMoving ? "Moving..." : <><XCircle size={16} /> Demo Rejected →</>}
                        </button>
                      </>
                    )}
                    {nextStage && nextStage !== "DemoConducted" && (
                      <button
                        onClick={() => {
                          if (isRg) setRgAttempted(true);
                          if (canAdvance) handleSaveAndMove(nextStage);
                        }}
                        disabled={!canAdvance || stageMoving}
                        style={{
                          background: canAdvance ? "var(--brand-primary, var(--primary))" : "var(--color-background-secondary, #e2e8f0)",
                          color: canAdvance ? "#fff" : "var(--text-tertiary, #64748b)",
                          padding: "10px 24px",
                          borderRadius: "8px",
                          fontWeight: 500,
                          cursor: allMandatoryFilled ? "pointer" : "not-allowed",
                          border: "none",
                          transition: "background 0.15s",
                        }}
                        className="text-sm font-medium flex items-center gap-2"
                      >
                        {stageMoving ? "Moving..." : <>Save & Move to Next Stage →</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // ─── Read-Only Completed Requirement Gathering ───────────────────────────────

  const renderReadOnlyRequirementGathering = () => {
    const currentOrder = PIPELINE_STAGES.find((s) => s.key === deal.status)?.order ?? 0;
    const rgOrder = PIPELINE_STAGES.find((s) => s.key === "RequirementGathering")?.order ?? 0;
    if (currentOrder <= rgOrder) return null;

    const ReadOnlyField = ({ label, value }: { label: string; value?: string | number | null }) => (
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 min-h-[38px]">{value || <span className="text-slate-300 italic">—</span>}</p>
      </div>
    );

    return (
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Completed Requirement Gathering</h3>
        </div>

        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Customer Details</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ReadOnlyField label="Company Name" value={rgForm.companyName} />
              <ReadOnlyField label="Industry" value={rgForm.industry} />
              <ReadOnlyField label="Contact Person" value={rgForm.contactPerson} />
              <ReadOnlyField label="Email" value={rgForm.email} />
              <ReadOnlyField label="Phone" value={rgForm.phone} />
              <ReadOnlyField label="Employee Count" value={rgForm.employeeCount} />
              <ReadOnlyField label="Approval Process" value={rgForm.approvalProcess} />
              <ReadOnlyField label="Buying Authority Notes" value={rgForm.buyingAuthorityNotes} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Business Requirements</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadOnlyField label="Current Challenges" value={rgForm.currentChallenges} />
              <ReadOnlyField label="Pain Points" value={rgForm.painPoints} />
              <ReadOnlyField label="Business Need" value={rgForm.businessNeed} />
              <ReadOnlyField label="Expected Outcome" value={rgForm.expectedOutcome} />
              <ReadOnlyField label="Required Departments" value={rgForm.requiredDepartments} />
              <ReadOnlyField label="Number of Users" value={rgForm.numberOfUsers} />
              <ReadOnlyField label="Urgency / Priority" value={rgForm.urgencyPriority} />
              <ReadOnlyField label="Business Goals" value={rgForm.businessGoals} />
              <ReadOnlyField label="Success Criteria" value={rgForm.successCriteria} />
              <ReadOnlyField label="Modules Required" value={rgForm.modulesRequired} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Technical Requirements</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadOnlyField label="Deployment Type" value={rgForm.deploymentType} />
              <ReadOnlyField label="Integrations Required" value={rgForm.integrationsRequired} />
              <ReadOnlyField label="Existing Software Stack" value={rgForm.existingSoftwareStack} />
              <ReadOnlyField label="Security & Compliance" value={rgForm.securityCompliance} />
              <ReadOnlyField label="User Roles & Permissions" value={rgForm.userRolesPermissions} />
              <ReadOnlyField label="Reporting Requirements" value={rgForm.reportingRequirements} />
              <ReadOnlyField label="Data Migration Required" value={rgForm.dataMigrationRequired} />
              <ReadOnlyField label="Customization Needed" value={rgForm.customizationNeeded} />
              <ReadOnlyField label="API / Third-Party Reqs" value={rgForm.apiThirdPartyReqs} />
              <ReadOnlyField label="Technical Constraints" value={rgForm.technicalConstraints} />
              <ReadOnlyField label="IT Team Notes" value={rgForm.itTeamNotes} />
              <ReadOnlyField label="User Count — Sales" value={rgForm.userCountSales} />
              <ReadOnlyField label="User Count — Managers" value={rgForm.userCountManagers} />
              <ReadOnlyField label="User Count — Admins" value={rgForm.userCountAdmins} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Commercial Information</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ReadOnlyField label="Budget Range" value={rgForm.budgetRange} />
              <ReadOnlyField label="Expected Budget" value={rgForm.expectedBudget} />
              <ReadOnlyField label="Final Discussed Budget" value={rgForm.finalDiscussedBudget} />
              <ReadOnlyField label="Pricing Model" value={rgForm.pricingModel} />
              <ReadOnlyField label="License Count" value={rgForm.licenseCount} />
              <ReadOnlyField label="Payment Terms" value={rgForm.paymentTerms} />
              <ReadOnlyField label="Billing Cycle" value={rgForm.billingCycle} />
              <ReadOnlyField label="Timeline" value={rgForm.timeline} />
              <ReadOnlyField label="Procurement Process" value={rgForm.procurementProcess} />
              <ReadOnlyField label="Expected Go-Live" value={rgForm.expectedGoLive} />
              <ReadOnlyField label="Current Vendor" value={rgForm.currentVendor} />
              <ReadOnlyField label="Competitors Evaluated" value={rgForm.competitorsEvaluated} />
              <ReadOnlyField label="Competitor Info" value={rgForm.competitorInfo} />
              <ReadOnlyField label="Commercial Risks" value={rgForm.commercialRisks} />
              <ReadOnlyField label="Discount Requested" value={rgForm.discountRequested} />
              <ReadOnlyField label="Proposal Value" value={rgForm.proposalValue} />
              <ReadOnlyField label="Negotiation Notes" value={rgForm.negotiationNotes} />
              <ReadOnlyField label="Decision Maker" value={rgForm.decisionMaker} />
              <ReadOnlyField label="Influencer" value={rgForm.influencer} />
              <ReadOnlyField label="Budget Owner" value={rgForm.budgetOwner} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Internal Notes</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadOnlyField label="Internal Sales Notes" value={rgForm.internalSalesNotes} />
              <ReadOnlyField label="Pre-Sales Notes" value={rgForm.presalesNotes} />
              <ReadOnlyField label="Objections" value={rgForm.objections} />
              <ReadOnlyField label="Follow-Up Summary" value={rgForm.followUpSummary} />
              <ReadOnlyField label="Risks & Blockers" value={rgForm.risksBlockers} />
              <ReadOnlyField label="Next Steps" value={rgForm.nextSteps} />
              <ReadOnlyField label="Management Notes" value={rgForm.managementNotes} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <AlertTriangle size={40} className="mb-3" />
        <p className="font-semibold">{fetchError || "Opportunity not found"}</p>
        <p className="text-xs text-slate-400 mt-1">Opportunity ID: {id}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => { setDeal(null); setFetchError(null); fetchDeal(); }} className="text-[var(--primary)] font-bold text-sm">
            ↻ Retry
          </button>
          <button onClick={() => router.push("/sales-pipeline")} className="text-slate-500 font-bold text-sm">
            ← Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === deal.status);
  const hasAcceptedQuotation = deal.quotations?.some((q: any) => q.status === "Accepted");
  const isTerminalStage = deal.status === "Won" || deal.status === "Lost" || deal.status === "Rejected";
  const isValidStage = currentStageIndex !== -1 || isTerminalStage;
  const progressPercent = isTerminalStage
    ? (deal.status === "Won" ? 100 : 0)
    : Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100);

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb ─── */}
      <button
        onClick={() => router.push("/sales-pipeline")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Pipeline
      </button>

      {/* ── Invalid Stage Error Banner ─── */}
      {!isValidStage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-800">Invalid Opportunity Stage</p>
            <p className="text-sm text-rose-700 mt-1">
              This opportunity has an invalid stage value: <code className="bg-rose-100 px-1.5 py-0.5 rounded">{deal.status}</code>.
              Valid stages are: Qualified, RequirementGathering, MeetingScheduled, DemoConducted, Rejected, Lost.
              Please contact support to correct this record.
            </p>
          </div>
        </div>
      )}

      {/* ─── Hero Summary Card ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[var(--primary)]/10 via-white to-slate-50 p-6 shadow-sm">
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-full border",
                deal.status === "Won" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                deal.status === "Lost" ? "bg-rose-100 text-rose-700 border-rose-200" :
                "bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/25"
              )}>
                {STAGE_LABELS[deal.status] || deal.status}
              </span>
              {deal.opportunityCode && (
                <span className="text-xs font-bold text-slate-500">{deal.opportunityCode}</span>
              )}
              {deal.isOverdue && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-full border border-rose-200 flex items-center gap-1">
                  <AlertTriangle size={11} /> Overdue
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{deal.dealName}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
              <span className="font-medium truncate">{deal.customer?.name}</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-[var(--primary)]">{formatCurrency(deal.dealValue)}</span>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2 min-w-[140px]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</span>
            <span className={cn(
              "text-3xl font-extrabold tabular-nums",
              deal.status === "Won" ? "text-emerald-600" : deal.status === "Lost" ? "text-rose-600" : "text-[var(--primary)]"
            )}>
              {deal.status === "Lost" ? "0%" : `${progressPercent}%`}
            </span>
            <div className="w-full lg:w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${deal.dealName}, ${progressPercent}% pipeline progress`}
                className={cn(
                  "h-full rounded-full transition-all duration-[350ms] ease-out",
                  deal.status === "Won" ? "bg-emerald-500" : deal.status === "Lost" ? "bg-rose-500" : "bg-[var(--primary)]"
                )}
                style={{ width: `${deal.status === "Lost" ? 0 : progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Primary actions */}
        <div className="relative flex items-center gap-2 mt-5 pt-4 border-t border-slate-200/60">
          {canEditOpportunity(user, deal) && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-[var(--primary)] text-white font-bold text-sm rounded-lg hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-1.5"
            >
              <Edit3 size={15} /> Edit Opportunity
            </button>
          )}
          {canAddFollowUp(user, deal) && (
            <button
              onClick={() => setShowFollowUpModal(true)}
              className="px-4 py-2 bg-white text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Calendar size={15} /> Add Follow-Up
            </button>
          )}
          {user?.role !== "Customer" && ["ProposalSent", "Negotiation"].includes(deal.status) && (
            <button
              onClick={() => router.push(`/rfq/new?opportunityId=${deal.id}`)}
              className="px-4 py-2 bg-white text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare size={15} /> Create RFQ
            </button>
          )}
          {user?.role !== "Customer" && ["ProposalSent", "Negotiation"].includes(deal.status) && (
            <button
              onClick={() => router.push(`/quotations/new?opportunityId=${deal.id}`)}
              className="px-4 py-2 bg-white text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <FileText size={15} /> Direct Quotation
            </button>
          )}
        </div>
      </div>

      {/* ─── Detailed Pipeline Stage Card ─── */}
      <div className="crm-card overflow-hidden">
        {/* Header + Stage-specific actions */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pipeline Actions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Stage-specific actions for {STAGE_LABELS[deal.status] || deal.status}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Terminal exit button — Mark Rejected only (Lost belongs to Negotiations module) */}
            {deal.status !== "Won" && deal.status !== "Lost" && deal.status !== "Rejected" && canChangeStage(user, deal) && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-orange-600 text-white font-bold text-sm rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-1.5"
              >
                <XCircle size={15} /> Mark Rejected
              </button>
            )}
          </div>
        </div>

        {/* Interactive Stage Stepper */}
        <div className="px-6 py-4 bg-slate-50/50">
          {/* Interactive pipeline stepper — completed and active stages are clickable for review/edit */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {PIPELINE_STAGES.map((stage, idx) => {
              const stepState = getStepState(stage.key, deal.status);
              const isTerminal = deal.status === "Lost" || deal.status === "Rejected";
              const isClickable = stepState === "completed" || stepState === "active";
              const tooltip = getStepTooltip(stage.key, stepState, STAGE_LABELS[deal.status] || deal.status);
              const isViewing = viewingStage === stage.key;
              return (
                <div key={stage.key} className="flex items-center shrink-0">
                  <div
                    onClick={() => isClickable && handleStepClick(stage.key, stepState)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors",
                      isClickable ? "cursor-pointer hover:bg-white/80" : "cursor-default",
                      stepState === "active" && "bg-white/50",
                      isViewing && "bg-[#EFF6FF]/80 ring-1 ring-[#93C5FD]"
                    )}
                    title={tooltip}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                        stepState === "completed" && "bg-[#16A34A] text-white border-[#16A34A]",
                        stepState === "active" && "bg-[var(--primary)] text-white border-[var(--primary)] ring-4 ring-[var(--primary)]/20",
                        stepState === "future" && "bg-white text-slate-300 border-slate-200",
                        isTerminal && (deal.status === "Rejected" ? "bg-orange-100 text-orange-400 border-orange-200" : "bg-rose-100 text-rose-400 border-rose-200")
                      )}
                    >
                      {stepState === "completed" ? <CheckCircle size={14} /> : idx + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold whitespace-nowrap",
                        stepState === "active" ? "text-[var(--primary)]" : stepState === "completed" ? "text-[#16A34A]" : isTerminal ? (deal.status === "Rejected" ? "text-orange-400" : "text-rose-400") : "text-slate-400"
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className={cn("w-8 h-0.5 mx-1", stepState === "completed" ? "bg-[#16A34A]" : "bg-slate-200")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {renderStageForm()}
      </div>

      {/* ─── Competitor Intelligence ─── */}
      <div className="crm-card p-5">
        <CompetitorIntelligenceTab entity={{ dealId: deal.id, customerId: deal.customerId, currentStage: deal.status }} />
      </div>

      {/* ─── Documents ─── */}
      <div className="crm-card p-5">
        <EntityDocumentTab entityType="Deal" entityId={deal.id} />
      </div>

      {/* ─── Stage History Timeline ─── */}
      {deal.stageHistories && deal.stageHistories.length > 0 && (
        <div className="crm-card p-5">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Stage History</h2>
          <div className="relative pl-4 space-y-6">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200" />
            {deal.stageHistories.map((history: any, idx: number) => (
              <div key={history.id} className="relative pl-6">
                <div className="absolute left-4 w-3 h-3 rounded-full border-2 border-slate-300 bg-white z-10" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      {STAGE_LABELS[history.toStatus] || history.toStatus}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(history.changedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Changed by {history.changedBy?.name || "System"}
                    {history.fromStatus && (
                      <span> from {STAGE_LABELS[history.fromStatus] || history.fromStatus}</span>
                    )}
                    {history.durationInPreviousStage !== null && (
                      <span> • {history.durationInPreviousStage} days in previous stage</span>
                    )}
                  </div>
                  {history.outcomeNotes && (
                    <div className="text-xs text-slate-500 italic">
                      Note: {history.outcomeNotes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ─── Mark Rejected Modal ─── */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Mark as Rejected"
        subtitle="Record rejection reason for this opportunity"
        size="md"
        footer={
          <>
            <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleMarkRejected} className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700">Mark Rejected</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <XCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Mark "{deal.dealName}" as Rejected?
              </p>
              <p className="text-xs text-slate-500 mt-1">
                The customer explicitly rejected the demo or proposal. This will exit the pipeline.
              </p>
            </div>
          </div>
          <FormField label="Rejection Reason" required>
            <Select
              value={rejectForm.rejectedReason}
              onChange={(e) => setRejectForm({ ...rejectForm, rejectedReason: e.target.value })}
            >
              <option value="">Select reason...</option>
              <option value="Price">Price</option>
              <option value="Timing">Timing</option>
              <option value="Competitor">Competitor</option>
              <option value="No budget">No budget</option>
              <option value="Requirements not met">Requirements not met</option>
              <option value="Other">Other</option>
            </Select>
          </FormField>
          <FormField label="Additional Notes">
            <Textarea
              rows={2}
              value={rejectForm.notes}
              onChange={(e) => setRejectForm({ ...rejectForm, notes: e.target.value })}
              placeholder="Any additional context..."
            />
          </FormField>
        </div>
      </Modal>

      {/* ─── Mark Lost Modal ─── */}
      <Modal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        title="Mark as Lost"
        subtitle="Record loss reason for this opportunity"
        footer={
          <>
            <button onClick={() => setShowLostModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleMarkLost} className="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-lg hover:bg-rose-700">Mark Lost</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Loss Reason" required>
            <Select value={lostForm.lost_reason_id} onChange={(e) => setLostForm({ ...lostForm, lost_reason_id: e.target.value })}>
              <option value="">Select reason...</option>
              {lossReasons.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Competitor (optional)">
            <Select value={lostForm.competitor_id} onChange={(e) => setLostForm({ ...lostForm, competitor_id: e.target.value })}>
              <option value="">None</option>
              {competitors.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Notes (optional)">
            <Textarea rows={3} value={lostForm.notes} onChange={(e) => setLostForm({ ...lostForm, notes: e.target.value })} />
          </FormField>
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
            All open follow-ups for this opportunity will be bulk-cancelled.
          </div>
        </div>
      </Modal>

      {/* ─── Add Stakeholder Modal ─── */}
      <Modal
        open={showStakeholderModal}
        onClose={() => setShowStakeholderModal(false)}
        title="Add Stakeholder"
        subtitle="Link a contact to this opportunity"
        footer={
          <>
            <button onClick={() => setShowStakeholderModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleAddStakeholder} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Add</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Contact" required>
            <Select value={stakeholderForm.contact_id} onChange={(e) => setStakeholderForm({ ...stakeholderForm, contact_id: e.target.value })}>
              <option value="">Select contact...</option>
              {allContacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.designation ? `(${c.designation})` : ""}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Stakeholder Role" required>
            <Select
              value={stakeholderForm.stakeholder_role}
              onChange={(e) => setStakeholderForm({ ...stakeholderForm, stakeholder_role: e.target.value })}
            >
              {STAKEHOLDER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={stakeholderForm.is_primary}
              onChange={(e) => setStakeholderForm({ ...stakeholderForm, is_primary: e.target.checked })}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            Set as Primary Stakeholder
          </label>
        </div>
      </Modal>

      {/* ─── Add Follow-Up Modal ─── */}
      <Modal
        open={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        title="Add Follow-Up"
        subtitle="Schedule a follow-up activity for this opportunity"
        footer={
          <>
            <button onClick={() => setShowFollowUpModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleCreateFollowUp} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)]">Create</button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Title">
            <Input value={followUpForm.title} onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })} placeholder="e.g. Call back customer" />
          </FormField>
          <FormField label="Due Date & Time" required>
            <Input type="datetime-local" value={followUpForm.nextMeetingDate} onChange={(e) => setFollowUpForm({ ...followUpForm, nextMeetingDate: e.target.value })} />
          </FormField>
          <FormField label="Priority">
            <Select value={followUpForm.priority} onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value })}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </Select>
          </FormField>
          <FormField label="Notes (optional)">
            <Textarea rows={3} value={followUpForm.notes} onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })} />
          </FormField>
        </div>
      </Modal>

      {/* ─── Edit Opportunity Modal ─── */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Opportunity"
        subtitle="Update deal details"
        footer={
          <>
            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
            {canEditOpportunity(user, deal) && (
              <button onClick={handleSaveOverview} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2">
                <Save size={15} /> Save Changes
              </button>
            )}
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Opportunity Name" required>
            <Input value={editForm.dealName || ""} onChange={(e) => setEditForm({ ...editForm, dealName: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormField label="Account">
              <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                {deal.customer?.name} ({deal.customer?.customerCode})
              </div>
            </FormField>
            <FormField label="Stage">
              <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                {STAGE_LABELS[deal.status] || deal.status}
              </div>
            </FormField>
            <FormField label="Estimated Value (₹)">
              <Input
                type="number"
                value={editForm.dealValue || 0}
                onChange={(e) => setEditForm({ ...editForm, dealValue: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Expected Close Date">
              <Input
                type="date"
                value={editForm.expectedCloseDate || ""}
                onChange={(e) => setEditForm({ ...editForm, expectedCloseDate: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Assigned To">
            <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
              {deal.assignedUser?.name || "Unassigned"}
            </div>
          </FormField>
          <FormField label="Probability (%)">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={editForm.probabilityPercent ?? deal.probabilityPercent}
                onChange={(e) => setEditForm({ ...editForm, probabilityPercent: parseInt(e.target.value) })}
                className="flex-1 accent-[var(--primary)]"
              />
              <span className="text-sm font-bold text-slate-700 w-12 text-right">
                {editForm.probabilityPercent ?? deal.probabilityPercent}%
              </span>
            </div>
          </FormField>
          <FormField label="Notes / Description">
            <Textarea
              rows={4}
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
