"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6",
  x: "M6 18L18 6M6 6l12 12",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
  send: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  check: "M5 13l4 4L19 7",
};

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Sent: "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-gray-100 text-gray-500",
};

const statusTimeline = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void; input?: boolean; inputLabel?: string }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [rejectReason, setRejectReason] = useState("");

  const loadQuotation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (data.success) setQuotation(data.data);
    } catch { toast.error("Failed to load quotation"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadQuotation();
    // Trigger expire cron in dev
    if (process.env.NODE_ENV === "development") {
      fetch("/api/cron/quotations-expire").catch(() => {});
    }
  }, [id]);

  const handleSend = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation sent"); loadQuotation(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleAccept = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation accepted"); loadQuotation(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleReject = () => {
    setConfirmState({
      isOpen: true,
      title: "Reject Quotation",
      message: "Please provide a rejection reason.",
      input: true,
      inputLabel: "Rejection Reason",
      action: async () => {
        if (!rejectReason) { toast.error("Rejection reason is required"); return; }
        try {
          const res = await fetch(`/api/quotations/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rejectionReason: rejectReason }),
          });
          const data = await res.json();
          if (data.success) { toast.success("Quotation rejected"); setRejectReason(""); loadQuotation(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation duplicated"); router.push(`/quotations/${data.data.id}`); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Quotation",
      message: "Are you sure you want to delete this quotation?",
      action: async () => {
        try {
          const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Quotation deleted"); router.push("/quotations"); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  if (loading) return <PageContainer className="p-6"><p className="text-slate-400">Loading...</p></PageContainer>;
  if (!quotation) return <PageContainer className="p-6"><p className="text-slate-400">Quotation not found</p></PageContainer>;

  const timelineSteps = [];
  if (quotation.status === "Draft") timelineSteps.push("Draft");
  if (quotation.sentAt || ["Sent", "UnderReview", "Accepted", "Rejected", "Expired"].includes(quotation.status)) timelineSteps.push("Sent");
  if (quotation.status === "UnderReview") timelineSteps.push("UnderReview");
  if (quotation.acceptedAt) timelineSteps.push("Accepted");
  if (quotation.rejectedAt) timelineSteps.push("Rejected");
  if (quotation.status === "Expired") timelineSteps.push("Expired");

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/quotations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.back} size={18} /></button>
          <div><h1 className="text-2xl font-bold text-slate-800">{quotation.quotationCode}</h1><p className="text-sm text-slate-500 mt-0.5">Quotation Details</p></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quotation.status === "Draft" && <button onClick={handleSend} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"><Ico d={icons.send} size={15} /> Send Quotation</button>}
          {["Sent", "UnderReview"].includes(quotation.status) && <>
            <button onClick={handleAccept} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer"><Ico d={icons.check} size={15} /> Mark Accepted</button>
            <button onClick={handleReject} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer"><Ico d={icons.x} size={15} /> Mark Rejected</button>
          </>}
          <button onClick={handleDuplicate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.copy} size={15} /> Duplicate</button>
          {quotation.status === "Draft" && <button onClick={() => router.push(`/quotations/${id}?edit=1`)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.edit} size={15} /> Edit</button>}
          <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer"><Ico d={icons.x} size={15} /> Delete</button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[quotation.status]}`}>{quotation.status}</span>
          <span className="text-sm text-slate-500">Valid Until: <strong className="text-slate-700">{new Date(quotation.validUntil).toLocaleDateString()}</strong></span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Customer</p><p className="text-sm text-slate-800">{quotation.customer?.name}</p><p className="text-xs text-slate-500">{quotation.customer?.customerCode}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</p><p className="text-sm text-slate-800">{quotation.contact?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Created By</p><p className="text-sm text-slate-800">{quotation.createdBy?.name || "—"}</p></div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-base font-bold text-slate-800">Line Items</h2></div>
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">#</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Product Code</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Description</th>
            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th>
            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Unit Price</th>
            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Total</th>
          </tr></thead>
          <tbody>
            {quotation.items?.map((item: any, idx: number) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                <td className="px-4 py-2 text-sm text-slate-700">{item.product?.productCode || "—"}</td>
                <td className="px-4 py-2 text-sm text-slate-700">{item.description}</td>
                <td className="px-4 py-2 text-sm text-slate-700 text-right">{item.quantity}</td>
                <td className="px-4 py-2 text-sm text-slate-700 text-right">₹{item.unitPrice.toFixed(2)}</td>
                <td className="px-4 py-2 text-sm font-medium text-slate-800 text-right">₹{item.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Grand Total</td>
            <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">₹{quotation.totalAmount.toFixed(2)}</td>
          </tr><tr className="bg-slate-50">
            <td colSpan={5} className="px-4 py-2 text-right text-sm text-slate-600">Discount ({quotation.discountPercent}%)</td>
            <td className="px-4 py-2 text-right text-sm text-slate-600">-₹{(quotation.totalAmount - quotation.finalAmount).toFixed(2)}</td>
          </tr><tr className="bg-slate-50">
            <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-slate-800">Final Amount</td>
            <td className="px-4 py-3 text-right text-sm font-bold text-[#D44D4D]">₹{quotation.finalAmount.toFixed(2)}</td>
          </tr></tfoot>
        </table>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Status Timeline</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {timelineSteps.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              {idx > 0 && <div className="w-8 h-0.5 bg-slate-300" />}
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusColors[step] || "bg-slate-100 text-slate-600"}`}>{step}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-xs text-slate-500">
          {quotation.sentAt && <p>Sent: {new Date(quotation.sentAt).toLocaleString()}</p>}
          {quotation.acceptedAt && <p>Accepted: {new Date(quotation.acceptedAt).toLocaleString()}</p>}
          {quotation.rejectedAt && <p>Rejected: {new Date(quotation.rejectedAt).toLocaleString()} — {quotation.rejectionReason}</p>}
        </div>
      </div>

      {/* Linked Records */}
      {(quotation.rfq || quotation.deal) && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">Linked Records</h2>
          <div className="flex gap-3 flex-wrap">
            {quotation.rfq && <button onClick={() => router.push(`/rfq/${quotation.rfq.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm text-slate-700 cursor-pointer">RFQ: {quotation.rfq.rfqCode}</button>}
            {quotation.deal && <button onClick={() => router.push(`/deals/${quotation.deal.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm text-slate-700 cursor-pointer">Deal: {quotation.deal.dealName}</button>}
          </div>
        </div>
      )}

      {quotation.termsAndConditions && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-3">Terms & Conditions</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{quotation.termsAndConditions}</p>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => { setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); setRejectReason(""); }}
        isDestructive={confirmState.title.includes("Delete")}
      />
      {confirmState.input && confirmState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">{confirmState.title}</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{confirmState.inputLabel}</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); setRejectReason(""); }} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={confirmState.action} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
