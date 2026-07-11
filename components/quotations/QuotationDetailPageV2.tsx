"use client";

import { useQuotationDetail } from "@/hooks/useQuotationDetail";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { ConfirmModal } from "@/components/ConfirmModal";
import QuotationActionBar from "./QuotationActionBar";
import QuotationStageTracker from "./QuotationStageTracker";
import QuotationNextStepBanner from "./QuotationNextStepBanner";
import QuotationStatusTimeline from "./QuotationStatusTimeline";
import QuotationSummaryCard from "./QuotationSummaryCard";
import QuotationTabs from "./QuotationTabs";
import { Ico, icons } from "./QuotationIcons";

export default function QuotationDetailPageV2() {
  const q = useQuotationDetail();
  const { formatCurrency } = useCurrency();
  const toast = useToast();

  if (q.loading) {
    return (
      <PageContainer className="p-6">
        <p className="text-slate-400">Loading...</p>
      </PageContainer>
    );
  }

  if (q.notFound) {
    return (
      <PageContainer className="p-6">
        <p className="text-slate-400">Quotation not found</p>
      </PageContainer>
    );
  }

  const quotation = q.quotation!;

  return (
    <PageContainer className="space-y-6 p-0">
      <QuotationActionBar
        quotation={quotation}
        router={q.router}
        editMode={q.editMode}
        savingItems={q.savingItems}
        creatingPo={q.creatingPo}
        generatingPdf={q.generatingPdf}
        needsApproval={q.needsApproval}
        onStartEdit={q.startEdit}
        onSave={q.handleSaveItems}
        onCancel={() => q.setEditMode(false)}
        onRequestApproval={q.handleRequestApproval}
        onSend={q.handleSend}
        onNegotiate={() => q.setShowNegotiateModal(true)}
        onAccept={q.handleAccept}
        onReject={q.handleReject}
        onCreatePo={q.handleCreatePo}
        onClone={q.handleClone}
        onDownloadPdf={q.handleDownloadPdf}
        onGeneratePdf={q.handleGeneratePdf}
        onDelete={q.handleDelete}
      />

      <QuotationStageTracker
        quotation={quotation}
        onRfqClick={() => quotation.rfq?.id && q.router.push(`/rfq/${quotation.rfq.id}`)}
        onNegotiationClick={() => quotation.negotiation?.id && q.router.push(`/negotiations/${quotation.negotiation.id}`)}
      />

      <QuotationNextStepBanner
        quotation={quotation}
        needsApproval={q.needsApproval}
        latestApproval={q.latestApproval}
        triggerReasons={q.triggerReasons}
        user={q.user}
        approvalNotes={q.approvalNotes}
        onApprovalNotesChange={q.setApprovalNotes}
        onRequestApproval={q.handleRequestApproval}
        onApprovalDecision={q.handleApprovalDecision}
      />

      <QuotationStatusTimeline quotation={quotation} />

      <QuotationSummaryCard
        quotation={quotation}
        overallMargin={q.overallMargin}
        overallMarginColor={q.overallMarginColor}
        marginFloor={q.marginFloor}
        formatCurrency={formatCurrency}
      />

      <QuotationTabs
        q={q}
        quotation={quotation}
        formatCurrency={formatCurrency}
        toast={toast}
      />

      {(quotation.rfq || quotation.deal) && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6 text-xs">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Linked Records</h2>
          <div className="flex gap-3 flex-wrap">
            {quotation.rfq && <button onClick={() => q.router.push(`/rfq/${quotation.rfq.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700 cursor-pointer">RFQ: {quotation.rfq.rfqCode}</button>}
            {quotation.deal && <button onClick={() => q.router.push(`/deals/${quotation.deal.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700 cursor-pointer">Deal: {quotation.deal.dealName}</button>}
          </div>
        </section>
      )}

      {q.confirmState.input && q.confirmState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">{q.confirmState.title}</h3>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Rejection Reason ID *</label>
              <input type="text" value={q.rejectReasonId} onChange={(e) => q.setRejectReasonId(e.target.value)} placeholder="e.g. RR-001" className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Rejection Description</label>
              <textarea value={q.rejectReason} onChange={(e) => q.setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { q.setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); q.setRejectReason(""); q.setRejectReasonId(""); }} className="px-4 py-2 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">Cancel</button>
              <button onClick={q.confirmState.action} className="px-4 py-2 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={q.confirmState.isOpen}
        title={q.confirmState.title}
        message={q.confirmState.message}
        onConfirm={q.confirmState.action}
        onCancel={() => { q.setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); q.setRejectReason(""); q.setRejectReasonId(""); }}
        isDestructive={q.confirmState.title.includes("Delete")}
      />

      {q.showNegotiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Start Negotiation</h3>
              <button onClick={() => q.setShowNegotiateModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><Ico d={icons.x} size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Negotiation Type</label>
                  <select
                    value={q.negotiateForm.negotiationType}
                    onChange={(e) => q.setNegotiateForm({ ...q.negotiateForm, negotiationType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  >
                    <option value="Price">Price</option>
                    <option value="Terms">Terms</option>
                    <option value="Scope">Scope</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Negotiation Reason</label>
                  <select
                    value={q.negotiateForm.negotiationReason}
                    onChange={(e) => q.setNegotiateForm({ ...q.negotiateForm, negotiationReason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  >
                    <option value="Customer Request">Customer Request</option>
                    <option value="Competitor Match">Competitor Match</option>
                    <option value="Volume Discount">Volume Discount</option>
                    <option value="Strategic Deal">Strategic Deal</option>
                    <option value="Budget Constraint">Budget Constraint</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Customer Demands</label>
                <textarea
                  value={q.negotiateForm.customerDemands}
                  onChange={(e) => q.setNegotiateForm({ ...q.negotiateForm, customerDemands: e.target.value })}
                  rows={2}
                  placeholder="What is the customer asking for? (e.g. 10% discount, extended warranty, 30-day payment terms)"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Internal Notes</label>
                <textarea
                  value={q.negotiateForm.internalNotes}
                  onChange={(e) => q.setNegotiateForm({ ...q.negotiateForm, internalNotes: e.target.value })}
                  rows={2}
                  placeholder="Internal notes for the negotiation team (not visible to customer)"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
                The negotiation will start in <strong>Active</strong> status with no revisions yet.
                You can propose a price revision from the Negotiation detail page after starting.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => q.setShowNegotiateModal(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Cancel</button>
              <button onClick={q.handleNegotiate} disabled={q.negotiating} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-60">{q.negotiating ? "Starting..." : "Start Negotiation"}</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
