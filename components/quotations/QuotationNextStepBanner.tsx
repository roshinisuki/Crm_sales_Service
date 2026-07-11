"use client";

import { Ico, icons } from "./QuotationIcons";

interface QuotationNextStepBannerProps {
  quotation: any;
  needsApproval: boolean;
  latestApproval: any;
  triggerReasons: string[];
  user: any;
  approvalNotes: string;
  onApprovalNotesChange: (value: string) => void;
  onRequestApproval: () => void;
  onApprovalDecision: (decision: "Approved" | "Rejected") => void;
}

export default function QuotationNextStepBanner({
  quotation,
  needsApproval,
  latestApproval,
  triggerReasons,
  user,
  approvalNotes,
  onApprovalNotesChange,
  onRequestApproval,
  onApprovalDecision,
}: QuotationNextStepBannerProps) {
  return (
    <>
      <section className="crm-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Next Step</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {quotation.status === "Draft" && (needsApproval ? "Manager approval required before sending to customer" : "Review line items and send to customer")}
            {quotation.status === "PendingApproval" && "Awaiting approval from manager — check Approval Center"}
            {quotation.status === "Approved" && "Quotation approved — ready to send to customer"}
            {quotation.status === "Sent" && "Customer reviewing — start negotiation if they request changes"}
            {quotation.status === "UnderReview" && "In negotiation — propose revisions or mark accepted/rejected"}
            {quotation.status === "Accepted" && "Customer accepted — create a Deal or Purchase Order"}
            {quotation.status === "Rejected" && "Quotation rejected — clone & revise to create a new version"}
            {quotation.status === "Expired" && "Quotation expired — clone & revise with updated validity"}
          </p>
        </div>
      </section>

      {quotation.status === "Draft" && needsApproval && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Ico d={icons.alert} size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-amber-800 uppercase tracking-wide">Manager approval required before sending</p>
              <ul className="list-disc list-inside text-amber-700 mt-1 pl-1 space-y-0.5">
                {triggerReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
              </ul>
              {user?.role === "Admin" && <p className="text-[10px] text-amber-600 italic mt-1">As Admin, you can approve this directly or send without approval.</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!latestApproval || latestApproval.status !== "Pending" ? (
              <button onClick={onRequestApproval} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-warning)] hover:opacity-90 transition-colors shadow-sm whitespace-nowrap">
                Request Approval
              </button>
            ) : (
              <span className="text-xs font-bold text-amber-700 uppercase bg-amber-100 px-2.5 py-1 rounded">Approval Pending</span>
            )}
            {user?.role === "Admin" && latestApproval?.status === "Pending" && (
              <button onClick={() => onApprovalDecision("Approved")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-success)] hover:opacity-90 transition-colors shadow-sm whitespace-nowrap">
                Approve Now
              </button>
            )}
          </div>
        </section>
      )}

      {latestApproval && latestApproval.status === "Pending" && (
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Ico d={icons.clock} size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-blue-800 uppercase tracking-wide">
                Awaiting approval from {latestApproval.approver?.name || "Sales Manager"}{latestApproval.requiredApproverRole ? ` (${latestApproval.requiredApproverRole})` : ""}
              </p>
              <p className="text-blue-600 mt-1">{latestApproval.notes}</p>
              {latestApproval.revisionAuthorId === user?.id && user?.role !== "Admin" && (
                <p className="text-[10px] text-blue-500 italic mt-0.5">Note: You authored this revision and cannot approve it yourself.</p>
              )}
            </div>
          </div>
          {latestApproval && (latestApproval.approverId === user?.id || user?.role === "Admin") && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" placeholder="Notes (optional)" value={approvalNotes} onChange={(e) => onApprovalNotesChange(e.target.value)} className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs w-40" />
              <button onClick={() => onApprovalDecision("Approved")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-success)] hover:opacity-90 transition-colors shadow-sm">Approve</button>
              <button onClick={() => onApprovalDecision("Rejected")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-danger)] hover:opacity-90 transition-colors shadow-sm">Reject</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
