"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  x: "M6 18L18 6M6 6l12 12",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
  send: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  check: "M5 13l4 4L19 7",
  deal: "M9 7h6m0 10v-3m-6 3v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2",
  alert: "M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  history: "M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8",
  plus: "M12 4v16m8-8H4",
};

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Sent: "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-gray-100 text-gray-500",
};

const DISCOUNT_THRESHOLD = 10;

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const currencySymbol = CURRENCY_SYMBOLS[preferredCurrency as keyof typeof CURRENCY_SYMBOLS] || "Rs.";

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "history" | "revisions" | "approvals" | "documents">("items");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void; input?: boolean; inputLabel?: string }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonId, setRejectReasonId] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editValidUntil, setEditValidUntil] = useState("");
  const [editTerms, setEditTerms] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editDeliveryTerms, setEditDeliveryTerms] = useState("");
  const [editFreightTerms, setEditFreightTerms] = useState("");
  const [editLeadTimeDays, setEditLeadTimeDays] = useState("");
  const [savingItems, setSavingItems] = useState(false);
  const [productSearch, setProductSearch] = useState<{ idx: number; query: string } | null>(null);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [approvalNotes, setApprovalNotes] = useState("");
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useGlobalLoading();

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
  }, [id]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && quotation?.status === "Draft") {
      startEdit();
    }
  }, [searchParams, quotation]);

  const startEdit = () => {
    if (!quotation) return;
    setEditItems((quotation.items || []).map((it: any) => ({
      id: it.id,
      productId: it.productId || "",
      description: it.description || "",
      quantity: String(it.quantity),
      unitPrice: String(it.unitPrice),
      discountPercent: String(it.discountPercent || 0),
      taxPercent: String(it.taxPercent || 18),
      hsn: it.hsn || "",
      unit: it.unit || "Nos",
      notes: it.notes || "",
    })));
    setEditDiscount(quotation.discountPercent || 0);
    setEditValidUntil(quotation.validUntil ? quotation.validUntil.substring(0, 10) : "");
    setEditTerms(quotation.termsAndConditions || "");
    setEditPaymentTerms(quotation.paymentTerms || "");
    setEditDeliveryTerms(quotation.deliveryTerms || "");
    setEditFreightTerms(quotation.freightTerms || "");
    setEditLeadTimeDays(quotation.leadTimeDays ? String(quotation.leadTimeDays) : "");
    setEditMode(true);
  };

  const handleSaveItems = async () => {
    setSavingItems(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems.map((it) => ({
            productId: it.productId || null,
            description: it.description,
            quantity: parseFloat(it.quantity) || 0,
            unitPrice: parseFloat(it.unitPrice) || 0,
            discountPercent: parseFloat(it.discountPercent) || 0,
            taxPercent: parseFloat(it.taxPercent) || 18,
            hsn: it.hsn || null,
            unit: it.unit || null,
            notes: it.notes || null,
          })),
          discountPercent: editDiscount,
          validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : undefined,
          termsAndConditions: editTerms,
          paymentTerms: editPaymentTerms,
          deliveryTerms: editDeliveryTerms,
          freightTerms: editFreightTerms,
          leadTimeDays: editLeadTimeDays || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Quotation updated — totals recomputed server-side");
        setEditMode(false);
        loadQuotation();
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch { toast.error("Failed to save"); }
    finally { setSavingItems(false); }
  };

  const addEditItem = () => {
    setEditItems([...editItems, { id: `new_${Date.now()}`, productId: "", description: "", quantity: "1", unitPrice: "0", discountPercent: "0", taxPercent: "18", hsn: "", unit: "Nos", notes: "" }]);
  };

  const removeEditItem = (idx: number) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const updateEditItem = (idx: number, field: string, value: string) => {
    setEditItems(editItems.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const searchProducts = async (query: string, idx: number) => {
    setProductSearch({ idx, query });
    if (query.length < 2) { setProductResults([]); return; }
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success) setProductResults(data.data || []);
    } catch { setProductResults([]); }
  };

  const selectProduct = (product: any, idx: number) => {
    setEditItems(editItems.map((it, i) => (i === idx ? {
      ...it,
      productId: product.id,
      description: product.name,
      unitPrice: String(product.unitPrice || product.basePrice || 0),
      hsn: product.productCode || "",
      unit: product.unitOfMeasure || "Nos",
    } : it)));
    setProductSearch(null);
    setProductResults([]);
  };

  const handleSend = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation sent to customer"); loadQuotation(); }
      else if (res.status === 402 && data.requires_approval) {
        toast.error(data.message || "Manager approval required before sending");
      }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleAccept = async () => {
    startLoading("Confirming quotation...", "handshake");
    try {
      const res = await fetch(`/api/quotations/${id}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation accepted — deal won, account activated, RFQ closed"); loadQuotation(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
    finally { stopLoading(); }
  };

  const handleNegotiate = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/negotiate`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation moved to negotiation"); loadQuotation(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleReject = () => {
    setRejectReason("");
    setRejectReasonId("");
    setConfirmState({
      isOpen: true,
      title: "Reject Quotation",
      message: "Please provide a rejection reason ID and description.",
      input: true,
      inputLabel: "Rejection Reason",
      action: async () => {
        if (!rejectReasonId) { toast.error("Rejection reason ID is required"); return; }
        try {
          const res = await fetch(`/api/quotations/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rejectionReasonId: rejectReasonId, rejectionReasonText: rejectReason }),
          });
          const data = await res.json();
          if (data.success) { toast.success("Quotation rejected"); setRejectReason(""); setRejectReasonId(""); loadQuotation(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const handleClone = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/clone`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Cloned as ${data.data.quotationCode} (R${data.data.revisionNumber})`);
        router.push(`/quotations/${data.data.quotationId}`);
      }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleRequestApproval = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) { toast.success("Approval requested from Sales Manager"); loadQuotation(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleApprovalDecision = async (decision: "Approved" | "Rejected") => {
    try {
      const res = await fetch(`/api/quotations/${id}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: approvalNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(decision === "Approved" ? "Quotation approved" : "Approval rejected");
        setApprovalNotes("");
        loadQuotation();
      }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleDownloadPdf = () => {
    window.open(`/api/quotations/${id}/pdf`, "_blank");
  };

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Quotation",
      message: "Are you sure you want to delete this quotation? Only Draft quotations can be deleted.",
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

  // Validity countdown
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntilDate = new Date(quotation.validUntil);
  const daysRemaining = Math.ceil((validUntilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const validityColor = daysRemaining <= 3 ? "text-red-600" : daysRemaining <= 7 ? "text-amber-600" : "text-slate-600";

  // Approval state
  const latestApproval = quotation.quotationApprovals?.[0];
  const hasApprovedApproval = quotation.quotationApprovals?.some((a: any) => a.status === "Approved");
  const needsApproval = quotation.discountPercent > DISCOUNT_THRESHOLD && !hasApprovedApproval;
  const isApprover = latestApproval?.approverId === user?.id || user?.role === "Admin";

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/quotations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.back} size={18} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">{quotation.quotationCode}</h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{quotation.revisionNumber || 1}</span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Quotation Details</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Draft actions */}
          {quotation.status === "Draft" && !editMode && (
            <>
              <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.edit} size={15} /> Edit Line Items</button>
              {needsApproval && <button onClick={handleRequestApproval} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"><Ico d={icons.alert} size={15} /> Request Approval</button>}
              <button onClick={handleSend} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"><Ico d={icons.send} size={15} /> Send</button>
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer"><Ico d={icons.x} size={15} /> Delete</button>
            </>
          )}
          {quotation.status === "Draft" && editMode && (
            <>
              <button onClick={handleSaveItems} disabled={savingItems} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"><Ico d={icons.check} size={15} /> {savingItems ? "Saving..." : "Save Changes"}</button>
              <button onClick={() => setEditMode(false)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            </>
          )}
          {/* Sent actions */}
          {quotation.status === "Sent" && (
            <>
              <button onClick={handleAccept} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer"><Ico d={icons.check} size={15} /> Mark Accepted</button>
              <button onClick={handleNegotiate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"><Ico d={icons.alert} size={15} /> Negotiate Changes</button>
              <button onClick={handleReject} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer"><Ico d={icons.x} size={15} /> Mark Rejected</button>
              <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.copy} size={15} /> Clone & Revise</button>
              <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.download} size={15} /> PDF</button>
            </>
          )}
          {/* UnderReview / Negotiation actions */}
          {quotation.status === "UnderReview" && (
            <>
              <button onClick={handleAccept} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer"><Ico d={icons.check} size={15} /> Mark Accepted</button>
              <button onClick={handleReject} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer"><Ico d={icons.x} size={15} /> Mark Rejected</button>
              <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.copy} size={15} /> Clone & Revise</button>
              <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.download} size={15} /> PDF</button>
            </>
          )}
          {/* Accepted/Expired actions */}
          {["Accepted", "Expired"].includes(quotation.status) && (
            <>
              <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.copy} size={15} /> Clone & Revise</button>
              <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.download} size={15} /> PDF</button>
            </>
          )}
          {/* Rejected actions */}
          {quotation.status === "Rejected" && (
            <>
              <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.copy} size={15} /> Clone & Revise</button>
              <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.download} size={15} /> PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Approval Banner */}
      {quotation.status === "Draft" && needsApproval && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Ico d={icons.alert} size={20} className="text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Manager approval required before sending</p>
            <p className="text-xs text-amber-600">Discount {quotation.discountPercent}% exceeds {DISCOUNT_THRESHOLD}% threshold</p>
          </div>
          {!latestApproval || latestApproval.status !== "Pending" ? (
            <button onClick={handleRequestApproval} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 cursor-pointer">Request Approval</button>
          ) : (
            <span className="text-sm font-medium text-amber-700">Approval Pending</span>
          )}
        </div>
      )}

      {latestApproval && latestApproval.status === "Pending" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Ico d={icons.clock} size={20} className="text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">Awaiting approval from {latestApproval.approver?.name || "Sales Manager"}</p>
            <p className="text-xs text-blue-600">Discount: {latestApproval.discountPercent}%</p>
          </div>
          {isApprover && (
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Notes (optional)" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-sm w-40" />
              <button onClick={() => handleApprovalDecision("Approved")} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer">Approve</button>
              <button onClick={() => handleApprovalDecision("Rejected")} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer">Reject</button>
            </div>
          )}
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[quotation.status]}`}>{quotation.status}</span>
          {quotation.status === "Sent" && daysRemaining >= 0 && (
            <span className={`text-sm font-medium ${validityColor}`}><Ico d={icons.clock} size={14} className="inline mr-1" />Expires in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span>
          )}
          {quotation.status === "Sent" && daysRemaining < 0 && (
            <span className="text-sm font-medium text-red-600">Expired {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? "s" : ""} ago</span>
          )}
          <span className="text-sm text-slate-500">Valid Until: <strong className="text-slate-700">{validUntilDate.toLocaleDateString()}</strong></span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Customer</p><p className="text-sm text-slate-800">{quotation.customer?.name}</p><p className="text-xs text-slate-500">{quotation.customer?.customerCode}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</p><p className="text-sm text-slate-800">{quotation.contact?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Created By</p><p className="text-sm text-slate-800">{quotation.createdBy?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Grand Total</p><p className="text-lg font-bold text-[var(--primary)]">{formatCurrency(quotation.finalAmount)}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "items", label: "Line Items" },
          { key: "history", label: "Status History" },
          { key: "revisions", label: "Revisions" },
          { key: "approvals", label: "Approvals" },
          { key: "documents", label: "Documents" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors ${activeTab === tab.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{tab.label}</button>
        ))}
      </div>

      {/* Line Items Tab */}
      {activeTab === "items" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Line Items</h2>
            {editMode && <button onClick={addEditItem} className="flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline cursor-pointer"><Ico d={icons.plus} size={14} /> Add Item</button>}
          </div>
          {editMode ? (
            <div className="p-4 space-y-3">
              {editItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4 relative">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Description / Product</label>
                      <input type="text" value={item.description} onChange={(e) => { updateEditItem(idx, "description", e.target.value); searchProducts(e.target.value, idx); }} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="Type to search products..." />
                      {productSearch?.idx === idx && productResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {productResults.map((p) => (
                            <button key={p.id} onClick={() => selectProduct(p, idx)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm cursor-pointer">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-slate-500 ml-2">{p.productCode}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">HSN</label>
                      <input type="text" value={item.hsn} onChange={(e) => updateEditItem(idx, "hsn", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Qty</label>
                      <input type="number" step="0.01" value={item.quantity} onChange={(e) => updateEditItem(idx, "quantity", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">UOM</label>
                      <input type="text" value={item.unit} onChange={(e) => updateEditItem(idx, "unit", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Price</label>
                      <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateEditItem(idx, "unitPrice", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Disc%</label>
                      <input type="number" step="0.01" min="0" max="100" value={item.discountPercent} onChange={(e) => updateEditItem(idx, "discountPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Tax%</label>
                      <input type="number" step="0.01" value={item.taxPercent} onChange={(e) => updateEditItem(idx, "taxPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Total</label>
                      <p className="text-sm font-medium text-slate-800 py-1.5">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100))}</p>
                    </div>
                    <div className="col-span-1 flex justify-end items-end pb-1.5">
                      <button onClick={() => removeEditItem(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Remove"><Ico d={icons.x} size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Discount (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={editDiscount} onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Valid Until</label>
                  <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Lead Time (days)</label>
                  <input type="number" value={editLeadTimeDays} onChange={(e) => setEditLeadTimeDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Terms</label>
                  <textarea value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Delivery Terms</label>
                  <textarea value={editDeliveryTerms} onChange={(e) => setEditDeliveryTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Freight Terms</label>
                  <textarea value={editFreightTerms} onChange={(e) => setEditFreightTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Terms & Conditions</label>
                  <textarea value={editTerms} onChange={(e) => setEditTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                </div>
              </div>
              <p className="text-xs text-slate-400 italic">Totals are server-computed on save — client values are overridden</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">#</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Description</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">HSN</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">UOM</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Unit Price</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Disc%</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Tax%</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Line Total</th>
                </tr></thead>
                <tbody>
                  {quotation.items?.map((item: any, idx: number) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{item.description}{item.product && <span className="text-xs text-slate-400 ml-2">({item.product.productCode})</span>}</td>
                      <td className="px-4 py-2 text-sm text-slate-500 text-center">{item.hsn || "—"}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-slate-500 text-center">{item.unit || "Nos"}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-2 text-sm text-slate-500 text-center">{item.discountPercent || 0}%</td>
                      <td className="px-4 py-2 text-sm text-slate-500 text-center">{item.taxPercent || 18}%</td>
                      <td className="px-4 py-2 text-sm font-medium text-slate-800 text-right">{formatCurrency(item.lineTotal || item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totals */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <div className="ml-auto w-64 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal:</span><span className="font-medium text-slate-800">{formatCurrency(quotation.subtotal || quotation.totalAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Discount ({quotation.discountPercent}%):</span><span className="font-medium text-red-600">-{formatCurrency((quotation.subtotal || quotation.totalAmount) * quotation.discountPercent / 100)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Tax (GST):</span><span className="font-medium text-slate-800">+{formatCurrency(quotation.taxAmount || 0)}</span></div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-300"><span className="text-slate-800">Grand Total:</span><span className="text-[var(--primary)]">{formatCurrency(quotation.finalAmount)}</span></div>
                </div>
              </div>
              {/* Commercial Terms */}
              {(quotation.paymentTerms || quotation.deliveryTerms || quotation.freightTerms || quotation.leadTimeDays || quotation.termsAndConditions) && (
                <div className="px-6 py-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Commercial Terms</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {quotation.paymentTerms && <div><span className="font-semibold text-slate-600">Payment:</span> <span className="text-slate-700">{quotation.paymentTerms}</span></div>}
                    {quotation.deliveryTerms && <div><span className="font-semibold text-slate-600">Delivery:</span> <span className="text-slate-700">{quotation.deliveryTerms}</span></div>}
                    {quotation.freightTerms && <div><span className="font-semibold text-slate-600">Freight:</span> <span className="text-slate-700">{quotation.freightTerms}</span></div>}
                    {quotation.leadTimeDays && <div><span className="font-semibold text-slate-600">Lead Time:</span> <span className="text-slate-700">{quotation.leadTimeDays} days</span></div>}
                  </div>
                  {quotation.termsAndConditions && <p className="text-xs text-slate-500 mt-3 whitespace-pre-wrap">{quotation.termsAndConditions}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Status History Tab */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">Status History</h2>
          <div className="space-y-3">
            {quotation.quotationStatusHistories?.map((h: any, idx: number) => (
              <div key={h.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${idx === 0 ? "bg-[var(--primary)]" : "bg-slate-300"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[h.toStatus] || "bg-slate-100 text-slate-600"}`}>{h.toStatus}</span>
                    {h.fromStatus && <span className="text-xs text-slate-400">from {h.fromStatus}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{h.notes}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(h.changedAt).toLocaleString()} by {h.changedBy?.name || "System"}</p>
                </div>
              </div>
            )) || <p className="text-sm text-slate-400">No status history</p>}
          </div>
        </div>
      )}

      {/* Revisions Tab */}
      {activeTab === "revisions" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">Revision History</h2>
          <div className="space-y-3">
            {quotation.revisionSnapshots?.length > 0 ? (
              quotation.revisionSnapshots.map((rev: any) => (
                <div key={rev.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{rev.revisionNumber}</span>
                    <span className="text-sm text-slate-700 ml-3">{new Date(rev.createdAt).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ml-2">by {rev.createdBy?.name || "—"}</span>
                  </div>
                  <button onClick={() => { try { const snap = JSON.parse(rev.snapshotJson); alert(JSON.stringify(snap, null, 2)); } catch { toast.error("Failed to load snapshot"); } }} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer">View Snapshot</button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No revisions cloned yet</p>
            )}
            <p className="text-xs text-slate-400 italic">Current revision: R{quotation.revisionNumber || 1}</p>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">Approval History</h2>
          <div className="space-y-3">
            {quotation.quotationApprovals?.length > 0 ? (
              quotation.quotationApprovals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "Approved" ? "bg-green-100 text-green-700" : a.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{a.status}</span>
                    <div>
                      <p className="text-sm text-slate-700">Requested by {a.requestedBy?.name || "—"}</p>
                      <p className="text-xs text-slate-500">Approver: {a.approver?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{a.discountPercent}%</p>
                    <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString()}{a.decidedAt && ` → ${new Date(a.decidedAt).toLocaleDateString()}`}</p>
                    {a.notes && <p className="text-xs text-slate-500 mt-1">{a.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No approval requests</p>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <EntityDocumentTab entityType="Quotation" entityId={quotation.id} defaultDocumentType="Quotation" />
        </div>
      )}

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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => { setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); setRejectReason(""); setRejectReasonId(""); }}
        isDestructive={confirmState.title.includes("Delete")}
      />
      {confirmState.input && confirmState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">{confirmState.title}</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rejection Reason ID *</label>
              <input type="text" value={rejectReasonId} onChange={(e) => setRejectReasonId(e.target.value)} placeholder="e.g. RR-001" className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rejection Description</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); setRejectReason(""); setRejectReasonId(""); }} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={confirmState.action} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
