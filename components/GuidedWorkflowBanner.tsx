"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
  AlertCircle,
  Undo2,
  Briefcase,
} from "lucide-react";
import { updateLeadAction } from "@/app/actions/leads";
import { cancelFollowUpAction } from "@/app/actions/followUps";
import { updateDealStatusAction } from "@/app/actions/deals";

type BannerProps = {
  entityType: "lead" | "followup" | "deal";
  entityId: string;
  status: string;
  entityName?: string;
  customerId?: string | null;
  onRefresh?: () => void;
};

export default function GuidedWorkflowBanner({
  entityType,
  entityId,
  status,
  entityName = "",
  customerId = null,
  onRefresh,
}: BannerProps) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
  };

  // 1. Leads Workflow Actions
  const handleMarkSQL = async () => {
    setLoading(true);
    const res = await updateLeadAction(entityId, { status: "SQL" });
    setLoading(false);
    if (res.success) {
      toast.success("Lead marked as SQL (Sales Qualified Lead).");
      handleRefresh();
    } else {
      toast.error(res.message);
    }
  };

  const handleMarkLeadLost = async () => {
    setLoading(true);
    const res = await updateLeadAction(entityId, { status: "Lost" });
    setLoading(false);
    if (res.success) {
      toast.success("Lead marked as Lost.");
      setShowLostModal(false);
      handleRefresh();
    } else {
      toast.error(res.message);
    }
  };

  // 2. Follow-Ups Workflow Actions
  const handleCancelFollowUp = async (regress: boolean) => {
    setLoading(true);
    const res = await cancelFollowUpAction({
      id: entityId,
      notes: "Cancelled via Guided Workflow Banner",
      moveBackToLeads: regress,
    });
    setLoading(false);
    if (res.success) {
      toast.success(
        regress
          ? "Follow-up cancelled and Lead status reset to New."
          : "Follow-up cancelled."
      );
      handleRefresh();
    } else {
      toast.error(res.message);
    }
  };

  // 3. Deals Workflow Actions
  const handleMarkDealWon = async () => {
    setLoading(true);
    const res = await updateDealStatusAction(entityId, "Won");
    setLoading(false);
    if (res.success) {
      toast.success("Deal marked Won! Proceeding to Sales Pipeline opportunity stage.");
      handleRefresh();
    } else {
      toast.error(res.message);
    }
  };

  const handleMarkDealLostWithReason = async () => {
    if (!lostReason.trim()) {
      toast.error("Please provide a reason for losing the deal.");
      return;
    }
    setLoading(true);
    const res = await updateDealStatusAction(entityId, "Lost", lostReason);
    setLoading(false);
    if (res.success) {
      toast.success("Deal status updated to Lost.");
      setShowLostModal(false);
      handleRefresh();
    } else {
      toast.error(res.message);
    }
  };

  // Render variables depending on state
  let title = "";
  let description = "";
  let actions: React.ReactNode = null;
  let bgClass = "bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20";
  let icon = <AlertCircle className="text-blue-500 shrink-0" size={20} />;

  if (entityType === "lead") {
    if (status === "New") {
      title = "New Lead Ingested";
      description = "Next Action: Review contact details and qualify the lead to Sales Qualified Leads (SQL) to meet response SLA.";
      actions = (
        <div className="flex gap-2">
          <button
            onClick={handleMarkSQL}
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <CheckCircle size={14} /> Mark SQL
          </button>
          <button
            onClick={() => setShowLostModal(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-all"
          >
            Mark Lost
          </button>
        </div>
      );
    } else if (status === "SQL") {
      title = "Lead is Sales Qualified (SQL)";
      description = "Next Action: Move to Follow-Up. Schedule a meeting with the client to begin qualification.";
      bgClass = "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20";
      icon = <CheckCircle className="text-emerald-500 shrink-0" size={20} />;
      actions = (
        <button
          onClick={() => router.push(`/follow-up?action=create&leadId=${entityId}`)}
          className="btn-primary text-xs flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
        >
          <Calendar size={14} /> Move to Follow-Up <ArrowRight size={12} />
        </button>
      );
    } else if (status === "Lost") {
      title = "Lead Closed Lost";
      description = "No further actions required. Lead is stored in archive.";
      bgClass = "bg-gradient-to-r from-slate-500/10 to-transparent border-slate-200";
      icon = <XCircle className="text-slate-400 shrink-0" size={20} />;
    }
  } else if (entityType === "followup") {
    if (status === "Pending") {
      title = "Follow-Up Scheduled";
      description = "Next Action: Contact client and conduct the follow-up meeting. Then record notes and complete.";
      actions = (
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/follow-up?action=complete&id=${entityId}`)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <CheckCircle size={14} /> Complete Follow-Up
          </button>
          <button
            onClick={() => handleCancelFollowUp(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
            title="Cancel follow-up and regress Lead to New"
          >
            Cancel (Regress Lead)
          </button>
        </div>
      );
    } else if (status === "Completed") {
      title = "Follow-Up Completed";
      description = "Next Action: Proceed to opportunity. Create a new deal to track financial pipelines.";
      bgClass = "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20";
      icon = <CheckCircle className="text-emerald-500 shrink-0" size={20} />;
      actions = (
        <button
          onClick={() =>
            router.push(
              `/deals?action=create&leadId=${entityId}${
                customerId ? `&customerId=${customerId}` : ""
              }`
            )
          }
          className="btn-primary text-xs flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
        >
          <Plus size={14} /> Create Deal <ArrowRight size={12} />
        </button>
      );
    } else if (status === "Cancelled") {
      title = "Follow-Up Cancelled";
      description = "Next Action: You can regress the associated lead back to the Leads pipeline to re-assign or restart.";
      bgClass = "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20";
      icon = <Undo2 className="text-amber-500 shrink-0" size={20} />;
      actions = (
        <button
          onClick={() => handleCancelFollowUp(true)}
          disabled={loading}
          className="btn-primary text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
        >
          <Undo2 size={14} /> Move Back to Leads
        </button>
      );
    }
  } else if (entityType === "deal") {
    // BRD Variant 1 pipeline stages — guide toward Active Deal conversion
    if (["SalesOpportunity", "RequirementGathering", "MeetingScheduled"].includes(status)) {
      title = `Pipeline Stage: ${status.replace(/([A-Z])/g, " $1").trim()}`;
      description = "Next Action: Complete the requirement gathering and schedule a customer meeting, then convert to an Active Deal.";
      bgClass = "bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20";
      icon = <Briefcase className="text-blue-500 shrink-0" size={20} />;
      actions = (
        <button
          onClick={() => router.push(`/sales-pipeline/${entityId}`)}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <ArrowRight size={14} /> Open Opportunity <ArrowRight size={12} />
        </button>
      );
    } else if (status === "Active") {
      title = "Active Deal";
      description = "Next Action: Close this deal. Mark as Won when customer confirms, or Lost if the opportunity is no longer viable.";
      bgClass = "bg-gradient-to-r from-indigo-500/10 to-transparent border-indigo-500/20";
      icon = <CheckCircle className="text-indigo-500 shrink-0" size={20} />;
      actions = (
        <div className="flex gap-2">
          <button
            onClick={handleMarkDealWon}
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
          >
            <CheckCircle size={14} /> Mark Won
          </button>
          <button
            onClick={() => setShowLostModal(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-all"
          >
            Mark Lost
          </button>
        </div>
      );
    } else if (status === "Won") {
      title = "Deal Closed Won";
      description = "This deal has been successfully won! It is now tracked in the active pipeline.";
      bgClass = "bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20";
      icon = <CheckCircle className="text-emerald-500 shrink-0" size={20} />;
    } else if (status === "Lost") {
      title = "Deal Closed Lost";
      description = "Deal is marked as Lost. Review the audit logs for pricing or product-fit regression reasons.";
      bgClass = "bg-gradient-to-r from-red-500/10 to-transparent border-red-500/20";
      icon = <XCircle className="text-red-500 shrink-0" size={20} />;
    }
  }

  return (
    <div className={`p-4 rounded-2xl border ${bgClass} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 relative overflow-hidden shadow-sm`}>
      {/* Background visual highlight */}
      <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start gap-3.5">
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 mt-0.5 shrink-0">
          {icon}
        </div>
        <div className="space-y-1">
          <h4 className="text-[13.5px] font-bold text-slate-800 tracking-wide flex items-center gap-2">
            {title}
            {entityName && (
              <span className="text-slate-400 font-normal">({entityName})</span>
            )}
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
      </div>

      {actions && (
        <div className="shrink-0 flex items-center md:justify-end">
          {actions}
        </div>
      )}

      {/* Lost Reason Modal Dialog */}
      {showLostModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-slate-800">Specify Reason for Closed Lost</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Please provide a short explanation or reason why this {entityType} was lost. This will be stored in the audit history.
            </p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Price too high, client selected competitor, budget constraints..."
              rows={3}
              className="mt-4 w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] bg-slate-50"
            />
            <div className="flex justify-end gap-2.5 mt-5">
              <button
                onClick={() => setShowLostModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={
                  entityType === "lead" ? handleMarkLeadLost : handleMarkDealLostWithReason
                }
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
