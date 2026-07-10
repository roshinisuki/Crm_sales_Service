"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { formatDate, cn } from "@/lib/ui-utils";
import {
  ArrowLeft, CheckCircle, XCircle,
  ChevronRight, Save, AlertTriangle, Calendar, CalendarClock, Clock,
  Edit3, FileText, MessageSquare, Zap, Swords, FolderOpen, Briefcase, History,
  Search, TrendingUp, User, Users,
} from "lucide-react";
import { CompetitorIntelligenceTab } from "@/components/competitor-intelligence/CompetitorIntelligenceTab";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { StageAccordion } from "@/components/pipeline/StageAccordion";
import { ProductRequirementTable, type RequirementItem } from "@/components/pipeline/ProductRequirementTable";
import { TechnicalFeasibilityTable, type TechNoteRow } from "@/components/pipeline/TechnicalFeasibilityTable";
import { StageAdvanceButton } from "@/components/pipeline/StageAdvanceButton";
import { RFQSummaryCard } from "@/components/pipeline/RFQSummaryCard";
import { generateStageSummary } from "@/components/pipeline/StageSummaryLine";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGE_VALUES } from "@/lib/module-status-config";
import { getUsersAction } from "@/app/actions/users";

const STAGE_DISPLAY_LABELS: Record<string, string> = {
  Qualified:            "Qualified",
  RequirementGathering: "Requirement gathering",
  TechnicalDiscussion:  "Technical discussion",
  MeetingScheduled:     "Meeting scheduled",
  DemoConducted:        "Demo conducted",
  Won:                  "Won",
  Rejected:             "Rejected",
  Lost:                 "Lost",
};

const STAGE_PILL: Record<string, string> = {
  Qualified:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50",
  RequirementGathering:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50",
  TechnicalDiscussion:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50",
  MeetingScheduled:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50",
  DemoConducted:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
  Lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
  Rejected:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/50",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
};

const STAGE_FILTERS = [
  { label: "All stages", value: "" },
  { label: "Qualified", value: "Qualified" },
  { label: "Req. gathering", value: "RequirementGathering" },
  { label: "Tech. discussion", value: "TechnicalDiscussion" },
  { label: "Meeting scheduled", value: "MeetingScheduled" },
  { label: "Demo conducted", value: "DemoConducted" },
  { label: "Rejected", value: "Rejected" },
  { label: "Lost", value: "Lost" },
];

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
  Qualified:            "Qualified",
  RequirementGathering: "Requirement gathering",
  TechnicalDiscussion:  "Technical discussion",
  MeetingScheduled:     "Meeting scheduled",
  DemoConducted:        "Demo conducted",
  ProposalSent:         "Proposal sent",
  Negotiation:          "Negotiation",
  Won:                  "Won",
  Lost:                 "Lost",
  Rejected:             "Rejected",
};

// Required fields per stage — must be saved before moving forward
// NOTE: deploymentType removed (SaaS-only). Product requirements gate handled by API.
const STAGE_REQUIRED_FIELDS: Record<string, { field: string; label: string }[]> = {
  RequirementGathering: [
    { field: "contactPerson", label: "Contact person" },
    { field: "email", label: "Email" },
    { field: "phone", label: "Phone" },
    { field: "currentChallenges", label: "Current challenges" },
    { field: "businessNeed", label: "Business need" },
    { field: "urgencyPriority", label: "Urgency / priority" },
    { field: "expectedBudget", label: "Expected budget" },
    { field: "decisionMaker", label: "Decision maker" },
  ],
  MeetingScheduled: [
    { field: "meetingDate", label: "Meeting / demo date" },
    { field: "meetingType", label: "Meeting / demo type" },
    { field: "meetingStatus", label: "Outcome / status" },
  ],
  DemoConducted: [
    { field: "demoDate", label: "Demo date" },
    { field: "demoType", label: "Demo type" },
    { field: "demoInterestLevel", label: "Interest level" },
  ],
  Rejected: [],
};

const RG_MANDATORY_FIELDS = [
  { key: "contactPerson", label: "Contact person", section: "Customer details" },
  { key: "email",         label: "Email",          section: "Customer details" },
  { key: "phone",         label: "Phone",          section: "Customer details" },
  { key: "currentChallenges", label: "Current challenges", section: "Business requirements" },
  { key: "businessNeed",  label: "Business need",  section: "Business requirements" },
  { key: "urgencyPriority", label: "Urgency / priority", section: "Business requirements" },
  { key: "expectedBudget", label: "Expected budget", section: "Commercial information" },
  { key: "decisionMaker", label: "Decision maker", section: "Commercial information" },
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
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s === stageKey);
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s === currentStage);
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
  const hasApprovedQuote = linkedQuotations.some((q: any) => q.status === "Approved");
  const hasPendingApprovalQuote = linkedQuotations.some((q: any) => q.status === "PendingApproval");
  const hasDraftQuote = linkedQuotations.some((q: any) => q.status === "Draft");
  const hasUnderReviewQuote = linkedQuotations.some((q: any) => q.status === "UnderReview");
  const hasExpiredQuote = linkedQuotations.some((q: any) => q.status === "Expired");

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
      if (data.success) {
        toast.success("Moved to negotiation");
        onRefresh();
        if (data.data?.negotiationId) {
          router.push(`/negotiations/${data.data.negotiationId}`);
        }
      } else {
        toast.error(data.message || "Failed to move to negotiation");
      }
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
    // (existing code below)
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

  // State C2 — Approved quotation (ready to send)
  if (hasApprovedQuote) {
    const q = linkedQuotations.find((q: any) => q.status === "Approved") || latestQuote;
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Quotation approved — ready to send to customer</p>
              <p className="text-xs text-emerald-600">
                {q.quotationCode} • Final value: {formatCurrency(q.finalAmount || q.totalAmount)}
                {q.overallMarginPercent != null && <> • Margin: {Number(q.overallMarginPercent).toFixed(1)}%</>}
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
              onClick={() => handleSendQuote(q.id)}
              disabled={sending}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send to Customer"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State C1 — Pending approval quotation
  if (hasPendingApprovalQuote) {
    const q = linkedQuotations.find((q: any) => q.status === "PendingApproval") || latestQuote;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Quotation pending manager approval</p>
              <p className="text-xs text-amber-600">
                {q.quotationCode} • Final value: {formatCurrency(q.finalAmount || q.totalAmount)}
                {q.overallMarginPercent != null && <> • Margin: {Number(q.overallMarginPercent).toFixed(1)}%</>}
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
          </div>
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
                {q.quotationCode} • {formatCurrency(q.finalAmount || q.totalAmount)}
                {q.overallMarginPercent != null && <> • Margin: {Number(q.overallMarginPercent).toFixed(1)}%</>}
                • Valid until {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-IN") : "—"}
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
                {q.overallMarginPercent != null && <> • Margin: {Number(q.overallMarginPercent).toFixed(1)}%</>}
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
  const [oppSearch, setOppSearch] = useState("");
  const [oppStageFilter, setOppStageFilter] = useState("");
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
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
  const [rgExpanded, setRgExpanded] = useState<Record<string, boolean>>({ customer_info: true, business_req: false, commercial_info: false, internal_notes: false });
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
  const [users, setUsers] = useState<any[]>([]);
  // Demo outcome form state (MeetingScheduled -> DemoConducted transition)
  const [demoOutcomeChoice, setDemoOutcomeChoice] = useState<"Accepted" | "Follow-up needed" | "Rejected" | "">("");
  const [demoNotes, setDemoNotes] = useState("");
  const [demoFollowUpDate, setDemoFollowUpDate] = useState("");
  const [demoRejectionReason, setDemoRejectionReason] = useState("");
  const [demoRejectionRemarks, setDemoRejectionRemarks] = useState("");
  // V5: Manufacturing pipeline — product requirement items
  const [requirementItems, setRequirementItems] = useState<RequirementItem[]>([]);
  const [tdRows, setTdRows] = useState<TechNoteRow[]>([]);
  const [tdForm, setTdForm] = useState({ tdDiscussionDate: "", tdAttendees: "", tdEngineerId: "" });
  // V5: lead-verified flag (Qualified stage)
  const [leadVerified, setLeadVerified] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    setOppsLoading(true);
    try {
      const params = new URLSearchParams();
      if (oppSearch) params.set("search", oppSearch);
      if (oppStageFilter) params.set("stage", oppStageFilter);
      const res = await fetch(`/api/opportunities?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data || []);
      }
    } catch {
      // silent
    } finally {
      setOppsLoading(false);
    }
  }, [oppSearch, oppStageFilter]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

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
        fetchOpportunities();
      setEditForm({
        dealName: json.data.dealName,
        dealValue: json.data.dealValue,
        expectedCloseDate: json.data.expectedCloseDate?.split("T")[0],
        probabilityPercent: json.data.probabilityPercent,
        notes: json.data.notes || "",
        assignedUserId: json.data.assignedUserId || "",
      });
      // Initialize RG form from opportunityDetail, auto-filling from customer/contact/lead
      const d = json.data.opportunityDetail || {};
      const cust = json.data.customer || {};
      const lead = json.data.lead || null;
      const primaryContact = json.data.opportunityContacts?.find((oc: any) => oc.isPrimary)?.contact
        || json.data.opportunityContacts?.[0]?.contact
        || null;

      // Auto-fill priority: opportunityDetail (saved) > lead (originating) > customer (master)
      const autoFill = (detailVal: any, leadVal: any, custVal: any) => {
        if (detailVal !== null && detailVal !== undefined && String(detailVal).trim() !== "") return detailVal;
        if (leadVal !== null && leadVal !== undefined && String(leadVal).trim() !== "") return leadVal;
        if (custVal !== null && custVal !== undefined && String(custVal).trim() !== "") return custVal;
        return "";
      };

      setRgForm({
        // Customer details — auto-fill from lead/customer/contact
        companyName:      autoFill(d.companyName, lead?.companyName || lead?.name, cust.name),
        industry:         autoFill(d.industry, lead?.industryType, cust.industryType),
        contactPerson:    autoFill(d.contactPerson, lead?.name, primaryContact?.name),
        email:            autoFill(d.email, lead?.email, cust.email || primaryContact?.email),
        phone:            autoFill(d.phone, lead?.phone, cust.phone || primaryContact?.phone),
        employeeCount:    d.employeeCount || "",
        approvalProcess:  d.approvalProcess || "",
        buyingAuthorityNotes: d.buyingAuthorityNotes || "",
        // Business requirements (manufacturing-relevant)
        currentChallenges: d.currentChallenges || "",
        businessNeed:     autoFill(d.businessNeed, lead?.notes, ""),
        urgencyPriority:  d.urgencyPriority || "",
        expectedOutcome:  d.expectedOutcome || "",
        currentVendor:    d.currentVendor || "",
        competitorsEvaluated: d.competitorsEvaluated || "",
        // Commercial information — auto-fill budget/timeline from lead
        budgetRange:      autoFill(d.budgetRange, lead?.budgetAsked, ""),
        timeline:         autoFill(d.timeline, lead?.timelineAsked, ""),
        expectedBudget:   d.expectedBudget || (lead?.estimatedValue ? String(lead.estimatedValue) : ""),
        finalDiscussedBudget: d.finalDiscussedBudget || "",
        procurementProcess: d.procurementProcess || "",
        decisionMaker:    autoFill(d.decisionMaker, lead?.name, primaryContact?.name),
        influencer:       d.influencer || "",
        budgetOwner:      d.budgetOwner || "",
        expectedGoLive:   d.expectedGoLive ? d.expectedGoLive.split("T")[0] : "",
        paymentTerms:     d.paymentTerms || "",
        competitorInfo:   d.competitorInfo || "",
        // Internal notes (consolidated)
        additionalNotes:  d.additionalNotes || d.internalSalesNotes || "",
        internalSalesNotes: d.internalSalesNotes || "",
        // Meeting Scheduled
        meetingType:      d.meetingType || "",
        meetingMode:      d.meetingMode || "",
        meetingDate:      d.meetingDate ? d.meetingDate.split("T")[0] : "",
        meetingStatus:    d.meetingStatus || "",
        meetingDuration:  d.meetingDuration || "",
        meetingParticipants: d.meetingParticipants || "",
        meetingLocation:  d.meetingLocation || "",
        meetingAgenda:    d.meetingAgenda || "",
        meetingOutcome:   d.meetingOutcome || "",
        nextFollowUpDate: d.nextFollowUpDate ? d.nextFollowUpDate.split("T")[0] : "",
        // Demo Conducted
        demoType:         d.demoType || "",
        demoDate:         d.demoDate ? d.demoDate.split("T")[0] : "",
        demoPresenter:    d.demoPresenter || "",
        demoDuration:     d.demoDuration || "",
        demoAttendees:    d.demoAttendees || "",
        demoCustomerRating: d.demoCustomerRating || "",
        demoInterestLevel: d.demoInterestLevel || "",
        demoQuestionsRaised: d.demoQuestionsRaised || "",
        demoRejectionReason: d.demoRejectionReason || "",
        demoRejectionRemarks: d.demoRejectionRemarks || "",
        demoCompetitorName: d.demoCompetitorName || "",
        // V2: Sample management
        requiresSamples:  d.requiresSamples || "",
        sampleStatus:     d.sampleStatus || "",
        demoFollowUpDate: d.demoFollowUpDate ? d.demoFollowUpDate.split("T")[0] : "",
      });
      // V5: Lead verified (Qualified stage) — separate from businessNeed to avoid key collision
      setLeadVerified(d.leadVerified ?? false);
      // V5: Technical Discussion form
      setTdForm({
        tdDiscussionDate: d.tdDiscussionDate ? d.tdDiscussionDate.split("T")[0] : "",
        tdAttendees:      d.tdAttendees || "",
        tdEngineerId:     d.tdEngineerId || "",
      });
      // V5: Seed requirement items and TD rows from the deal's requirementItems relation
      const reqItems: RequirementItem[] = (json.data.requirementItems || []).map((item: any) => ({
        id:                item.id,
        productName:       item.productName,
        estimatedQuantity: String(item.estimatedQuantity),
        targetPriceMin:    item.targetPriceMin != null ? String(item.targetPriceMin) : "",
        targetPriceMax:    item.targetPriceMax != null ? String(item.targetPriceMax) : "",
        material:          item.material || "",
        requiredDelivery:  item.requiredDelivery ? item.requiredDelivery.split("T")[0] : "",
        specNotes:         item.specNotes || "",
        attachmentUrl:     item.attachmentUrl || "",
      }));
      setRequirementItems(reqItems);
      const tdRowsInit: TechNoteRow[] = (json.data.requirementItems || []).map((item: any) => ({
        requirementItemId: item.id,
        productName:       item.productName,
        feasibility:       (item.technicalNote?.feasibility || "") as any,
        confirmedSpec:     item.technicalNote?.confirmedSpec || "",
        toolingRequired:   item.technicalNote?.toolingRequired || "",
      }));
      setTdRows(tdRowsInit);
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
  }, [id, fetchOpportunities]);

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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setUsers(res.data.filter((u: any) => u.isActive));
      }
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
    fetchUsers();
  }, [fetchDeal, fetchContacts, fetchLossReasons, fetchCompetitors, fetchLinkedQuotations, fetchLinkedSample, fetchProducts, fetchUsers]);

  // Sync the URL `stage` param with deal.status so the sidebar highlights correctly
  const searchParams = useSearchParams();
  useSyncUrlParam(deal?.status, "stage");

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
    const idx = PIPELINE_STAGES.findIndex((s) => s === currentStage);
    if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return null;
    return PIPELINE_STAGES[idx + 1];
  };

  const handleSaveAndMove = async (toStage: string, options?: { demoOutcome?: "Accepted" | "Rejected" | "Follow-up needed"; demoFollowUpDate?: string; rejectedReason?: string; extraFields?: Record<string, any> }) => {
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

      // 1. Save current stage details first (merge extraFields to avoid overwrite)
      const saveRes = await fetch(`/api/opportunities/${id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rgForm,
          leadVerified,
          ...tdForm,
          ...(options?.extraFields || {}),
        }),
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
          ...(options?.demoFollowUpDate ? { demoFollowUpDate: options.demoFollowUpDate } : {}),
          ...(options?.rejectedReason ? { rejectedReason: options.rejectedReason } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Moved to ${STAGE_LABELS[toStage] || toStage} ✓`);
        setViewingStage(null);
        setRgAttempted(false);
        // Reset demo outcome state so stale values don't persist
        setDemoOutcomeChoice("");
        setDemoNotes("");
        setDemoFollowUpDate("");
        setDemoRejectionReason("");
        setDemoRejectionRemarks("");
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

  // V5: Manufacturing pipeline handlers
  const handleSaveRequirementItem = async (item: RequirementItem, index: number) => {
    try {
      const isNew = !item.id;
      const url = isNew
        ? `/api/opportunities/${id}/requirement-items`
        : `/api/opportunities/${id}/requirement-items/${item.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: item.productName,
          estimatedQuantity: item.estimatedQuantity,
          targetPriceMin: item.targetPriceMin,
          targetPriceMax: item.targetPriceMax,
          material: item.material,
          requiredDelivery: item.requiredDelivery,
          specNotes: item.specNotes,
          attachmentUrl: item.attachmentUrl,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Product requirement saved");
        await fetchDeal();
      } else {
        toast.error(json.message || "Failed to save product requirement");
      }
    } catch {
      toast.error("Failed to save product requirement due to a network error");
    }
  };

  const handleDeleteRequirementItem = async (item: RequirementItem, index: number) => {
    if (!item.id) {
      setRequirementItems(prev => prev.filter((_, i) => i !== index));
      return;
    }
    try {
      const res = await fetch(`/api/opportunities/${id}/requirement-items?itemId=${item.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Product requirement deleted");
        await fetchDeal();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || "Failed to delete product requirement");
      }
    } catch {
      toast.error("Failed to delete product requirement due to a network error");
    }
  };

  const handleSaveTechFeasibility = async (itemId: string) => {
    const row = tdRows.find((r) => r.requirementItemId === itemId);
    if (!row) return;

    setTdRows((prev) =>
      prev.map((r) => (r.requirementItemId === itemId ? { ...r, saving: true } : r))
    );

    try {
      const res = await fetch(`/api/opportunities/${id}/requirement-items/${itemId}/technical-note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feasibility: row.feasibility,
          confirmedSpec: row.confirmedSpec,
          toolingRequired: row.toolingRequired,
          engineerId: tdForm.tdEngineerId || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Technical feasibility updated");
        await fetchDeal();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || "Failed to save technical feasibility");
      }
    } catch {
      toast.error("Failed to save technical feasibility due to a network error");
    } finally {
      setTdRows((prev) =>
        prev.map((r) => (r.requirementItemId === itemId ? { ...r, saving: false } : r))
      );
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
      body: JSON.stringify({
        ...rgForm,
        leadVerified,
        ...tdForm,
      }),
    });
    setRgSaving(false);
    if (res.ok) {
      const stageLabel = STAGE_LABELS[viewingStage || deal.status] || "Stage";
      toast.success(`${stageLabel} details saved`);
      fetchDeal();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Failed to save details");
    }
  };

  // Meeting: "Mark as Conducted" — saves meetingStatus=Held without changing pipeline stage
  const handleMarkConducted = async () => {
    if (!rgForm.meetingType || !rgForm.meetingDate) {
      toast.error("Please fill Meeting Type and Meeting Date before marking as conducted");
      setRgAttempted(true);
      return;
    }
    setRgSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rgForm, leadVerified, ...tdForm, meetingStatus: "Held" }),
      });
      if (res.ok) {
        toast.success("Meeting marked as conducted — record outcome below");
        await fetchDeal();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || "Failed to update meeting status");
      }
    } catch {
      toast.error("Failed to update meeting status");
    } finally {
      setRgSaving(false);
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
      body: JSON.stringify({
        ...rgForm,
        leadVerified,
        ...tdForm,
        stage_context: viewingStage,
      }),
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
    const fromOrder = PIPELINE_STAGE_ORDER[fromStage as keyof typeof PIPELINE_STAGE_ORDER] ?? 0;
    const toOrder = PIPELINE_STAGE_ORDER[toStage as keyof typeof PIPELINE_STAGE_ORDER] ?? 0;
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
        <div className="max-w-4xl mx-auto">
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
                                    const stageRes = await fetch(`/api/opportunities/${id}/stage-change`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ to_stage: "RequirementGathering", force: true }),
                                    });
                                    const stageData = await stageRes.json();
                                    if (!stageData.success && !stageData.message?.includes("Already at this stage")) {
                                      toast.error(`Stage change failed: ${stageData.message || "Unknown error"}`);
                                    }
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
                {deal?.lead?.budgetAsked && !deal?.opportunityDetail?.budgetRange && (
                  <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                )}
              </FormField>
              <FormField label="Timeline">
                <Input value={rgForm.timeline || ""} onChange={(e) => setRgForm({ ...rgForm, timeline: e.target.value })} />
                {deal?.lead?.timelineAsked && !deal?.opportunityDetail?.timeline && (
                  <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                )}
              </FormField>
              <FormField label="Lead is genuine (verified requirement)" className="md:col-span-2">
                <Select
                  value={leadVerified ? "Yes" : "No"}
                  onChange={(e) => setLeadVerified(e.target.value === "Yes")}
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
                  <option value="yes">Yes — route to sample management</option>
                  <option value="no">No — proceed to requirement gathering</option>
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
                  <FormField label="Company Name">
                    <Input value={rgForm.companyName || ""} onChange={(e) => setRgForm({ ...rgForm, companyName: e.target.value })} />
                    {deal?.lead && !deal?.opportunityDetail?.companyName && rgForm.companyName && (
                      <p className="text-xs text-slate-400 mt-1">Auto-filled from lead/customer</p>
                    )}
                  </FormField>
                  <FormField label="Industry">
                    <Input value={rgForm.industry || ""} onChange={(e) => setRgForm({ ...rgForm, industry: e.target.value })} />
                    {deal?.lead?.industryType && !deal?.opportunityDetail?.industry && rgForm.industry && (
                      <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                    )}
                  </FormField>
                  <FormField label="Contact Person" required error={rgAttempted && !rgForm.contactPerson ? "This field is required" : ""}>
                    <Input value={rgForm.contactPerson || ""} onChange={(e) => setRgForm({ ...rgForm, contactPerson: e.target.value })} className={cn(rgAttempted && !rgForm.contactPerson && "border-rose-500")} />
                    {deal?.lead && !deal?.opportunityDetail?.contactPerson && rgForm.contactPerson && (
                      <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                    )}
                  </FormField>
                  <FormField label="Email" required error={rgAttempted && !rgForm.email ? "This field is required" : ""}>
                    <Input value={rgForm.email || ""} onChange={(e) => setRgForm({ ...rgForm, email: e.target.value })} className={cn(rgAttempted && !rgForm.email && "border-rose-500")} />
                    {deal?.lead && !deal?.opportunityDetail?.email && rgForm.email && (
                      <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                    )}
                  </FormField>
                  <FormField label="Phone" required error={rgAttempted && !rgForm.phone ? "This field is required" : ""}>
                    <Input value={rgForm.phone || ""} onChange={(e) => setRgForm({ ...rgForm, phone: e.target.value })} className={cn(rgAttempted && !rgForm.phone && "border-rose-500")} />
                    {deal?.lead && !deal?.opportunityDetail?.phone && rgForm.phone && (
                      <p className="text-xs text-slate-400 mt-1">Auto-filled from lead</p>
                    )}
                  </FormField>
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
                </div>
              )}
            </div>

            {/* Technical Requirements — Now Product Requirement Items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleRGSection("tech_req")} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                <span>Product Requirements</span>
                <ChevronRight size={16} className={cn("transition-transform", rgExpanded.tech_req && "rotate-90")} />
              </button>
              {rgExpanded.tech_req && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-slate-500">
                    Specify the parts, materials, quantities, target prices, and required delivery schedules.
                  </p>
                  <ProductRequirementTable
                    items={requirementItems}
                    onChange={(next) => setRequirementItems(next)}
                    onSaveItem={handleSaveRequirementItem}
                    onDeleteItem={handleDeleteRequirementItem}
                    readOnly={isReviewingCompleted || !canEditOpportunity(user, deal)}
                    products={products}
                  />
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
                  <FormField label="Budget Range (early qualified estimate)" required error={rgAttempted && !rgForm.budgetRange ? "This field is required" : ""}><Input value={rgForm.budgetRange || ""} onChange={(e) => setRgForm({ ...rgForm, budgetRange: e.target.value })} className={cn(rgAttempted && !rgForm.budgetRange && "border-rose-500")} /></FormField>
                  <FormField label="Expected Budget" required error={rgAttempted && !rgForm.expectedBudget ? "This field is required" : ""}><Input type="number" value={rgForm.expectedBudget || ""} onChange={(e) => setRgForm({ ...rgForm, expectedBudget: e.target.value })} className={cn(rgAttempted && !rgForm.expectedBudget && "border-rose-500")} /></FormField>
                  <FormField label="Final Discussed Budget"><Input type="number" value={rgForm.finalDiscussedBudget || ""} onChange={(e) => setRgForm({ ...rgForm, finalDiscussedBudget: e.target.value })} /></FormField>
                  <FormField label="Payment Terms"><Input value={rgForm.paymentTerms || ""} onChange={(e) => setRgForm({ ...rgForm, paymentTerms: e.target.value })} /></FormField>
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
                <div className="p-4 grid grid-cols-1 gap-4">
                  <FormField label="Consolidated notes / remarks">
                    <Textarea rows={4} value={rgForm.additionalNotes || rgForm.internalSalesNotes || ""} onChange={(e) => setRgForm({ ...rgForm, additionalNotes: e.target.value })} placeholder="Internal notes, presales review details, objections, and next steps..." />
                  </FormField>
                </div>
              )}
            </div>
          </div>
        )}

        {effectiveStage === "TechnicalDiscussion" && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700 flex items-center justify-between">
                <span>Discussion Header Details</span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Discussion Date">
                  <Input
                    type="date"
                    value={tdForm.tdDiscussionDate}
                    onChange={(e) => setTdForm({ ...tdForm, tdDiscussionDate: e.target.value })}
                    readOnly={isReviewingCompleted || !canEditOpportunity(user, deal)}
                  />
                </FormField>
                <FormField label="Attendees">
                  <Input
                    value={tdForm.tdAttendees}
                    onChange={(e) => setTdForm({ ...tdForm, tdAttendees: e.target.value })}
                    placeholder="Names of participants"
                    readOnly={isReviewingCompleted || !canEditOpportunity(user, deal)}
                  />
                </FormField>
                <FormField label="Assigned Engineer" className="md:col-span-2">
                  <Select
                    value={tdForm.tdEngineerId}
                    onChange={(e) => setTdForm({ ...tdForm, tdEngineerId: e.target.value })}
                    disabled={isReviewingCompleted || !canEditOpportunity(user, deal)}
                  >
                    <option value="">Select costing engineer...</option>
                    {users
                      .filter((u: any) => u.role === "CostingEngineer" || u.role === "Admin" || u.role === "SalesManager")
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                  </Select>
                </FormField>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700 flex items-center justify-between">
                <span>Product Feasibility Review</span>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-xs text-slate-500">
                  Assess each product requirements' manufacturing feasibility, confirm specifications, and note tooling requirements.
                </p>
                <TechnicalFeasibilityTable
                  rows={tdRows}
                  onFieldChange={(itemId, field, val) => {
                    setTdRows((prev) =>
                      prev.map((r) => (r.requirementItemId === itemId ? { ...r, [field]: val } : r))
                    );
                  }}
                  onSaveRow={handleSaveTechFeasibility}
                  readOnly={isReviewingCompleted || !canEditOpportunity(user, deal)}
                />
              </div>
            </div>
          </div>
        )}

        {effectiveStage === "MeetingScheduled" && (() => {
          const meetingStatus = rgForm.meetingStatus || "";
          const isScheduled = meetingStatus === "" || meetingStatus === "Scheduled";
          const isConducted = meetingStatus === "Held" || meetingStatus === "Completed";
          const hasOutcome = !!deal.demoOutcome;
          const meetingDateFormatted = rgForm.meetingDate
            ? new Date(rgForm.meetingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

          // Sales-role users for Assigned Executive dropdown
          const salesUsers = users.filter((u: any) =>
            SALES_ROLES.includes(u.role as Role)
          );
          const assignedExecMissing = !deal.assignedUserId && !editForm.assignedUserId;

          const handleAssignExec = async (userId: string) => {
            setEditForm({ ...editForm, assignedUserId: userId });
            const res = await fetch(`/api/opportunities/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assignedUserId: userId }),
            });
            if (res.ok) {
              toast.success("Assigned executive updated");
              fetchDeal();
            } else {
              const json = await res.json().catch(() => ({}));
              toast.error(json.message || "Failed to assign executive");
            }
          };

          const handleDemoSubmit = () => {
            if (!demoOutcomeChoice) {
              toast.error("Please select a Demo Outcome");
              return;
            }
            if (demoOutcomeChoice === "Follow-up needed" && !demoFollowUpDate) {
              toast.error("Next Follow-up Date is required for Follow-up Needed");
              return;
            }
            if (demoOutcomeChoice === "Rejected" && !demoRejectionReason.trim()) {
              toast.error("Rejection Reason is required");
              return;
            }
            // Pass demo fields via extraFields so they are saved atomically with rgForm
            handleSaveAndMove("DemoConducted", {
              demoOutcome: demoOutcomeChoice,
              ...(demoOutcomeChoice === "Follow-up needed" && demoFollowUpDate ? { demoFollowUpDate } : {}),
              ...(demoOutcomeChoice === "Rejected" ? { rejectedReason: demoRejectionReason } : {}),
              extraFields: {
                meetingOutcome: demoNotes,
                demoRejectionReason: demoOutcomeChoice === "Rejected" ? demoRejectionReason : null,
                demoRejectionRemarks: demoOutcomeChoice === "Rejected" ? demoRejectionRemarks : null,
              },
            });
          };

          return (
            <div className="space-y-6">
              {/* ─── Section A: Scheduling Summary Banner ─── */}
              {!isScheduled && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarClock size={16} className="text-[var(--primary)]" />
                    <span className="text-sm font-bold text-slate-700">Scheduling Summary</span>
                    <span className={cn(
                      "ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold",
                      isConducted ? "bg-amber-100 text-amber-700" :
                      hasOutcome ? "bg-green-100 text-green-700" :
                      "bg-slate-200 text-slate-600"
                    )}>
                      {hasOutcome ? `Demo ${deal.demoOutcome}` : meetingStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block">Assigned To</span>
                      <span className="font-medium text-slate-700">{deal.assignedUser?.name || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Meeting Type</span>
                      <span className="font-medium text-slate-700">{rgForm.meetingType || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Mode</span>
                      <span className="font-medium text-slate-700">{rgForm.meetingMode || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Date</span>
                      <span className="font-medium text-slate-700">{meetingDateFormatted}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Section B: Stage Action Panel ─── */}
              {/* State: Scheduled — editable scheduling fields */}
              {isScheduled && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)] flex items-center gap-2">
                    <CalendarClock size={15} /> Schedule Meeting
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Meeting Type" required error={rgAttempted && !rgForm.meetingType ? "Required" : ""}>
                      <Select value={rgForm.meetingType || ""} onChange={(e) => setRgForm({ ...rgForm, meetingType: e.target.value })} className={cn(rgAttempted && !rgForm.meetingType && "border-rose-500")}>
                        <option value="">Select...</option>
                        <option value="Discovery Call">Discovery Call</option>
                        <option value="Technical Discussion">Technical Discussion</option>
                        <option value="Site Visit">Site Visit</option>
                        <option value="Solution Review">Solution Review</option>
                      </Select>
                    </FormField>
                    <FormField label="Meeting Date" required error={rgAttempted && !rgForm.meetingDate ? "Required" : ""}>
                      <Input type="date" value={rgForm.meetingDate || ""} onChange={(e) => setRgForm({ ...rgForm, meetingDate: e.target.value })} className={cn(rgAttempted && !rgForm.meetingDate && "border-rose-500")} />
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
                    <FormField label="Assigned Executive" required error={rgAttempted && assignedExecMissing ? "Assign an executive to proceed" : ""}>
                      <Select
                        value={deal.assignedUserId || editForm.assignedUserId || ""}
                        onChange={(e) => handleAssignExec(e.target.value)}
                        className={cn(rgAttempted && assignedExecMissing && "border-rose-500")}
                      >
                        <option value="">Select executive...</option>
                        {salesUsers.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </Select>
                      {assignedExecMissing && (
                        <span className="text-xs text-rose-500 mt-1 block">Assign an executive to proceed</span>
                      )}
                    </FormField>
                  </div>
                </div>
              )}

              {/* State: Scheduled — optional meeting details */}
              {isScheduled && (
                <details className="border border-slate-200 rounded-xl overflow-hidden group">
                  <summary className="px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between">
                    <span>Additional Meeting Details (Optional)</span>
                    <ChevronRight size={16} className="transform group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200">
                    <FormField label="Duration (minutes)"><Input type="number" value={rgForm.meetingDuration || ""} onChange={(e) => setRgForm({ ...rgForm, meetingDuration: e.target.value })} /></FormField>
                    <FormField label="Location"><Input value={rgForm.meetingLocation || ""} onChange={(e) => setRgForm({ ...rgForm, meetingLocation: e.target.value })} /></FormField>
                    <FormField label="Participants"><Input value={rgForm.meetingParticipants || ""} onChange={(e) => setRgForm({ ...rgForm, meetingParticipants: e.target.value })} /></FormField>
                    <FormField label="Agenda"><Textarea rows={2} value={rgForm.meetingAgenda || ""} onChange={(e) => setRgForm({ ...rgForm, meetingAgenda: e.target.value })} /></FormField>
                  </div>
                </details>
              )}

              {/* ─── Container 2: Demo Outcome Panel (appears after meeting is conducted) ─── */}
              {isConducted && !hasOutcome && (
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <div className="px-4 py-3 bg-amber-100/60 text-sm font-bold text-amber-800 flex items-center gap-2">
                    <CheckCircle size={15} /> Meeting Conducted — Enter Demo Details
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Demo Specific Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-amber-200/50">
                      <FormField label="Demo Date" required error={rgAttempted && !rgForm.demoDate ? "Required" : ""}>
                        <Input type="date" value={rgForm.demoDate || ""} onChange={(e) => setRgForm({ ...rgForm, demoDate: e.target.value })} className={cn(rgAttempted && !rgForm.demoDate && "border-rose-500")} />
                      </FormField>
                      <FormField label="Demo Type" required error={rgAttempted && !rgForm.demoType ? "Required" : ""}>
                        <Select value={rgForm.demoType || ""} onChange={(e) => setRgForm({ ...rgForm, demoType: e.target.value })} className={cn(rgAttempted && !rgForm.demoType && "border-rose-500")}>
                          <option value="">Select...</option>
                          <option value="Product Tour">Product Tour</option>
                          <option value="Technical Deep Dive">Technical Deep Dive</option>
                          <option value="Executive Overview">Executive Overview</option>
                          <option value="Other">Other</option>
                        </Select>
                      </FormField>
                      <FormField label="Interest Level" required error={rgAttempted && !rgForm.demoInterestLevel ? "Required" : ""}>
                        <Select value={rgForm.demoInterestLevel || ""} onChange={(e) => setRgForm({ ...rgForm, demoInterestLevel: e.target.value })} className={cn(rgAttempted && !rgForm.demoInterestLevel && "border-rose-500")}>
                          <option value="">Select...</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </Select>
                      </FormField>
                    </div>

                    {/* Required: Demo Outcome selector */}
                    <FormField label="Demo Outcome" required>
                      <Select
                        value={demoOutcomeChoice}
                        onChange={(e) => setDemoOutcomeChoice(e.target.value as any)}
                      >
                        <option value="">Select outcome...</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Follow-up needed">Follow-up Needed</option>
                        <option value="Rejected">Rejected</option>
                      </Select>
                    </FormField>

                    {/* Conditional fields: Accepted */}
                    {demoOutcomeChoice === "Accepted" && (
                      <div className="space-y-4 pl-4 border-l-2 border-green-200">
                        <FormField label="Outcome Notes (optional)">
                          <Textarea rows={3} value={demoNotes} onChange={(e) => setDemoNotes(e.target.value)} placeholder="What happened in the demo? Customer reactions, key takeaways..." />
                        </FormField>
                      </div>
                    )}

                    {/* Conditional fields: Follow-up Needed */}
                    {demoOutcomeChoice === "Follow-up needed" && (
                      <div className="space-y-4 pl-4 border-l-2 border-amber-200">
                        <FormField label="Next Follow-up Date" required error={!demoFollowUpDate ? "Required" : ""}>
                          <Input type="date" value={demoFollowUpDate} onChange={(e) => setDemoFollowUpDate(e.target.value)} className={cn(!demoFollowUpDate && "border-rose-500")} />
                        </FormField>
                        <FormField label="Outcome Notes (optional)">
                          <Textarea rows={3} value={demoNotes} onChange={(e) => setDemoNotes(e.target.value)} placeholder="What happened in the demo? Why is a follow-up needed?" />
                        </FormField>
                      </div>
                    )}

                    {/* Conditional fields: Rejected */}
                    {demoOutcomeChoice === "Rejected" && (
                      <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                        <FormField label="Rejection Reason" required error={!demoRejectionReason.trim() ? "Required" : ""}>
                          <Select
                            value={demoRejectionReason}
                            onChange={(e) => setDemoRejectionReason(e.target.value)}
                            className={cn(!demoRejectionReason.trim() && "border-rose-500")}
                          >
                            <option value="">Select reason...</option>
                            <option value="Price too high">Price too high</option>
                            <option value="Went with competitor">Went with competitor</option>
                            <option value="No budget">No budget</option>
                            <option value="Not interested">Not interested</option>
                            <option value="Product doesn't meet needs">Product doesn't meet needs</option>
                            <option value="Timing not right">Timing not right</option>
                            <option value="Other">Other</option>
                          </Select>
                        </FormField>
                        <FormField label="Rejection Remarks (optional)">
                          <Textarea rows={2} value={demoRejectionRemarks} onChange={(e) => setDemoRejectionRemarks(e.target.value)} placeholder="Additional context on why the demo was rejected..." />
                        </FormField>
                      </div>
                    )}

                    {/* Save & Move button */}
                    <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-amber-200">
                      <button
                        onClick={handleDemoSubmit}
                        disabled={stageMoving || !demoOutcomeChoice}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {stageMoving ? "Saving..." : "Save Details & Move to Demo Conducted"} <ChevronRight size={16} />
                      </button>
                      {!demoOutcomeChoice && (
                        <span className="text-xs text-slate-500">Select a demo outcome to proceed</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* State: Outcome already set — read-only summary */}
              {hasOutcome && (
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
                        ? "RFQ will be auto-created. Opportunity proceeds to Demo Conducted stage."
                        : deal.demoOutcome === "Follow-up needed"
                        ? `Follow-up pending${deal.demoFollowUpDate ? ` on ${new Date(deal.demoFollowUpDate).toLocaleDateString("en-IN")}` : ""}.`
                        : "The customer rejected the demo. Opportunity will be moved to Rejected."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {effectiveStage === "DemoConducted" && (() => {
          const outcome = deal.demoOutcome;
          const demoDateFormatted = rgForm.meetingDate
            ? new Date(rgForm.meetingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
          const followUpDateFormatted = deal.demoFollowUpDate
            ? new Date(deal.demoFollowUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : null;

          return (
            <div className="space-y-6">
              {/* ─── Demo Summary Banner (read-only) ─── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-[var(--primary)]" />
                  <span className="text-sm font-bold text-slate-700">Demo Summary</span>
                  {outcome && (
                    <span className={cn(
                      "ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold",
                      outcome === "Accepted" ? "bg-green-100 text-green-700" :
                      outcome === "Follow-up needed" ? "bg-amber-100 text-amber-700" :
                      "bg-orange-100 text-orange-700"
                    )}>
                      Demo {outcome}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">Demo Type</span>
                    <span className="font-medium text-slate-700">{rgForm.meetingType || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Date</span>
                    <span className="font-medium text-slate-700">{demoDateFormatted}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Mode</span>
                    <span className="font-medium text-slate-700">{rgForm.meetingMode || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Conducted By</span>
                    <span className="font-medium text-slate-700">{deal.assignedUser?.name || "—"}</span>
                  </div>
                </div>
                {rgForm.meetingOutcome && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-400 block mb-1">Outcome Notes</span>
                    <p className="text-sm text-slate-600">{rgForm.meetingOutcome}</p>
                  </div>
                )}
              </div>

              {/* ─── Next Steps Panel (outcome-driven) ─── */}

              {/* Outcome: Accepted — show RFQ/Quotation links */}
              {outcome === "Accepted" && (
                <div className="space-y-4">
                  <RFQSummaryCard
                    items={(requirementItems || []).map((item) => {
                      const tdRow = tdRows.find((r) => r.requirementItemId === item.id);
                      return {
                        productName: item.productName,
                        quantity: parseInt(item.estimatedQuantity) || 0,
                        confirmedSpec: tdRow?.confirmedSpec || null,
                        specNotes: item.specNotes || null,
                        material: item.material || null,
                        requiredDelivery: item.requiredDelivery || null,
                        feasibility: tdRow?.feasibility as any,
                      };
                    })}
                    rfqId={deal.rfqs?.[0]?.id}
                    opportunityId={id}
                    onCreateRFQ={async () => {
                      // Trigger POST to stage-change with demoOutcome Accepted
                      const res = await fetch(`/api/opportunities/${id}/stage-change`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to_stage: "DemoConducted",
                          demoOutcome: "Accepted",
                        }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        toast.success("RFQ created successfully");
                        await fetchDeal();
                        return { rfqId: json.data?.rfqs?.[0]?.id || deal.rfqs?.[0]?.id };
                      } else {
                        toast.error(json.message || "Failed to auto-populate RFQ");
                        return {};
                      }
                    }}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => router.push(`/quotations/new?opportunityId=${deal.id}`)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <FileText size={15} /> Create Quotation
                    </button>
                  </div>
                </div>
              )}

              {/* Outcome: Follow-up Needed — show follow-up date + reschedule options */}
              {outcome === "Follow-up needed" && (() => {
                // Parse follow-up date as local date to avoid timezone comparison issues
                const followUpDateRaw = deal.demoFollowUpDate ? new Date(deal.demoFollowUpDate) : null;
                const followUpDateObj = followUpDateRaw ? new Date(followUpDateRaw.getFullYear(), followUpDateRaw.getMonth(), followUpDateRaw.getDate()) : null;
                const todayFU = new Date(); todayFU.setHours(0, 0, 0, 0);
                const followUpDateReached = !followUpDateObj || followUpDateObj <= todayFU;

                return (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Follow-up Needed</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {followUpDateFormatted
                          ? `Follow-up scheduled for ${followUpDateFormatted}. ${followUpDateReached ? "Record the outcome below." : "Come back on that day to record the outcome."}`
                          : "No follow-up date set. Contact the customer and schedule a follow-up."}
                      </p>
                    </div>
                  </div>
                  {followUpDateFormatted && (
                    <div className="pt-3 border-t border-amber-200">
                      <span className="text-xs text-slate-400 block mb-1">Next Follow-up Date</span>
                      <p className="text-sm font-medium text-slate-700">{followUpDateFormatted}</p>
                    </div>
                  )}
                  {rgForm.meetingOutcome && (
                    <div className="pt-2">
                      <span className="text-xs text-slate-400 block mb-1">Outcome Notes</span>
                      <p className="text-sm text-slate-600">{rgForm.meetingOutcome}</p>
                    </div>
                  )}

                  {/* Before follow-up date: show waiting message */}
                  {!followUpDateReached && (
                    <div className="pt-3 border-t border-amber-200">
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100/60 rounded-lg px-4 py-3">
                        <Clock size={16} className="text-amber-600 shrink-0" />
                        <span>Follow-up is on <strong>{followUpDateFormatted}</strong>. Accept/Reject options will be available on that day.</span>
                      </div>
                    </div>
                  )}

                  {/* On/after follow-up date: show rejection inputs + outcome buttons */}
                  {followUpDateReached && (
                    <>
                      <div className="pt-2 border-t border-amber-200 space-y-3">
                        <FormField label="Rejection Reason (if rejecting)">
                          <Select value={demoRejectionReason} onChange={(e) => setDemoRejectionReason(e.target.value)}>
                            <option value="">Select reason (only if rejecting)...</option>
                            <option value="Price too high">Price too high</option>
                            <option value="Went with competitor">Went with competitor</option>
                            <option value="No budget">No budget</option>
                            <option value="Not interested">Not interested</option>
                            <option value="Product doesn't meet needs">Product doesn't meet needs</option>
                            <option value="Timing not right">Timing not right</option>
                            <option value="Other">Other</option>
                          </Select>
                        </FormField>
                        <FormField label="Rejection Remarks (optional)">
                          <Textarea rows={2} value={demoRejectionRemarks} onChange={(e) => setDemoRejectionRemarks(e.target.value)} placeholder="Additional context on why the demo was rejected..." />
                        </FormField>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-amber-200">
                        <button
                          onClick={() => {
                            if (!canChangeStage(user, deal)) return;
                            handleSaveAndMove("DemoConducted", {
                              demoOutcome: "Accepted",
                              extraFields: { meetingOutcome: rgForm.meetingOutcome },
                            });
                          }}
                          disabled={!canChangeStage(user, deal) || stageMoving}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <CheckCircle size={15} /> Mark as Accepted
                        </button>
                        <button
                          onClick={() => {
                            if (!canChangeStage(user, deal)) return;
                            if (!demoRejectionReason.trim()) {
                              toast.error("Please select a Rejection Reason first");
                              return;
                            }
                            handleSaveAndMove("DemoConducted", {
                              demoOutcome: "Rejected",
                              rejectedReason: demoRejectionReason,
                              extraFields: {
                                meetingOutcome: rgForm.meetingOutcome,
                                demoRejectionReason,
                                demoRejectionRemarks: demoRejectionRemarks || null,
                              },
                            });
                          }}
                          disabled={!canChangeStage(user, deal) || stageMoving}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <XCircle size={15} /> Mark as Rejected
                        </button>
                      </div>
                    </>
                  )}
                </div>
                );
              })}

              {/* Outcome: Rejected — terminal state */}
              {outcome === "Rejected" && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <XCircle size={20} className="text-orange-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-orange-800">Demo Rejected</p>
                      <p className="text-xs text-orange-600 mt-0.5">The customer rejected the demo. This opportunity has been moved to the Rejected terminal stage.</p>
                    </div>
                  </div>
                  {deal.rejectedReason && (
                    <div className="pt-3 border-t border-orange-200">
                      <span className="text-xs text-slate-400 block mb-1">Rejection Reason</span>
                      <p className="text-sm font-medium text-slate-700">{deal.rejectedReason}</p>
                    </div>
                  )}
                  {rgForm.demoRejectionRemarks && (
                    <div className="pt-2">
                      <span className="text-xs text-slate-400 block mb-1">Rejection Remarks</span>
                      <p className="text-sm text-slate-600">{rgForm.demoRejectionRemarks}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Edge case: DemoConducted stage but no outcome set — show outcome selection */}
              {!outcome && (
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/20 dark:bg-amber-950/5 dark:border-amber-900/30">
                  <div className="px-4 py-3 bg-amber-100/50 border-b border-amber-200 dark:border-amber-900/30 text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                    <AlertTriangle size={14} className="text-amber-500" /> Record Demo Outcome
                  </div>
                  <div className="p-5 space-y-5">
                    <p className="text-xs text-slate-505 leading-relaxed">
                      This demo has been conducted but the final outcome is not yet recorded. Please select the customer's decision below to update the status and unlock next actions.
                    </p>

                    {/* Three Toggle Buttons for Outcome Choice */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setDemoOutcomeChoice("Accepted")}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm cursor-pointer",
                          demoOutcomeChoice === "Accepted"
                            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-400"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                        )}
                      >
                        <CheckCircle size={18} />
                        <span>Demo Accepted</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoOutcomeChoice("Follow-up needed")}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm cursor-pointer",
                          demoOutcomeChoice === "Follow-up needed"
                            ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                        )}
                      >
                        <Calendar size={18} />
                        <span>Follow-up Needed</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoOutcomeChoice("Rejected")}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm cursor-pointer",
                          demoOutcomeChoice === "Rejected"
                            ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                        )}
                      >
                        <XCircle size={18} />
                        <span>Demo Rejected</span>
                      </button>
                    </div>

                    {/* Inline Conditional Form Panel */}
                    {demoOutcomeChoice === "Accepted" && (
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
                        <FormField label="Outcome Notes">
                          <Textarea rows={3} value={rgForm.meetingOutcome || ""} onChange={(e) => setRgForm({ ...rgForm, meetingOutcome: e.target.value })} placeholder="Record notes about the acceptance, customer requests, or next steps..." />
                        </FormField>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSaveAndMove("DemoConducted", {
                              demoOutcome: "Accepted",
                              extraFields: { meetingOutcome: rgForm.meetingOutcome },
                            })}
                            disabled={stageMoving}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle size={14} /> Accept & Proceed
                          </button>
                        </div>
                      </div>
                    )}

                    {demoOutcomeChoice === "Follow-up needed" && (
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField label="Follow-up Date" required>
                            <Input type="date" value={rgForm.demoFollowUpDate || ""} onChange={(e) => setRgForm({ ...rgForm, demoFollowUpDate: e.target.value })} />
                          </FormField>
                          <FormField label="Outcome Notes">
                            <Textarea rows={2} value={rgForm.meetingOutcome || ""} onChange={(e) => setRgForm({ ...rgForm, meetingOutcome: e.target.value })} placeholder="Reason for follow-up or topics to cover..." />
                          </FormField>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (!rgForm.demoFollowUpDate) {
                                toast.error("Please set a Demo Follow-up Date first");
                                return;
                              }
                              handleSaveAndMove("DemoConducted", {
                                demoOutcome: "Follow-up needed",
                                demoFollowUpDate: rgForm.demoFollowUpDate,
                                extraFields: { meetingOutcome: rgForm.meetingOutcome },
                              });
                            }}
                            disabled={stageMoving}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Calendar size={14} /> Set Follow-up Date
                          </button>
                        </div>
                      </div>
                    )}

                    {demoOutcomeChoice === "Rejected" && (
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField label="Rejection Reason" required>
                            <Select value={demoRejectionReason} onChange={(e) => setDemoRejectionReason(e.target.value)}>
                              <option value="">Select reason...</option>
                              <option value="Price too high">Price too high</option>
                              <option value="Went with competitor">Went with competitor</option>
                              <option value="No budget">No budget</option>
                              <option value="Not interested">Not interested</option>
                              <option value="Product doesn't meet needs">Product doesn't meet needs</option>
                              <option value="Timing not right">Timing not right</option>
                              <option value="Other">Other</option>
                            </Select>
                          </FormField>
                          <FormField label="Rejection Remarks (optional)">
                            <Textarea rows={2} value={demoRejectionRemarks} onChange={(e) => setDemoRejectionRemarks(e.target.value)} placeholder="Additional context..." />
                          </FormField>
                        </div>
                        <FormField label="Outcome Notes">
                          <Textarea rows={2} value={rgForm.meetingOutcome || ""} onChange={(e) => setRgForm({ ...rgForm, meetingOutcome: e.target.value })} placeholder="Summary comments..." />
                        </FormField>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (!demoRejectionReason.trim()) {
                                toast.error("Please select a Rejection Reason first");
                                return;
                              }
                              handleSaveAndMove("DemoConducted", {
                                demoOutcome: "Rejected",
                                rejectedReason: demoRejectionReason,
                                extraFields: {
                                  meetingOutcome: rgForm.meetingOutcome,
                                  demoRejectionReason,
                                  demoRejectionRemarks: demoRejectionRemarks || null,
                                },
                              });
                            }}
                            disabled={stageMoving}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <XCircle size={14} /> Reject & Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Demo-specific details (read-only expandable) */}
              {(rgForm.demoCustomerRating || rgForm.demoInterestLevel || rgForm.demoPresenter || rgForm.demoAttendees || rgForm.demoQuestionsRaised) && (
                <details className="border border-slate-200 rounded-xl overflow-hidden group">
                  <summary className="px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between">
                    <span>Demo Details (Read-only)</span>
                    <ChevronRight size={16} className="transform group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200">
                    <div><span className="text-xs text-slate-400 block">Presenter</span><span className="text-sm text-slate-700">{rgForm.demoPresenter || "—"}</span></div>
                    <div><span className="text-xs text-slate-400 block">Duration</span><span className="text-sm text-slate-700">{rgForm.demoDuration ? `${rgForm.demoDuration} min` : "—"}</span></div>
                    <div><span className="text-xs text-slate-400 block">Attendees</span><span className="text-sm text-slate-700">{rgForm.demoAttendees || "—"}</span></div>
                    <div><span className="text-xs text-slate-400 block">Customer Rating</span><span className="text-sm text-slate-700">{rgForm.demoCustomerRating ? `${rgForm.demoCustomerRating}/5` : "—"}</span></div>
                    <div><span className="text-xs text-slate-400 block">Interest Level</span><span className="text-sm text-slate-700">{rgForm.demoInterestLevel || "—"}</span></div>
                    <div className="md:col-span-2"><span className="text-xs text-slate-400 block">Questions Raised</span><span className="text-sm text-slate-700">{rgForm.demoQuestionsRaised || "—"}</span></div>
                  </div>
                </details>
              )}
            </div>
          );
        })()}

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
                <option value="Per Unit">Per Unit</option>
                <option value="Fixed Price">Fixed Price</option>
                <option value="Cost Plus">Cost Plus</option>
                <option value="Milestone-based">Milestone-based</option>
              </Select>
            </FormField>
            <FormField label="Payment Terms"><Input value={rgForm.paymentTerms || ""} onChange={(e) => setRgForm({ ...rgForm, paymentTerms: e.target.value })} /></FormField>
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
              const isMeetingScheduled = effectiveStage === "MeetingScheduled";

              // 1. Calculate blocking reasons for current stage
              const blockingReasons: string[] = [];
              let hasNotFeasible = false;
              let notFeasibleNames: string[] = [];

              if (deal.status === "RequirementGathering") {
                const missing = (STAGE_REQUIRED_FIELDS.RequirementGathering || []).filter((r) => {
                  const val = (rgForm as any)[r.field];
                  return !val || (typeof val === "string" && val.trim() === "");
                });
                if (missing.length > 0) {
                  blockingReasons.push(`Required fields missing: ${missing.map((m) => m.label).join(", ")}`);
                }
                if (!requirementItems || requirementItems.length === 0) {
                  blockingReasons.push("At least one product requirement must be added to proceed.");
                }
              } else if (deal.status === "TechnicalDiscussion") {
                if (!requirementItems || requirementItems.length === 0) {
                  blockingReasons.push("At least one product requirement must be added to proceed.");
                } else {
                  const missingFeasibility = tdRows.filter((r) => !r.feasibility);
                  if (missingFeasibility.length > 0) {
                    blockingReasons.push(`Feasibility review pending for: ${missingFeasibility.map((r) => r.productName).join(", ")}.`);
                  }
                  const notFeasible = tdRows.filter((r) => r.feasibility === "NotFeasible");
                  if (notFeasible.length > 0) {
                    hasNotFeasible = true;
                    notFeasibleNames = notFeasible.map((r) => r.productName);
                    blockingReasons.push(`Products marked Not feasible: ${notFeasibleNames.join(", ")}.`);
                  }
                }
              } else if (deal.status === "MeetingScheduled") {
                const missing = (STAGE_REQUIRED_FIELDS.MeetingScheduled || []).filter((r) => {
                  const val = (rgForm as any)[r.field];
                  return !val || (typeof val === "string" && val.trim() === "");
                });
                if (missing.length > 0) {
                  blockingReasons.push(`Required fields missing: ${missing.map((m) => m.label).join(", ")}`);
                }
                if (!deal.assignedUserId && !editForm.assignedUserId) {
                  blockingReasons.push("Assign an executive to proceed.");
                }
              } else {
                const stageRequired = STAGE_REQUIRED_FIELDS[deal.status] || [];
                const missing = stageRequired.filter((r) => {
                  const val = (rgForm as any)[r.field];
                  return !val || (typeof val === "string" && val.trim() === "");
                });
                if (missing.length > 0) {
                  blockingReasons.push(`Required fields missing: ${missing.map((m) => m.label).join(", ")}`);
                }
              }

              const meetingStatus = rgForm.meetingStatus || "";
              const meetingIsScheduled = meetingStatus === "" || meetingStatus === "Scheduled";
              const meetingHasOutcome = !!deal.demoOutcome;
              const meetingDateObj = rgForm.meetingDate ? new Date(rgForm.meetingDate + "T00:00:00") : null;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const meetingDateReached = !meetingDateObj || meetingDateObj <= today;
              const meetingDateFormattedShort = meetingDateObj
                ? meetingDateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "";

              return (
                <div className="flex flex-col items-end gap-3 w-full">
                  <div className="flex items-center gap-3 w-full justify-between sm:justify-end">
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

                    {/* MeetingScheduled: "Mark as Conducted" button when in Scheduled state */}
                    {isMeetingScheduled && meetingIsScheduled && !meetingHasOutcome && (
                      <div className="flex flex-col items-end gap-1.5">
                        {!meetingDateReached && rgForm.meetingDate && (
                          <p className="text-xs text-amber-500 font-medium">
                            📅 Meeting scheduled for {meetingDateFormattedShort}. Come back on that day to mark as conducted.
                          </p>
                        )}
                        <button
                          onClick={() => {
                            if (!rgForm.meetingType || !rgForm.meetingDate) {
                              setRgAttempted(true);
                              toast.error("Please fill Meeting Type and Meeting Date first");
                              return;
                            }
                            if (!deal.assignedUserId && !editForm.assignedUserId) {
                              setRgAttempted(true);
                              toast.error("Please assign an executive first");
                              return;
                            }
                            handleMarkConducted();
                          }}
                          disabled={rgSaving || stageMoving}
                          style={{
                            background: (rgForm.meetingType && rgForm.meetingDate && (deal.assignedUserId || editForm.assignedUserId)) ? "var(--brand-primary, var(--primary))" : "var(--color-background-secondary, #e2e8f0)",
                            color: (rgForm.meetingType && rgForm.meetingDate && (deal.assignedUserId || editForm.assignedUserId)) ? "#fff" : "var(--text-tertiary, #64748b)",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            fontWeight: 500,
                            cursor: (rgForm.meetingType && rgForm.meetingDate && (deal.assignedUserId || editForm.assignedUserId)) ? "pointer" : "not-allowed",
                            border: "none",
                            transition: "background 0.15s",
                          }}
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          {rgSaving ? "Saving..." : <><CheckCircle size={16} /> Mark as Conducted →</>}
                        </button>
                      </div>
                    )}

                    {/* Custom advance buttons for stages */}
                    {nextStage && !isMeetingScheduled && (
                      <StageAdvanceButton
                        label={`Advance to ${STAGE_DISPLAY_LABELS[nextStage]}`}
                        blockingReasons={blockingReasons}
                        hasNotFeasible={hasNotFeasible}
                        notFeasibleNames={notFeasibleNames}
                        onAdvance={() => handleSaveAndMove(nextStage)}
                        loading={stageMoving}
                      />
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        </div>
      </div>
    );
  };

  // ─── Read-Only Completed Requirement Gathering ───────────────────────────────

  const renderReadOnlyRequirementGathering = () => {
    const currentOrder = PIPELINE_STAGE_ORDER[deal.status as keyof typeof PIPELINE_STAGE_ORDER] ?? 0;
    const rgOrder = PIPELINE_STAGE_ORDER["RequirementGathering"] ?? 0;
    if (currentOrder <= rgOrder) return null;

    const ReadOnlyField = ({ label, value }: { label: string; value?: string | number | null }) => (
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 min-h-[38px]">{value || <span className="text-slate-300 italic">—</span>}</p>
      </div>
    );

    return (
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-4xl mx-auto">
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

          {/* Product Requirements */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Product Requirements</div>
            <div className="p-4">
              <ProductRequirementTable
                items={requirementItems}
                onChange={() => {}}
                onSaveItem={async () => {}}
                onDeleteItem={async () => {}}
                readOnly={true}
                products={products}
              />
            </div>
          </div>

          {/* Commercial Information */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Commercial Information</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ReadOnlyField label="Budget Range (early qualified estimate)" value={rgForm.budgetRange} />
              <ReadOnlyField label="Expected Budget" value={rgForm.expectedBudget} />
              <ReadOnlyField label="Final Discussed Budget" value={rgForm.finalDiscussedBudget} />
              <ReadOnlyField label="Payment Terms" value={rgForm.paymentTerms} />
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

          {/* Internal Notes */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">Internal Notes</div>
            <div className="p-4">
              <ReadOnlyField label="Consolidated notes / remarks" value={rgForm.additionalNotes || rgForm.internalSalesNotes} />
            </div>
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

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s === deal.status);
  const hasAcceptedQuotation = deal.quotations?.some((q: any) => q.status === "Accepted");
  const isTerminalStage = deal.status === "Won" || deal.status === "Lost" || deal.status === "Rejected";
  const isValidStage = currentStageIndex !== -1 || isTerminalStage;
  const progressPercent = isTerminalStage
    ? (deal.status === "Won" ? 100 : 0)
    : Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100);

  const summaryRows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Value",
      value: (
        <span className="font-bold text-text-primary tabular-nums">
          {formatCurrency(deal.dealValue)}
        </span>
      ),
    },
    {
      label: "Probability",
      value: (
        <div className="flex items-center gap-2 w-28">
          <div className="flex-1 h-1.5 bg-border-subtle rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${deal.probabilityPercent ?? 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-text-primary tabular-nums w-8 text-right">
            {deal.probabilityPercent ?? 0}%
          </span>
        </div>
      ),
    },
    {
      label: "Close Date",
      value: deal.expectedCloseDate ? (
        <span
          className={cn(
            "text-xs font-medium",
            deal.isOverdue ? "text-danger-text" : "text-text-secondary"
          )}
        >
          {formatDate(deal.expectedCloseDate)}
          {deal.isOverdue && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-danger-text">
              <AlertTriangle size={10} />
              Overdue
            </span>
          )}
        </span>
      ) : (
        <span className="text-text-muted text-xs italic">Not set</span>
      ),
    },
    {
      label: "Owner",
      value: (
        <div className="flex items-center gap-1.5 max-w-[120px]">
          <div className="w-5 h-5 rounded-full bg-[var(--primary)]/15 flex items-center justify-center shrink-0">
            <User size={11} className="text-[var(--primary)]" />
          </div>
          <span className="text-xs font-medium text-text-secondary truncate">
            {deal.assignedUser?.name || "Unassigned"}
          </span>
        </div>
      ),
    },
    {
      label: "Account",
      value: (
        <span className="text-xs font-medium text-text-secondary truncate max-w-[120px]">
          {deal.customer?.name || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-card">
      {/* ── Column 2: Center — Main Detail ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-card h-full">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.push("/sales-pipeline/pipeline-list")}
            className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={16} /> Back to Pipeline
          </button>

          {/* ── Invalid Stage Error Banner ─── */}
          {!isValidStage && (
            <div className="p-4 rounded-lg bg-danger-bg border border-danger-border flex items-start gap-3">
              <AlertTriangle size={20} className="text-danger-text shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-danger-text">Invalid Opportunity Stage</p>
                <p className="text-sm text-danger-text mt-1">
                  This opportunity has an invalid stage value: <code className="bg-danger-bg px-1.5 py-0.5 rounded border border-danger-border">{deal.status}</code>.
                  Valid stages are: Qualified, RequirementGathering, MeetingScheduled, DemoConducted, Rejected, Lost.
                  Please contact support to correct this record.
                </p>
              </div>
            </div>
          )}

          {/* ─── Hero Summary Card ─── */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[var(--primary)]/[0.08] via-transparent to-transparent p-6 shadow-sm">
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-full border",
                    deal.status === "Won" ? "bg-success-bg text-success border-success-border" :
                    deal.status === "Lost" ? "bg-danger-bg text-danger-text border-danger-border" :
                    "bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/25"
                  )}>
                    {STAGE_LABELS[deal.status] || deal.status}
                  </span>
                  {deal.opportunityCode && (
                    <span className="text-xs font-bold text-text-muted">{deal.opportunityCode}</span>
                  )}
                  {deal.isOverdue && (
                    <span className="px-2 py-0.5 bg-danger-bg text-danger-text text-xs font-bold rounded-full border border-danger-border flex items-center gap-1">
                      <AlertTriangle size={11} /> Overdue
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{deal.dealName}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                  <span className="font-medium truncate">{deal.customer?.name}</span>
                  <span className="text-border">•</span>
                  <span className="font-bold text-[var(--primary)]">{formatCurrency(deal.dealValue)}</span>
                </div>
              </div>

              <div className="flex flex-col items-start lg:items-end gap-2 min-w-[140px]">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Progress</span>
                <span className={cn(
                  "text-3xl font-extrabold tabular-nums",
                  deal.status === "Won" ? "text-success" : deal.status === "Lost" ? "text-danger-text" : "text-[var(--primary)]"
                )}>
                  {deal.status === "Lost" ? "0%" : `${progressPercent}%`}
                </span>
                <div className="w-full lg:w-32 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${deal.dealName}, ${progressPercent}% pipeline progress`}
                    className={cn(
                      "h-full rounded-full transition-all duration-[350ms] ease-out",
                      deal.status === "Won" ? "bg-success" : deal.status === "Lost" ? "bg-danger" : "bg-[var(--primary)]"
                    )}
                    style={{ width: `${deal.status === "Lost" ? 0 : progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Primary actions */}
            <div className="relative flex items-center gap-2 mt-5 pt-4 border-t border-border">
              {canEditOpportunity(user, deal) && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="h-9 flex items-center justify-center px-4 bg-[var(--primary)] text-white text-xs font-bold rounded-lg hover:bg-[var(--primary-hover)] transition-colors gap-1.5"
                >
                  <Edit3 size={15} /> Edit Opportunity
                </button>
              )}
              {canAddFollowUp(user, deal) && (
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="h-9 flex items-center justify-center px-4 bg-card text-text-secondary border border-border text-xs font-bold rounded-lg hover:bg-card-hover transition-colors gap-1.5"
                >
                  <Calendar size={15} /> Add Follow-Up
                </button>
              )}
              {user?.role !== "Customer" && ["ProposalSent", "Negotiation"].includes(deal.status) && (
                <button
                  onClick={() => router.push(`/rfq/new?opportunityId=${deal.id}`)}
                  className="h-9 flex items-center justify-center px-4 bg-card text-text-secondary border border-border text-xs font-bold rounded-lg hover:bg-card-hover transition-colors gap-1.5"
                >
                  <MessageSquare size={15} /> Create RFQ
                </button>
              )}
              {user?.role !== "Customer" && ["ProposalSent", "Negotiation"].includes(deal.status) && (
                <button
                  onClick={() => router.push(`/quotations/new?opportunityId=${deal.id}`)}
                  className="h-9 flex items-center justify-center px-4 bg-card text-text-secondary border border-border text-xs font-bold rounded-lg hover:bg-card-hover transition-colors gap-1.5"
                >
                  <FileText size={15} /> Direct Quotation
                </button>
              )}
            </div>
          </div>

          {/* ─── Active Stage Details Form ─── */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-[var(--primary)]" />
                <h3 className="text-lg font-bold text-text-primary">Stage Actions</h3>
              </div>
              {deal.status !== "Won" && deal.status !== "Lost" && deal.status !== "Rejected" && canChangeStage(user, deal) && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-3 py-1.5 bg-danger/10 text-danger-text font-bold text-xs rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-1.5 border border-danger/25"
                >
                  <XCircle size={13} /> Mark Rejected
                </button>
              )}
            </div>

            {/* Interactive pipeline stepper — completed and active stages are clickable for review/edit */}
            <div className="mb-6 px-4 py-3 bg-page-bg rounded-xl border border-border">
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
                          "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors",
                          isClickable ? "cursor-pointer hover:bg-card-hover" : "cursor-default",
                          stepState === "active" && "bg-card shadow-sm border border-border",
                          isViewing && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        )}
                        title={tooltip}
                      >
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border-2 transition-all bg-page-bg",
                            stepState === "completed" && "bg-success text-white border-success",
                            stepState === "active" && "bg-[var(--primary)] text-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20",
                            stepState === "future" && "text-text-muted border-border",
                            isTerminal && (deal.status === "Rejected" ? "bg-warning-bg text-warning-text border-warning-border" : "bg-danger-bg text-danger-text border-danger-border")
                          )}
                        >
                          {stepState === "completed" ? <CheckCircle size={12} /> : idx + 1}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-semibold whitespace-nowrap",
                            stepState === "active" ? "text-[var(--primary)]" : stepState === "completed" ? "text-success" : isTerminal ? (deal.status === "Rejected" ? "text-warning-text" : "text-danger-text") : "text-text-muted"
                          )}
                        >
                          {stage.label}
                        </span>
                      </div>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <div className={cn("w-8 h-0.5 mx-1", stepState === "completed" ? "bg-success" : "bg-border")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {renderStageForm()}
          </div>

      {/* ─── Competitor Intelligence ─── */}
      <CollapsibleSection
        title="Competitor Intelligence"
        subtitle="Track competitors and win/loss insights"
        icon={<Swords size={15} />}
        defaultOpen={false}
        bodyClassName="pt-4"
      >
        <CompetitorIntelligenceTab entity={{ dealId: deal.id, customerId: deal.customerId, currentStage: deal.status }} />
      </CollapsibleSection>

      {/* ─── Documents ─── */}
      <CollapsibleSection
        title="Documents"
        subtitle="Upload and manage deal-related files"
        icon={<FolderOpen size={15} />}
        defaultOpen={false}
        bodyClassName="pt-4"
      >
        <EntityDocumentTab entityType="Deal" entityId={deal.id} />
      </CollapsibleSection>

      {/* ─── Stage History Timeline ─── */}
      {deal.stageHistories && deal.stageHistories.length > 0 && (
        <CollapsibleSection
          title="Stage History"
          subtitle={`${deal.stageHistories.length} stage transition${deal.stageHistories.length !== 1 ? "s" : ""}`}
          icon={<History size={15} />}
          defaultOpen={false}
          bodyClassName="pt-4"
        >
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
        </CollapsibleSection>
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
      </div>

      {/* ── Column 3: Right — Context / Summary Rail ── */}
      <div className="hidden md:flex w-[280px] xl:w-[320px] shrink-0 border-l border-border flex-col bg-page-bg overflow-y-auto h-full">
        {/* Deal Summary */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-page-bg shrink-0 h-[50px]">
          <span className="text-text-muted"><TrendingUp size={14} /></span>
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Deal Summary</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Stage badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                STAGE_PILL[deal.status] ||
                  "bg-border text-text-muted border-border"
              )}
            >
              {STAGE_DISPLAY_LABELS[deal.status] || deal.status}
            </span>
            {deal.opportunityCode && (
              <span className="text-[10px] font-mono text-text-muted">
                {deal.opportunityCode}
              </span>
            )}
          </div>

          {/* Summary rows */}
          <div className="crm-card border border-border rounded-xl divide-y divide-border-subtle overflow-hidden bg-card">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-[11px] text-text-muted shrink-0 w-20">{row.label}</span>
                <div className="flex-1 min-w-0 flex justify-end">{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quotation Status */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-t border-border bg-page-bg shrink-0 h-[50px]">
          <span className="text-text-muted"><Clock size={14} /></span>
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Quotation Status</span>
        </div>
        <div className="p-4">
          {linkedQuotations.length === 0 ? (
            <div className="px-3 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
              No quotation created yet
            </div>
          ) : hasAcceptedQuotation ? (
            <div className="px-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ✅ Quotation Accepted
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">
                {linkedQuotations[0]?.quotationCode} •{" "}
                {formatCurrency(linkedQuotations[0]?.finalAmount || linkedQuotations[0]?.totalAmount || 0)}
              </p>
            </div>
          ) : linkedQuotations.some((q: any) => q.status === "Sent") ? (
            <div className="px-3 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                ⏳ Awaiting Customer Response
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-500 mt-0.5">
                {linkedQuotations[0]?.quotationCode}
              </p>
            </div>
          ) : (
            <div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border">
              <p className="text-xs font-bold text-text-secondary">
                📋 {linkedQuotations.length} quotation{linkedQuotations.length !== 1 ? "s" : ""} — Draft
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {linkedQuotations[0]?.quotationCode}
              </p>
            </div>
          )}
        </div>

        {/* Stakeholders */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-t border-border bg-page-bg shrink-0 h-[50px]">
          <span className="text-text-muted"><Users size={14} /></span>
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Stakeholders</span>
        </div>
        <div className="p-4 space-y-1.5">
          {contacts.length === 0 ? (
            <p className="text-xs text-text-muted italic text-center py-2">
              No stakeholders linked
            </p>
          ) : (
            contacts.slice(0, 5).map((c: any) => (
              <div
                key={c.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-card-hover transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[var(--primary)]">
                    {(c.contact?.name || c.name || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    {c.contact?.name || c.name || "—"}
                  </p>
                  {c.stakeholderRole && (
                    <span
                      className={cn(
                        "inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5",
                        ROLE_COLORS[c.stakeholderRole] || "bg-border text-text-muted"
                      )}
                    >
                      {c.stakeholderRole}
                    </span>
                  )}
                </div>
                {c.isPrimary && (
                  <span className="text-[10px] font-bold text-[var(--primary)] shrink-0">
                    Primary
                  </span>
                )}
              </div>
            ))
          )}
          {contacts.length > 5 && (
            <p className="text-[11px] text-text-muted text-center">
              +{contacts.length - 5} more
            </p>
          )}
        </div>

        {/* Stage History */}
        {deal.stageHistories && deal.stageHistories.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-t border-border bg-page-bg shrink-0 h-[50px]">
              <span className="text-text-muted"><History size={14} /></span>
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Stage History</span>
            </div>
            <div className="p-4">
              <div className="relative pl-3 space-y-3">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border-subtle rounded-full" />
                {deal.stageHistories.slice(0, 6).map((h: any) => (
                  <div key={h.id} className="relative pl-4">
                    <div className="absolute -left-[3px] top-[5px] w-2 h-2 rounded-full border-2 border-border bg-card z-10" />
                    <p className="text-[11px] font-bold text-text-primary leading-tight">
                      {STAGE_DISPLAY_LABELS[h.toStatus] || h.toStatus}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {formatDate(h.changedAt)}
                      {h.changedBy?.name ? ` · ${h.changedBy.name}` : ""}
                    </p>
                    {h.durationInPreviousStage !== null && (
                      <p className="text-[10px] text-text-muted">
                        {h.durationInPreviousStage}d in previous stage
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Next Action Guidance */}
        {deal.status !== "Won" && deal.status !== "Lost" && deal.status !== "Rejected" && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-t border-border bg-page-bg shrink-0 h-[50px]">
              <span className="text-text-muted"><Calendar size={14} /></span>
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Next Action</span>
            </div>
            <div className="p-4">
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-3">
                <p className="text-[11px] font-semibold text-[var(--primary)] mb-1">
                  {deal.status === "Qualified" && "📋 Gather requirements to advance"}
                  {deal.status === "RequirementGathering" && "📅 Schedule a meeting or demo"}
                  {deal.status === "MeetingScheduled" && "🎯 Conduct the meeting/demo"}
                  {deal.status === "DemoConducted" && "💼 Create and send a quotation"}
                </p>
                <p className="text-[11px] text-text-muted">
                  {deal.status === "Qualified" &&
                    "Fill in the Req. Gathering form and save all required fields."}
                  {deal.status === "RequirementGathering" &&
                    "Fill meeting details and move to Meeting Scheduled."}
                  {deal.status === "MeetingScheduled" &&
                    "Record meeting outcome and advance to Demo Conducted."}
                  {deal.status === "DemoConducted" &&
                    "Use the Quotation section to create an offer for the customer."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
