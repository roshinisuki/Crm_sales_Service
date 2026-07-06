"use client";
import { CRMSpinner } from "@/components/CRMSpinner";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { getDealByIdAction, requestDiscountAction, resolveDiscountAction } from "@/app/actions/deals";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { NotePanel } from "@/components/ui/NotePanel";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea } from "@/components/ui/FormField";
import { getInitials, getAvatarColor, formatDateTime, cn } from "@/lib/ui-utils";
import { FieldGrid } from "@/components/shared/FieldGrid";
import { CompactUserAvatar } from "@/components/shared/UserAvatar";
import { StatusPill } from "@/components/shared/StatusPill";
import { ArrowLeft, Briefcase, User, CalendarClock, DollarSign, History, AlertCircle, Percent, Check, X } from "lucide-react";

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [deal, setDeal] = useState<any>(null);
  useSyncUrlParam(deal?.status, "status");
  const [loading, setLoading] = useState(true);
  
  // Discount Modal State
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({ discountPercent: "", remarks: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Modal State
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ approved: false, remarks: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDealByIdAction(dealId);
      if (res.success && res.data) {
        setDeal(res.data);
      } else {
        toast.error("Deal not found.");
        router.push("/deals");
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, router, toast]);

  useEffect(() => { load(); }, [load]);

  const handleRequestDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    const percent = parseFloat(discountForm.discountPercent);
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      toast.error("Enter a valid discount percentage (1-100).");
      return;
    }

    setIsSubmitting(true);
    const res = await requestDiscountAction({
      dealId,
      discountPercent: percent,
      notes: discountForm.remarks
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message);
      setIsDiscountModalOpen(false);
      load();
    } else {
      toast.error(res.message || "Failed to request discount.");
    }
  };

  const handleResolveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await resolveDiscountAction({
      dealId,
      approved: approvalForm.approved,
      notes: approvalForm.remarks
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message);
      setIsApprovalModalOpen(false);
      load();
    } else {
      toast.error(res.message || "Failed to resolve discount.");
    }
  };

  const openApproval = (approved: boolean) => {
    setApprovalForm({ approved, remarks: "" });
    setIsApprovalModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading deal details..." /></div>
    );
  }

  if (!deal) return null;

  const initials = getInitials(deal.dealName);
  const avatarColor = getAvatarColor(deal.dealName);

  // Compile timeline from stageHistories
  const timelineEvents = (deal.stageHistories || []).map((h: any) => ({
    id: h.id,
    type: "Stage Change",
    title: h.toStatus,
    description: `Changed by ${h.changedBy?.name || "System"}. ${h.reason ? `Reason: ${h.reason}` : ""}`,
    timestamp: h.changedAt,
    color: h.toStatus === "Won" ? "green" : h.toStatus === "Lost" ? "red" : h.toStatus === "ApprovalQueue" ? "amber" : "brand"
  }));

  const canApprove = ["Admin", "SalesManager", "SuperAdmin"].includes(user?.role || "");
  const isVariant2 = (user?.variant || user?.company?.variant || 1) >= 2;

  return (
    <div className="page-shell max-w-5xl mx-auto space-y-5">
      {/* Back Nav */}
      <div>
        <button
          onClick={() => router.push("/deals")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Back to Deals
        </button>
      </div>

      {/* Header card */}
      <div className="crm-card p-6 border-t-4 border-t-blue-500">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm text-white", avatarColor)}>
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{deal.dealName}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-slate-400" /> {deal.customer?.name}
                </span>
                <StatusBadge status={deal.status} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deal Value</p>
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(deal.dealValue)}</p>
            </div>
          </div>
        </div>

        {/* Discount Banner Alert */}
        {deal.discountStatus === "Pending" && (
          <div className="mt-5 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-600 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="font-bold text-amber-900 text-sm">Discount Approval Required</h3>
                <p className="text-amber-800 text-xs mt-1">A discount of {deal.discountPercent}% has been requested. The deal is locked until the manager approves or rejects it.</p>
                {deal.discountNotes && <p className="text-amber-700 text-xs mt-1 italic">"{deal.discountNotes}"</p>}
              </div>
            </div>
            {canApprove && (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openApproval(false)} className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors">Reject</button>
                <button onClick={() => openApproval(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm">Approve</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="crm-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">Deal Information</h3>
              {isVariant2 && deal.status === "Negotiation" && !deal.isLocked && (
                <button 
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                >
                  <Percent size={14} /> Request Discount
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Expected Close</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <CalendarClock size={14} className="text-[var(--primary)]" />
                  {new Date(deal.expectedCloseDate).toLocaleDateString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Assigned Executive</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User size={14} className="text-blue-500" />
                  {deal.assignedUser?.name || "Unassigned"}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Discount Status</p>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded",
                    deal.discountStatus === "Approved" ? "bg-emerald-100 text-emerald-700" :
                    deal.discountStatus === "Rejected" ? "bg-rose-100 text-rose-700" :
                    deal.discountStatus === "Pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {deal.discountStatus}
                  </span>
                  {deal.discountPercent > 0 && <span className="text-sm font-bold text-slate-700">{deal.discountPercent}%</span>}
                  {deal.isLocked && <span className="text-[10px] font-bold text-red-500 ml-2 border border-red-200 px-1 rounded">LOCKED</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Notes Integration */}
          <div>
            <NotePanel entityType="DEAL" entityId={deal.id} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Stage History */}
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <History size={16} className="text-slate-400" />
              Stage History
            </h3>
            {timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No history available</p>
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>
        </div>
      </div>

      {/* Discount Request Modal */}
      <Modal
        open={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        title="Request Discount"
        subtitle="Submit a discount request for manager approval"
        footer={
          <>
            <button type="button" onClick={() => setIsDiscountModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleRequestDiscount} disabled={isSubmitting} className="btn-primary text-sm flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)]">
              {isSubmitting ? <span className="spinner-white w-4 h-4" /> : <Percent size={14} />} Request
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Discount Percentage (%)" required>
            <Input 
              type="number" step="0.1" min="0.1" max="100"
              value={discountForm.discountPercent} 
              onChange={e => setDiscountForm(p => ({ ...p, discountPercent: e.target.value }))}
              placeholder="e.g. 15"
            />
          </FormField>
          <FormField label="Reason for Discount" required>
            <Textarea 
              value={discountForm.remarks}
              onChange={e => setDiscountForm(p => ({ ...p, remarks: e.target.value }))}
              placeholder="Explain why this discount is necessary to win the deal..."
              rows={3}
            />
          </FormField>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800 font-medium">Note: Requesting a discount will lock this deal and move it to the Approval Queue until a manager reviews it.</p>
          </div>
        </div>
      </Modal>

      {/* Resolve Approval Modal */}
      <Modal
        open={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        title={approvalForm.approved ? "Approve Discount" : "Reject Discount"}
        subtitle={`You are about to ${approvalForm.approved ? "approve" : "reject"} the ${deal.discountPercent}% discount request.`}
        footer={
          <>
            <button type="button" onClick={() => setIsApprovalModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button 
              onClick={handleResolveDiscount} 
              disabled={isSubmitting} 
              className={cn("text-sm font-bold px-4 py-2 rounded-xl text-white shadow-sm flex items-center gap-2", approvalForm.approved ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)]" : "bg-rose-600 hover:bg-rose-700")}
            >
              {isSubmitting ? <span className="spinner-white w-4 h-4" /> : approvalForm.approved ? <Check size={16} /> : <X size={16} />} 
              Confirm {approvalForm.approved ? "Approval" : "Rejection"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Manager Remarks (Optional)">
            <Textarea 
              value={approvalForm.remarks}
              onChange={e => setApprovalForm(p => ({ ...p, remarks: e.target.value }))}
              placeholder="Add your comments regarding this decision..."
              rows={3}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

