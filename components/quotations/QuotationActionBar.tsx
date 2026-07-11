"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, CheckCircle, Edit, AlertTriangle, Send, FileCode, Copy, Download, X, XCircle, Check, FileText, MoreVertical } from "lucide-react";

interface QuotationActionBarProps {
  quotation: any;
  router: { push: (url: string) => void };
  editMode: boolean;
  savingItems: boolean;
  creatingPo: boolean;
  generatingPdf: boolean;
  needsApproval: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRequestApproval: () => void;
  onSend: () => void;
  onNegotiate: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCreatePo: () => void;
  onClone: () => void;
  onDownloadPdf: () => void;
  onGeneratePdf: () => void;
  onDelete: () => void;
}

function actionButtonClass(
  variant: "primary" | "secondary" | "success" | "danger" | "warning",
  enabled: boolean
) {
  const base = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors";
  if (!enabled) return `${base} text-[var(--text-muted)] bg-[var(--surface-2)] opacity-60 cursor-not-allowed`;

  switch (variant) {
    case "primary":
      return `${base} text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer`;
    case "secondary":
      return `${base} text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border)] hover:bg-[var(--border)] cursor-pointer`;
    case "success":
      return `${base} text-white bg-[var(--status-success)] hover:opacity-90 cursor-pointer`;
    case "danger":
      return `${base} text-white bg-[var(--status-danger)] hover:opacity-90 cursor-pointer`;
    case "warning":
      return `${base} text-white bg-[var(--status-warning)] hover:opacity-90 cursor-pointer`;
  }
}

export default function QuotationActionBar({
  quotation,
  router,
  editMode,
  savingItems,
  creatingPo,
  generatingPdf,
  needsApproval,
  onStartEdit,
  onSave,
  onCancel,
  onRequestApproval,
  onSend,
  onNegotiate,
  onAccept,
  onReject,
  onCreatePo,
  onClone,
  onDownloadPdf,
  onGeneratePdf,
  onDelete,
}: QuotationActionBarProps) {
  const canEdit = quotation.status === "Draft";
  const canRequestApproval = quotation.status === "Draft" && needsApproval;
  const canSend = ["Draft", "Approved"].includes(quotation.status);
  const canNegotiate = ["Sent", "UnderReview"].includes(quotation.status);
  const canAcceptReject = ["Sent", "UnderReview"].includes(quotation.status);
  const canCreatePo = quotation.status === "Accepted";

  const hasChild = quotation.childRevisions && quotation.childRevisions.length > 0;
  const isNegotiationPriceRevision = quotation.negotiation && quotation.negotiation.status === "PriceRevision";
  const canClone = !hasChild && (["Rejected", "Expired"].includes(quotation.status) || isNegotiationPriceRevision);
  const canDelete = canEdit;

  const primaryAction: "send" | "accept" | "createPo" | null =
    quotation.status === "Draft" && !needsApproval ? "send"
    : quotation.status === "Approved" ? "send"
    : ["Sent", "UnderReview"].includes(quotation.status) ? "accept"
    : quotation.status === "Accepted" ? "createPo"
    : null;

  function OverflowMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
      }
      if (open) document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);
    if (!canClone && !canDelete) return null;
    return (
      <div ref={ref} className="relative ml-auto">
        <button onClick={() => setOpen(!open)} title="More actions" className={actionButtonClass("secondary", true)}>
          <MoreVertical size={15} />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] shadow-lg z-50 py-1">
            {canClone && (
              <button
                onClick={() => { setOpen(false); onClone(); }}
                title="Create a new revision of this quotation"
                className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] flex items-center gap-2"
              >
                <Copy size={14} /> Clone & Revise
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                title="Delete this quotation"
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <X size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <nav className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-200/40">
        {quotation.rfq ? (
          <>
            <button
              onClick={() => router.push(`/rfq/${quotation.rfq.id}`)}
              className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline transition-colors flex items-center gap-1"
            >
              📄 {quotation.rfq.rfqCode}
            </button>
            <ChevronRight size={12} className="text-slate-400" />
          </>
        ) : (
          <span className="text-slate-400">No RFQ</span>
        )}
        <span className="px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] font-bold flex items-center gap-1">
          💼 {quotation.quotationCode} {quotation.revisionNumber > 1 ? `(R${quotation.revisionNumber})` : ""}
        </span>
        {quotation.negotiation ? (
          <>
            <ChevronRight size={12} className="text-slate-400" />
            <button
              onClick={() => router.push(`/negotiations/${quotation.negotiation.id}`)}
              className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline transition-colors flex items-center gap-1"
            >
              🤝 {quotation.negotiation.negotiationCode}
            </button>
          </>
        ) : (
          <>
            <ChevronRight size={12} className="text-slate-400 opacity-40" />
            <span className="text-slate-400 italic">No Negotiation</span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/quotations")}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Back to quotations"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{quotation.quotationCode}</h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{quotation.revisionNumber || 1}</span>
              {quotation.negotiationId && (
                <a
                  href={`/negotiations/${quotation.negotiationId}`}
                  className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold hover:underline"
                  title="Linked negotiation"
                >
                  Negotiation
                </a>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Quotation Details</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editMode ? (
            <>
              <button onClick={onSave} disabled={savingItems} className={actionButtonClass("primary", true)}>
                <CheckCircle size={15} /> {savingItems ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={onCancel} className={actionButtonClass("secondary", true)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button onClick={onStartEdit} title="Edit line items, prices, and discounts" className={actionButtonClass("secondary", true)}>
                  <Edit size={15} /> Edit
                </button>
              )}

              {canRequestApproval && (
                <button onClick={onRequestApproval} title="Request manager approval for discount/margin override" className={actionButtonClass("secondary", true)}>
                  <AlertTriangle size={15} /> Request Approval
                </button>
              )}

              {canSend && (
                <button onClick={onSend} title="Send quotation to customer" className={actionButtonClass(primaryAction === "send" ? "primary" : "secondary", true)}>
                  <Send size={15} /> Send
                </button>
              )}

              {canNegotiate && (
                <button onClick={onNegotiate} title="Move quotation to negotiation" className={actionButtonClass("secondary", true)}>
                  <AlertTriangle size={15} /> Negotiate
                </button>
              )}

              {canAcceptReject && (
                <>
                  <button onClick={onAccept} title="Mark quotation as accepted by customer" className={actionButtonClass(primaryAction === "accept" ? "primary" : "secondary", true)}>
                    <Check size={15} /> Accept
                  </button>
                  <button onClick={onReject} title="Mark quotation as rejected by customer" className={actionButtonClass("secondary", true)}>
                    <XCircle size={15} /> Reject
                  </button>
                </>
              )}

              {canCreatePo && (
                <button onClick={onCreatePo} disabled={creatingPo} title="Create purchase order from this quotation" className={actionButtonClass(primaryAction === "createPo" ? "primary" : "secondary", !creatingPo)}>
                  <FileCode size={15} /> {creatingPo ? "Creating..." : "Create PO"}
                </button>
              )}

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

              <button onClick={onDownloadPdf} title="Open printable quotation view" className={actionButtonClass("secondary", true)}>
                <Download size={15} /> PDF
              </button>

              <button onClick={onGeneratePdf} disabled={generatingPdf} title="Generate and store a PDF document for this revision" className={actionButtonClass("secondary", !generatingPdf)}>
                <FileText size={15} /> {generatingPdf ? "Generating..." : "Generate PDF"}
              </button>

              <OverflowMenu />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
