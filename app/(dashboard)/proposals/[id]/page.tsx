"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getProposalByIdAction, advanceProposalStatusAction, updateProposalAction } from "@/app/actions/proposals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { Timeline } from "@/components/ui/Timeline";
import { NotePanel } from "@/components/ui/NotePanel";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea } from "@/components/ui/FormField";
import { formatCurrency, formatDate, cn } from "@/lib/ui-utils";
import { ArrowLeft, FileText, CheckCircle, XCircle, Send, Clock, FileEdit, RefreshCw, ExternalLink, Eye } from "lucide-react";

const formatStatus = (status: string) => status.replace(/([A-Z])/g, ' $1').trim();

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const proposalId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update Revision Modal
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);
  const [reviseForm, setReviseForm] = useState({ title: "", description: "", value: "", validUntil: "", proposalPdfUrl: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProposalByIdAction(proposalId);
      if (res.success && res.data) {
        setProposal(res.data);
      } else {
        toast.error("Proposal not found.");
        router.push("/proposals");
      }
    } finally {
      setLoading(false);
    }
  }, [proposalId, router, toast]);

  useEffect(() => { load(); }, [load]);

  const handleAdvanceStatus = async (newStatus: string) => {
    if (!confirm(`Mark proposal as ${formatStatus(newStatus)}?`)) return;
    setIsSubmitting(true);
    const res = await advanceProposalStatusAction(proposalId, newStatus);
    if (res.success) {
      toast.success(res.message);
      load();
    } else {
      toast.error(res.message);
    }
    setIsSubmitting(false);
  };

  const openReviseModal = () => {
    setReviseForm({
      title: proposal.title,
      description: proposal.description || "",
      value: String(proposal.value),
      validUntil: proposal.validUntil.substring(0, 10),
      proposalPdfUrl: proposal.proposalPdfUrl || ""
    });
    setIsReviseModalOpen(true);
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(reviseForm.value);
    if (isNaN(val) || val < 0) { toast.error("Value must be a valid number."); return; }
    
    setIsSubmitting(true);
    const res = await updateProposalAction({
      id: proposalId,
      title: reviseForm.title,
      description: reviseForm.description,
      value: val,
      validUntil: new Date(reviseForm.validUntil).toISOString(),
      proposalPdfUrl: reviseForm.proposalPdfUrl,
      status: "RevisionRequested" // Automatically update status to Revision Requested on major edit
    });

    setIsSubmitting(false);
    if (res.success) {
      toast.success("New revision created.");
      setIsReviseModalOpen(false);
      load();
    } else {
      toast.error(res.message || "Failed to revise proposal.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="spinner-brand" />
          <p className="text-sm font-medium">Loading proposal details...</p>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  // Compile timeline from versions
  const timelineEvents = (proposal.versions || []).map((v: any) => ({
    id: v.id,
    type: "Version Created",
    title: `Version ${v.versionNumber}`,
    description: `Created by ${v.changedBy?.name || "System"} • Status: ${formatStatus(v.status)} • Value: ${formatCurrency(v.value)}`,
    timestamp: v.createdAt,
    color: v.status === "Accepted" ? "green" : v.status === "Rejected" ? "red" : "brand"
  }));

  const isClosed = ["Accepted", "Rejected", "Expired"].includes(proposal.status);
  const canEdit = !isClosed || ["Admin", "SuperAdmin"].includes(user?.role || "");

  return (
    <div className="page-shell max-w-5xl mx-auto space-y-5">
      {/* Back Nav */}
      <div>
        <button onClick={() => router.push("/proposals")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Proposals
        </button>
      </div>

      {/* Header card */}
      <div className="crm-card p-6 border-t-4 border-t-indigo-500">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-sm bg-indigo-50 text-indigo-600">
              <FileText size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{proposal.title}</h1>
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{proposal.proposalNumber}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm font-medium text-slate-600">
                <span>Customer: <span className="font-bold text-slate-800">{proposal.customer?.name}</span></span>
                {proposal.deal && <span>• Deal: <span className="font-bold text-slate-800">{proposal.deal.dealName}</span></span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Status</p>
              <span className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wide",
                proposal.status === "Accepted" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                proposal.status === "Rejected" ? "bg-rose-100 text-rose-700 border-rose-200" :
                proposal.status === "Draft" ? "bg-slate-100 text-slate-700 border-slate-200" :
                "bg-indigo-50 text-indigo-700 border-indigo-200"
              )}>
                {formatStatus(proposal.status)}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Proposal Value</p>
              <p className="text-2xl font-black text-[var(--primary)]">{formatCurrency(proposal.value)}</p>
            </div>
          </div>
        </div>

        {/* Workflow Action Bar */}
        {canEdit && (
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Workflow Actions:</p>
            
            {proposal.status === "Draft" && (
              <button onClick={() => handleAdvanceStatus("Sent")} disabled={isSubmitting} className="btn-secondary text-xs flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                <Send size={14} /> Mark as Sent
              </button>
            )}
            
            {["Sent", "RevisionRequested"].includes(proposal.status) && (
              <button onClick={() => handleAdvanceStatus("CustomerReviewing")} disabled={isSubmitting} className="btn-secondary text-xs flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Eye size={14} /> Customer is Reviewing
              </button>
            )}

            {["Sent", "CustomerReviewing"].includes(proposal.status) && (
              <button onClick={openReviseModal} disabled={isSubmitting} className="btn-secondary text-xs flex items-center gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50">
                <RefreshCw size={14} /> Request Revision (Edit)
              </button>
            )}

            {["Sent", "CustomerReviewing", "RevisionRequested"].includes(proposal.status) && (
              <>
                <button onClick={() => handleAdvanceStatus("Accepted")} disabled={isSubmitting} className="btn-secondary text-xs flex items-center gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle size={14} /> Mark Accepted
                </button>
                <button onClick={() => handleAdvanceStatus("Rejected")} disabled={isSubmitting} className="btn-secondary text-xs flex items-center gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50">
                  <XCircle size={14} /> Mark Rejected
                </button>
              </>
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
              <h3 className="text-sm font-bold text-slate-700">Proposal Details</h3>
              {proposal.proposalPdfUrl && (
                <a href={proposal.proposalPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                  <ExternalLink size={14} /> View PDF Document
                </a>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Valid Until</p>
                <p className={cn("text-sm font-bold flex items-center gap-2", new Date(proposal.validUntil) < new Date() ? "text-rose-600" : "text-slate-700")}>
                  <Clock size={14} />
                  {formatDate(proposal.validUntil)}
                  {new Date(proposal.validUntil) < new Date() && <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 rounded text-rose-700 ml-1">Expired</span>}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Latest Version</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileEdit size={14} className="text-indigo-500" />
                  v{proposal.versions.length > 0 ? proposal.versions[0].versionNumber : 1}
                </p>
              </div>
            </div>

            {proposal.description && (
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Description / Terms</p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
                  {proposal.description}
                </div>
              </div>
            )}
          </div>

          {/* Notes Integration */}
          <div>
            <NotePanel entityType="PROPOSAL" entityId={proposal.id} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Version History */}
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <RefreshCw size={16} className="text-slate-400" />
              Version History
            </h3>
            {timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No versions logged</p>
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>
        </div>
      </div>

      {/* Revise Proposal Modal */}
      <Modal
        open={isReviseModalOpen}
        onClose={() => setIsReviseModalOpen(false)}
        title="Create New Revision"
        subtitle="Update the proposal details. This will log a new version."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setIsReviseModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="revise-form" disabled={isSubmitting} className="btn-primary text-sm bg-indigo-600 hover:bg-indigo-700">
              {isSubmitting ? <><span className="spinner-white w-4 h-4" /> Saving...</> : "Save Revision"}
            </button>
          </>
        }
      >
        <form id="revise-form" onSubmit={handleReviseSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Proposal Title" required className="md:col-span-2">
              <Input value={reviseForm.title} onChange={e => setReviseForm(p => ({ ...p, title: e.target.value }))} required />
            </FormField>
            
            <FormField label="Revised Value" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                <Input
                  type="number" step="0.01" min="0"
                  value={reviseForm.value} onChange={e => setReviseForm(p => ({ ...p, value: e.target.value }))}
                  className="pl-7" required
                />
              </div>
            </FormField>

            <FormField label="Valid Until" required>
              <Input type="date" value={reviseForm.validUntil} onChange={e => setReviseForm(p => ({ ...p, validUntil: e.target.value }))} required />
            </FormField>

            <FormField label="PDF Link (Optional)" className="md:col-span-2">
              <Input type="url" value={reviseForm.proposalPdfUrl} onChange={e => setReviseForm(p => ({ ...p, proposalPdfUrl: e.target.value }))} placeholder="https://..." />
            </FormField>

            <FormField label="Description / Terms" className="md:col-span-2">
              <Textarea value={reviseForm.description} onChange={e => setReviseForm(p => ({ ...p, description: e.target.value }))} rows={4} />
            </FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}
