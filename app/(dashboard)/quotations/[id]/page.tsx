"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { EntityTimeline } from "@/components/entity-timeline";
import QuotationDetailPageV2 from "@/components/quotations/QuotationDetailPageV2";
import { cn } from "@/lib/ui-utils";
import { StatusStepper } from "@/components/ui/StatusStepper";
import {
  ChevronRight, ChevronLeft, CheckCircle, Edit, AlertTriangle, Send, FileCode, Copy, Download, X, XCircle, Check, Plus, FileText, MoreVertical
} from "lucide-react";

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
  po: "M9 12h6m-6 4h6m-6-8h6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
};

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border border-slate-200/50",
  Sent: "bg-blue-100 text-blue-700 border border-blue-200/50",
  UnderReview: "bg-amber-100 text-amber-700 border border-amber-200/50",
  Accepted: "bg-green-100 text-green-700 border border-green-200/50",
  Rejected: "bg-red-100 text-red-700 border border-red-200/50",
  Expired: "bg-gray-100 text-gray-500 border border-gray-200/50",
  PendingApproval: "bg-orange-100 text-orange-700 border border-orange-200/50",
  Approved: "bg-green-100 text-green-700 border border-green-200/50",
};

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const currencySymbol = CURRENCY_SYMBOLS[preferredCurrency as keyof typeof CURRENCY_SYMBOLS] || "Rs.";

  const [quotation, setQuotation] = useState<any>(null);
  useSyncUrlParam(quotation?.status, "status");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "history" | "revisions" | "approvals" | "documents" | "timeline">("items");
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
  const [revisionModal, setRevisionModal] = useState<{ open: boolean; revisionNumber: number; data: any }>({ open: false, revisionNumber: 0, data: null });
  // Start Negotiation modal state
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [negotiateForm, setNegotiateForm] = useState({
    customerDemands: "",
    internalNotes: "",
    negotiationType: "Price",
    negotiationReason: "Customer Request",
  });
  const [negotiating, setNegotiating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [quotationDocuments, setQuotationDocuments] = useState<any[]>([]);
  const searchParams = useSearchParams();
  if (searchParams.get("v2") === "1") return <QuotationDetailPageV2 />;
  const { startLoading, stopLoading } = useGlobalLoading();

  // Settings configs populated from API response
  const [marginFloor, setMarginFloor] = useState(15.0);
  const [discountThreshold, setDiscountThreshold] = useState(5.0);

  const loadQuotation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (data.success) {
        setQuotation(data.data);
        if (data.config) {
          setMarginFloor(data.config.marginFloor);
          setDiscountThreshold(data.config.discountThreshold);
        }
      }
    } catch {
      toast.error("Failed to load quotation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotation();
  }, [id]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && quotation?.status === "Draft") {
      startEdit();
    }
  }, [searchParams, quotation]);

  const loadDocuments = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/generate-pdf`);
      const data = await res.json();
      if (data.success) setQuotationDocuments(data.data || []);
    } catch {}
  };

  useEffect(() => {
    loadDocuments();
  }, [id]);

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/quotations/${id}/generate-pdf`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("PDF generated and stored");
        loadDocuments();
      } else {
        toast.error(data.message || "Failed to generate PDF");
      }
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadDoc = (doc: any) => {
    const link = document.createElement("a");
    link.href = doc.fileUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      unit: it.unit || "Pcs",
      notes: it.notes || "",
      costBasisUnitPrice: it.costBasisUnitPrice ? String(it.costBasisUnitPrice) : "",
      quantityBreakId: it.quantityBreakId || "",
      priceSource: it.priceSource || "StandaloneManual",
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
            costBasisUnitPrice: it.costBasisUnitPrice ? parseFloat(it.costBasisUnitPrice) : null,
            quantityBreakId: it.quantityBreakId || null,
            priceSource: it.priceSource || "StandaloneManual",
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
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingItems(false);
    }
  };

  const addEditItem = () => {
    setEditItems([...editItems, { id: `new_${Date.now()}`, productId: "", description: "", quantity: "1", unitPrice: "0", discountPercent: "0", taxPercent: "18", hsn: "", unit: "Pcs", notes: "", costBasisUnitPrice: "", quantityBreakId: "", priceSource: "StandaloneManual" }]);
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
      hsn: product.hsnCode || product.productCode || "",
      unit: product.unit || "Pcs",
      costBasisUnitPrice: "",
      priceSource: "StandaloneManual",
      quantityBreakId: "",
    } : it)));
    setProductSearch(null);
    setProductResults([]);
  };

  const handleSend = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Quotation sent to customer");
        loadQuotation();
      } else if (res.status === 402 && data.requires_approval) {
        toast.error(data.message || "Manager approval required before sending");
        loadQuotation();
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleAccept = async () => {
    startLoading("Confirming quotation...", "handshake");
    try {
      const res = await fetch(`/api/quotations/${id}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Quotation accepted — deal won, account activated, RFQ closed");
        loadQuotation();
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    } finally {
      stopLoading();
    }
  };

  const handleNegotiate = async () => {
    setNegotiating(true);
    try {
      const payload: any = {
        customerDemands: negotiateForm.customerDemands || undefined,
        internalNotes: negotiateForm.internalNotes || undefined,
        negotiationType: negotiateForm.negotiationType || undefined,
        negotiationReason: negotiateForm.negotiationReason || undefined,
      };
      const res = await fetch(`/api/quotations/${id}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Negotiation started — status is Active");
        setShowNegotiateModal(false);
        if (data.data?.negotiationId) {
          router.push(`/negotiations/${data.data.negotiationId}`);
        } else {
          router.push("/negotiations");
        }
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setNegotiating(false);
    }
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
          if (data.success) {
            toast.success("Quotation rejected");
            setRejectReason("");
            setRejectReasonId("");
            loadQuotation();
          } else {
            toast.error(data.message || "Failed");
          }
        } catch {
          toast.error("Failed");
        }
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
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleRequestApproval = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Approval requested from Sales Manager");
        loadQuotation();
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    }
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
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleDownloadPdf = () => {
    window.open(`/api/quotations/${id}/pdf`, "_blank");
  };

  const [creatingPo, setCreatingPo] = useState(false);
  const handleCreatePo = async () => {
    setCreatingPo(true);
    try {
      const res = await fetch(`/api/quotations/${id}/create-po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Pass quotation leadTimeDays so API can compute expectedDelivery
          leadTimeDays: quotation?.leadTimeDays || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Purchase order ${data.data.poCode} created`);
        router.push(`/purchase-orders/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to create purchase order");
      }
    } catch {
      toast.error("Failed to create purchase order");
    } finally {
      setCreatingPo(false);
    }
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
          if (data.success) {
            toast.success("Quotation deleted");
            router.push("/quotations");
          } else {
            toast.error(data.message || "Failed");
          }
        } catch {
          toast.error("Failed");
        }
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
  const validityColor = daysRemaining <= 3 ? "text-rose-600" : daysRemaining <= 7 ? "text-amber-600" : "text-slate-500";

  // Compute live margin and discount trigger rules locally
  let totalGross = 0;
  let totalNet = quotation.subtotal - (quotation.subtotal * quotation.discountPercent / 100);
  let maxLineDiscount = 0;
  let hasMarginBreach = false;

  for (const item of quotation.items || []) {
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    totalGross += qty * price;
    if (item.discountPercent > maxLineDiscount) maxLineDiscount = item.discountPercent;

    if (item.costBasisUnitPrice != null) {
      const costBasis = Number(item.costBasisUnitPrice);
      const margin = price > 0 ? ((price - costBasis) / price) * 100 : 0;
      if (margin < marginFloor) hasMarginBreach = true;
    }
  }

  const blendedDiscount = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

  // Build trigger explanations
  const triggerReasons: string[] = [];
  if (blendedDiscount > discountThreshold) {
    triggerReasons.push(`Weighted blended discount of ${blendedDiscount.toFixed(1)}% exceeds the ${discountThreshold}% limit`);
  }
  if (maxLineDiscount > discountThreshold) {
    triggerReasons.push(`Single line discount ceiling of ${maxLineDiscount.toFixed(1)}% exceeds the ${discountThreshold}% limit`);
  }
  if (hasMarginBreach) {
    triggerReasons.push(`One or more line items fall below the ${marginFloor}% margin floor`);
  }

  const latestApproval = quotation.quotationApprovals?.[0];
  const hasApprovedApproval = quotation.quotationApprovals?.some((a: any) => a.status === "Approved");
  const needsApproval = triggerReasons.length > 0 && !hasApprovedApproval;
  const isApprover = latestApproval?.approverId === user?.id || user?.role === "Admin";

  // Check if any edit item drops margin below the floor
  let showBelowFloorWarning = false;
  for (const it of editItems) {
    if (it.costBasisUnitPrice) {
      const price = parseFloat(it.unitPrice) || 0;
      const cost = parseFloat(it.costBasisUnitPrice) || 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      if (margin < marginFloor) showBelowFloorWarning = true;
    }
  }

  // Header overall margin color
  const overallMargin = quotation.overallMarginPercent != null ? parseFloat(String(quotation.overallMarginPercent)) : null;
  let overallMarginColor = "text-slate-400 bg-slate-100 dark:bg-slate-800";
  if (overallMargin !== null) {
    if (overallMargin >= 20) overallMarginColor = "text-emerald-700 bg-emerald-50 border border-emerald-100";
    else if (overallMargin >= marginFloor) overallMarginColor = "text-amber-700 bg-amber-50 border border-amber-100";
    else overallMarginColor = "text-rose-700 bg-rose-50 border border-rose-100 animate-pulse";
  }

  // Action-bar visibility and primary-button rules
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

  function buttonClass({ primary = false, disabled = false }: { primary?: boolean; disabled?: boolean }) {
    const base = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors";
    if (disabled) return `${base} text-[var(--text-muted)] bg-[var(--surface-2)] opacity-60 cursor-not-allowed`;
    if (primary) return `${base} text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer`;
    return `${base} text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border)] hover:bg-[var(--border)] cursor-pointer`;
  }

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
        <button onClick={() => setOpen(!open)} title="More actions" className={buttonClass({})}>
          <MoreVertical size={15} />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] shadow-lg z-50 py-1">
            {canClone && (
              <button onClick={() => { setOpen(false); handleClone(); }} title="Create a new revision of this quotation" className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] flex items-center gap-2">
                <Copy size={14} /> Clone & Revise
              </button>
            )}
            {canDelete && (
              <button onClick={() => { setOpen(false); handleDelete(); }} title="Delete this quotation" className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                <X size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Breadcrumbs — full lineage: RFQ → Quotation → Negotiation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/40 w-max">
        {quotation.rfq ? (
          <>
            <button
              onClick={() => router.push(`/rfq/${quotation.rfq.id}`)}
              className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline cursor-pointer transition-colors flex items-center gap-1"
            >
              📄 {quotation.rfq.rfqCode}
            </button>
            <ChevronRight size={12} className="text-slate-450" />
          </>
        ) : (
          <span className="text-slate-400">No RFQ</span>
        )}
        <span className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-bold flex items-center gap-1">
          💼 {quotation.quotationCode} {quotation.revisionNumber > 1 ? `(R${quotation.revisionNumber})` : ""}
        </span>
        {quotation.negotiation ? (
          <>
            <ChevronRight size={12} className="text-slate-450" />
            <button
              onClick={() => router.push(`/negotiations/${quotation.negotiation.id}`)}
              className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline cursor-pointer transition-colors flex items-center gap-1"
            >
              🤝 {quotation.negotiation.negotiationCode}
            </button>
          </>
        ) : (
          <>
            <ChevronRight size={12} className="text-slate-400 opacity-40" />
            <span className="text-slate-450 italic">No Negotiation</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/quotations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><ChevronLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{quotation.quotationCode}</h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{quotation.revisionNumber || 1}</span>
              {quotation.negotiationId && (
                <a href={`/negotiations/${quotation.negotiationId}`} className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold hover:underline" title="Linked negotiation">
                  Negotiation
                </a>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Quotation Details</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Mode: show Save/Cancel only */}
          {editMode ? (
            <>
              <button onClick={handleSaveItems} disabled={savingItems} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"><CheckCircle size={15} /> {savingItems ? "Saving..." : "Save Changes"}</button>
              <button onClick={() => setEditMode(false)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-2)] hover:bg-[var(--border)] cursor-pointer">Cancel</button>
            </>
          ) : (
            <>
              {/* Edit Line Items — only in Draft */}
              <button onClick={startEdit} disabled={quotation.status !== "Draft"} title={quotation.status !== "Draft" ? "Only Draft quotations can be edited" : "Edit line items, prices, and discounts"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${quotation.status === "Draft" ? "text-[var(--text-secondary)] bg-[var(--surface-2)] hover:bg-[var(--border)]" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><Edit size={15} /> Edit</button>
              {/* Request Approval — only in Draft when approval needed */}
              <button onClick={handleRequestApproval} disabled={quotation.status !== "Draft" || !needsApproval} title={quotation.status !== "Draft" ? "Quotation must be in Draft" : !needsApproval ? "No approval triggers — discount/margin within limits" : "Request manager approval for discount/margin override"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${quotation.status === "Draft" && needsApproval ? "text-white bg-[var(--status-warning)] hover:opacity-90" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><AlertTriangle size={15} /> Request Approval</button>
              {/* Send — available in Draft and Approved */}
              <button onClick={handleSend} disabled={!["Draft", "Approved"].includes(quotation.status)} title={!["Draft", "Approved"].includes(quotation.status) ? "Quotation must be Draft or Approved to send" : "Send quotation to customer"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${["Draft", "Approved"].includes(quotation.status) ? "text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><Send size={15} /> Send</button>
              {/* Negotiate — available in Sent and UnderReview */}
              <button onClick={() => setShowNegotiateModal(true)} disabled={!["Sent", "UnderReview"].includes(quotation.status)} title={!["Sent", "UnderReview"].includes(quotation.status) ? "Quotation must be Sent to customer first" : "Move quotation to negotiation"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${["Sent", "UnderReview"].includes(quotation.status) ? "text-white bg-[var(--status-warning)] hover:opacity-90" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><AlertTriangle size={15} /> Negotiate</button>
              {/* Mark Accepted — available in Sent and UnderReview */}
              <button onClick={handleAccept} disabled={!["Sent", "UnderReview"].includes(quotation.status)} title={!["Sent", "UnderReview"].includes(quotation.status) ? "Quotation must be Sent or Under Review" : "Mark quotation as accepted by customer"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${["Sent", "UnderReview"].includes(quotation.status) ? "text-white bg-[var(--status-success)] hover:opacity-90" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><Check size={15} /> Accept</button>
              {/* Mark Rejected — available in Sent and UnderReview */}
              <button onClick={handleReject} disabled={!["Sent", "UnderReview"].includes(quotation.status)} title={!["Sent", "UnderReview"].includes(quotation.status) ? "Quotation must be Sent or Under Review" : "Mark quotation as rejected by customer"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${["Sent", "UnderReview"].includes(quotation.status) ? "text-white bg-[var(--status-danger)] hover:opacity-90" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><XCircle size={15} /> Reject</button>
              {/* Create PO — only in Accepted */}
              <button onClick={handleCreatePo} disabled={quotation.status !== "Accepted" || creatingPo} title={quotation.status !== "Accepted" ? "Quotation must be Accepted first" : "Create purchase order from this quotation"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${quotation.status === "Accepted" ? "text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]" : "text-[var(--text-muted)] bg-[var(--surface-2)]"}`}><FileCode size={15} /> Create PO</button>
              {/* PDF — always available */}
              <button onClick={handleDownloadPdf} title="Open printable quotation view" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-2)] hover:bg-[var(--border)] cursor-pointer"><Download size={15} /> PDF</button>
              {/* Generate & Store PDF — always available */}
              <button onClick={handleGeneratePdf} disabled={generatingPdf} title="Generate and store a PDF document for this revision" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-60"><FileText size={15} /> {generatingPdf ? "Generating..." : "Generate PDF"}</button>
            </>
          )}
        </div>
      </div>

      {/* Lifecycle Stepper — RFQ → Quotation → Negotiation → Won/Lost */}
      <div className="crm-card p-4">
        <StatusStepper
          steps={[
            { label: "RFQ", key: "rfq", reached: !!quotation.rfq, active: false, onClick: () => quotation.rfq?.id && router.push(`/rfq/${quotation.rfq.id}`), clickable: !!quotation.rfq?.id },
            { label: "Quotation", key: "quotation", reached: true, active: true },
            { label: "Negotiation", key: "negotiation", reached: !!quotation.negotiation, active: false, onClick: () => quotation.negotiation?.id && router.push(`/negotiations/${quotation.negotiation.id}`), clickable: !!quotation.negotiation?.id },
            { label: quotation.status === "Accepted" ? "Won" : quotation.status === "Rejected" ? "Lost" : "Won/Lost", key: "outcome", reached: ["Accepted", "Rejected"].includes(quotation.status), active: false, terminal: quotation.status === "Rejected" ? "danger" : quotation.status === "Accepted" ? "success" : undefined },
          ]}
        />
      </div>

      {/* Next Step — contextual guidance (actions are in the header toolbar above) */}
      <div className="crm-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Next Step</p>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {quotation.status === "Draft" && (needsApproval ? "Manager approval required before sending to customer" : "Review line items and send to customer") }
            {quotation.status === "PendingApproval" && "Awaiting approval from manager — check Approval Center"}
            {quotation.status === "Approved" && "Quotation approved — ready to send to customer"}
            {quotation.status === "Sent" && "Customer reviewing — start negotiation if they request changes"}
            {quotation.status === "UnderReview" && "In negotiation — propose revisions or mark accepted/rejected"}
            {quotation.status === "Accepted" && "Customer accepted — create a Deal or Purchase Order"}
            {quotation.status === "Rejected" && "Quotation rejected — clone & revise to create a new version"}
            {quotation.status === "Expired" && "Quotation expired — clone & revise with updated validity"}
          </p>
        </div>
      </div>

      {/* Approval Banner */}
      {quotation.status === "Draft" && needsApproval && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
              <button onClick={handleRequestApproval} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-warning)] hover:opacity-90 cursor-pointer transition-colors shadow-sm whitespace-nowrap">Request Approval</button>
            ) : (
              <span className="text-xs font-bold text-amber-700 uppercase bg-amber-100 px-2.5 py-1 rounded">Approval Pending</span>
            )}
            {user?.role === "Admin" && latestApproval?.status === "Pending" && (
              <button onClick={() => handleApprovalDecision("Approved")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-success)] hover:opacity-90 cursor-pointer transition-colors shadow-sm whitespace-nowrap">Approve Now</button>
            )}
          </div>
        </div>
      )}

      {latestApproval && latestApproval.status === "Pending" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Ico d={icons.clock} size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-blue-800 uppercase tracking-wide">Awaiting approval from {latestApproval.approver?.name || "Sales Manager"}{latestApproval.requiredApproverRole ? ` (${latestApproval.requiredApproverRole})` : ""}</p>
              <p className="text-blue-600 mt-1">{latestApproval.notes}</p>
              {latestApproval.revisionAuthorId === user?.id && user?.role !== "Admin" && <p className="text-[10px] text-blue-500 italic mt-0.5">Note: You authored this revision and cannot approve it yourself.</p>}
            </div>
          </div>
          {isApprover && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" placeholder="Notes (optional)" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs w-40" />
              <button onClick={() => handleApprovalDecision("Approved")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-success)] hover:opacity-90 cursor-pointer transition-colors shadow-sm">Approve</button>
              <button onClick={() => handleApprovalDecision("Rejected")} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--status-danger)] hover:opacity-90 cursor-pointer transition-colors shadow-sm">Reject</button>
            </div>
          )}
        </div>
      )}

      {/* Workflow Stepper */}
      <div className="crm-card p-4">
        <StatusStepper
          compact
          steps={[
            "Draft", "Approved", "Sent", "UnderReview", "Accepted", "Deal/PO"
          ].map((key, idx) => {
            const order = ["Draft", "Approved", "Sent", "UnderReview", "Accepted", "Deal/PO"];
            const currentIdx = order.indexOf(quotation.status === "Rejected" || quotation.status === "Expired" ? "Accepted" : quotation.status);
            const stageIdx = idx;
            const isDone = stageIdx < currentIdx;
            const isCurrent = key === quotation.status || (key === "Deal/PO" && quotation.status === "Accepted" && quotation.dealId);
            const isRejected = quotation.status === "Rejected";
            const labelMap: Record<string,string> = { Draft: "Draft", Approved: "Approved", Sent: "Sent", UnderReview: "Negotiation", Accepted: "Accepted", "Deal/PO": "Deal / PO" };
            return {
              label: labelMap[key],
              key,
              reached: isDone || isCurrent,
              active: isCurrent,
              terminal: isRejected && stageIdx >= currentIdx ? "danger" as const : undefined,
            };
          })}
        />
        {quotation.status === "Rejected" && (
          <p className="text-xs text-[var(--status-danger-text)] font-medium mt-2 flex items-center gap-1"><Ico d={icons.x} size={12} /> Quotation rejected — use Clone &amp; Revise to create a new revision</p>
        )}
        {quotation.status === "Expired" && (
          <p className="text-xs text-[var(--text-muted)] font-medium mt-2 flex items-center gap-1"><Ico d={icons.clock} size={12} /> Quotation expired — use Clone &amp; Revise to create a new revision with updated validity</p>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4 mb-2 flex-wrap">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[quotation.status]}`}>{quotation.status}</span>
          {quotation.status === "Sent" && daysRemaining >= 0 && (
            <span className={`text-xs font-medium ${validityColor}`}><Ico d={icons.clock} size={14} className="inline mr-1" />Expires in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span>
          )}
          {quotation.status === "Sent" && daysRemaining < 0 && (
            <span className="text-xs font-medium text-red-600">Expired {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? "s" : ""} ago</span>
          )}
          <span className="text-xs text-slate-500">Valid Until: <strong className="text-slate-700">{validUntilDate.toLocaleDateString()}</strong></span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Customer</p><p className="text-sm font-bold text-slate-800">{quotation.customer?.name}</p><p className="text-xs text-slate-400">{quotation.customer?.customerCode}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</p><p className="text-sm font-bold text-slate-800">{quotation.contact?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Created By</p><p className="text-sm font-bold text-slate-800">{quotation.createdBy?.name || "—"}</p></div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Grand Total</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-[var(--primary)]">{formatCurrency(quotation.finalAmount)}</span>
              {overallMargin !== null && (
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", overallMarginColor)}>
                  Margin {overallMargin.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
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
          { key: "timeline", label: "Timeline" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors ${activeTab === tab.key ? "border-[var(--primary)] text-[var(--primary)] font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{tab.label}</button>
        ))}
      </div>

      {/* Line Items Tab */}
      {activeTab === "items" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Line Items</h2>
            {editMode && <button onClick={addEditItem} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"><Ico d={icons.plus} size={14} /> Add Item</button>}
          </div>

          {editMode ? (
            <div className="p-4 space-y-4">
              {showBelowFloorWarning && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-250 bg-amber-50 text-xs text-amber-800">
                  <Ico d={icons.alert} size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Low Margin Override Alert</p>
                    <p>One or more edited prices will drop the margin below the {marginFloor}% floor. A Sales Manager or Admin approval will be required to send this quotation.</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {editItems.map((item, idx) => {
                  // Find matching RFQ line quantity breaks for selectors
                  const rfqLine = quotation.rfq?.lineItems?.find(
                    (li: any) => li.productId === item.productId || li.itemDescription === item.description
                  );
                  const qtyBreaks = rfqLine?.quantityBreaks || [];

                  // Live margin display calculation
                  const price = parseFloat(item.unitPrice) || 0;
                  const cost = parseFloat(item.costBasisUnitPrice) || 0;
                  const liveMargin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

                  let liveMarginText = "";
                  let liveMarginCls = "text-slate-400";
                  if (liveMargin !== null) {
                    liveMarginText = `Margin: ${liveMargin.toFixed(1)}%`;
                    if (liveMargin >= 20) liveMarginCls = "text-emerald-600 font-bold";
                    else if (liveMargin >= marginFloor) liveMarginCls = "text-amber-600 font-bold";
                    else liveMarginCls = "text-rose-600 font-bold animate-pulse";
                  } else {
                    liveMarginText = "unknown — no cost basis";
                  }

                  return (
                    <div key={item.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        {/* Description */}
                        <div className="col-span-4 relative">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Description / Product</label>
                          <input type="text" value={item.description} onChange={(e) => { updateEditItem(idx, "description", e.target.value); searchProducts(e.target.value, idx); }} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="Type to search products..." />
                          {productSearch?.idx === idx && productResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {productResults.map((p) => (
                                <button key={p.id} onClick={() => selectProduct(p, idx)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs cursor-pointer">
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-[10px] text-slate-500 ml-2">({p.productCode})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* HSN */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">HSN</label>
                          <input type="text" value={item.hsn} onChange={(e) => updateEditItem(idx, "hsn", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                        </div>

                        {/* Qty */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Qty</label>
                          <input type="number" step="0.01" value={item.quantity} onChange={(e) => updateEditItem(idx, "quantity", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                        </div>

                        {/* UOM */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">UOM</label>
                          <input type="text" value={item.unit} onChange={(e) => updateEditItem(idx, "unit", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                        </div>

                        {/* Price */}
                        <div className="col-span-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Price (₹)</label>
                          <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => { updateEditItem(idx, "unitPrice", e.target.value); updateEditItem(idx, "priceSource", "ManualOverride"); }} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                          <p className={cn("text-[9px] mt-0.5 font-medium whitespace-nowrap", liveMarginCls)}>{liveMarginText}</p>
                        </div>

                        {/* Disc % */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Disc%</label>
                          <input type="number" step="0.01" min="0" max="100" value={item.discountPercent} onChange={(e) => updateEditItem(idx, "discountPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                        </div>

                        {/* Tax % */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tax%</label>
                          <input type="number" step="0.01" value={item.taxPercent} onChange={(e) => updateEditItem(idx, "taxPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-900 focus:outline-none" />
                        </div>

                        {/* Line Total */}
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total</label>
                          <p className="text-xs font-semibold text-slate-800 py-2">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100))}</p>
                        </div>

                        {/* Remove */}
                        <div className="col-span-0.5 flex justify-end items-end pb-2">
                          <button onClick={() => removeEditItem(idx)} className="p-1 rounded-md hover:bg-rose-50 text-rose-500 cursor-pointer" title="Remove"><Ico d={icons.x} size={14} /></button>
                        </div>
                      </div>

                      {/* RFQ pricing breaks selector */}
                      {qtyBreaks.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            RFQ Price Ladder:
                          </span>
                          {qtyBreaks.map((qb: any) => (
                            <button
                              key={qb.id}
                              type="button"
                              onClick={() => {
                                const costing = qb.costingSheets?.[0];
                                const marginPct = costing?.marginPercent ?? 0;
                                const costBasis = marginPct > 0
                                  ? qb.computedUnitPrice / (1 + marginPct / 100)
                                  : qb.computedUnitPrice;

                                updateEditItem(idx, "quantity", String(qb.quantity));
                                updateEditItem(idx, "unitPrice", String(qb.computedUnitPrice));
                                updateEditItem(idx, "costBasisUnitPrice", String(costBasis));
                                updateEditItem(idx, "quantityBreakId", qb.id);
                                updateEditItem(idx, "priceSource", "RFQCosting");
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-semibold transition-all border",
                                item.quantityBreakId === qb.id
                                  ? "bg-slate-850 text-white border-slate-850 dark:bg-slate-100 dark:text-slate-900"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-350"
                              )}
                            >
                              {qb.quantity} pcs @ ₹{qb.computedUnitPrice.toFixed(2)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Commercial Terms Form */}
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Discount (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={editDiscount} onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valid Until</label>
                  <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Time (days)</label>
                  <input type="number" value={editLeadTimeDays} onChange={(e) => setEditLeadTimeDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Terms</label>
                  <textarea value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Delivery Terms</label>
                  <textarea value={editDeliveryTerms} onChange={(e) => setEditDeliveryTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Freight Terms</label>
                  <textarea value={editFreightTerms} onChange={(e) => setEditFreightTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Terms & Conditions</label>
                  <textarea value={editTerms} onChange={(e) => setEditTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">Totals and tax percents are server-computed on save — client values are automatically reconciled</p>
            </div>
          ) : (
            <>
              {/* Read Only Items Table */}
              <table className="crm-table">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <th className="crm-th text-left w-10">#</th>
                  <th className="crm-th text-left">Description</th>
                  <th className="crm-th text-center">HSN</th>
                  <th className="crm-th text-right">Qty</th>
                  <th className="crm-th text-center">UOM</th>
                  <th className="crm-th text-right">Unit Price</th>
                  <th className="crm-th text-center">Margin</th>
                  <th className="crm-th text-right">Disc%</th>
                  <th className="crm-th text-right">Tax%</th>
                  <th className="crm-th text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items?.map((item: any, idx: number) => {
                  const costBasis = item.costBasisUnitPrice ? Number(item.costBasisUnitPrice) : null;
                  const margin = item.marginPercent ? parseFloat(String(item.marginPercent)) : null;

                  let marginColor = "text-slate-400";
                  if (margin !== null) {
                    if (margin >= 20) marginColor = "text-emerald-600 font-semibold";
                    else if (margin >= marginFloor) marginColor = "text-amber-600 font-semibold";
                    else marginColor = "text-rose-600 font-semibold";
                  }

                  return (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/40">
                      <td className="crm-td text-left text-slate-400">{idx + 1}</td>
                      <td className="crm-td font-semibold text-slate-700 dark:text-slate-200">
                        {item.description}
                        {item.product && <span className="text-[10px] text-slate-400 ml-2 font-normal">({item.product.productCode})</span>}
                        {/* Price source label */}
                        {item.priceSource && (
                          <div className="text-[9px] mt-0.5 font-bold uppercase tracking-wider">
                            {item.priceSource === "RFQCosting" ? (
                              <span className="text-emerald-600">from RFQ costing</span>
                            ) : item.priceSource === "ManualOverride" ? (
                              <span className="text-amber-500">manual override</span>
                            ) : (
                              <span className="text-slate-400">no cost basis</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="crm-td text-center text-slate-500">{item.hsn || "—"}</td>
                      <td className="crm-td text-right text-slate-700 dark:text-slate-200">{item.quantity}</td>
                      <td className="crm-td text-center text-slate-500">{item.unit || "Nos"}</td>
                      <td className="crm-td text-right text-slate-700 dark:text-slate-200">{formatCurrency(item.unitPrice)}</td>
                      {/* Margin column */}
                      <td className="crm-td text-center">
                        <span className={marginColor}>
                          {margin !== null ? `${margin.toFixed(1)}%` : "unknown"}
                        </span>
                      </td>
                      <td className="crm-td text-right text-slate-500">{item.discountPercent || 0}%</td>
                      <td className="crm-td text-right text-slate-500">{item.taxPercent || 18}%</td>
                      <td className="crm-td text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.lineTotal || item.totalPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

              {/* Totals */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <div className="ml-auto w-64 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Subtotal:</span><span className="font-semibold text-slate-800">{formatCurrency(quotation.subtotal || quotation.totalAmount)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Discount ({quotation.discountPercent}%):</span><span className="font-semibold text-rose-600">-{formatCurrency((quotation.subtotal || quotation.totalAmount) * quotation.discountPercent / 100)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Tax (GST):</span><span className="font-semibold text-slate-800">+{formatCurrency(quotation.taxAmount || 0)}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-350"><span className="text-slate-800">Grand Total:</span><span className="text-[var(--primary)] font-black">{formatCurrency(quotation.finalAmount)}</span></div>
                </div>
              </div>

              {/* Commercial Terms */}
              {(quotation.paymentTerms || quotation.deliveryTerms || quotation.freightTerms || quotation.leadTimeDays || quotation.termsAndConditions) && (
                <div className="px-6 py-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Commercial Terms</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {quotation.paymentTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Payment:</span> <span className="text-slate-700 ml-1">{quotation.paymentTerms}</span></div>}
                    {quotation.deliveryTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Delivery:</span> <span className="text-slate-700 ml-1">{quotation.deliveryTerms}</span></div>}
                    {quotation.freightTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Freight:</span> <span className="text-slate-700 ml-1">{quotation.freightTerms}</span></div>}
                    {quotation.leadTimeDays && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Lead Time:</span> <span className="text-slate-700 ml-1">{quotation.leadTimeDays} days</span></div>}
                  </div>
                  {quotation.termsAndConditions && <p className="text-[11px] text-slate-500 mt-3 whitespace-pre-wrap leading-relaxed">{quotation.termsAndConditions}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Status History Tab */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Status History</h2>
          <div className="space-y-3">
            {quotation.quotationStatusHistories?.map((h: any, idx: number) => (
              <div key={h.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${idx === 0 ? "bg-[var(--primary)]" : "bg-slate-300"}`} />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[h.toStatus] || "bg-slate-100 text-slate-600"}`}>{h.toStatus}</span>
                    {h.fromStatus && <span className="text-[10px] text-slate-400">from {h.fromStatus}</span>}
                  </div>
                  <p className="text-slate-600 mt-1">{h.notes}</p>
                  <p className="text-slate-400 mt-0.5">{new Date(h.changedAt).toLocaleString()} by {h.changedBy?.name || "System"}</p>
                </div>
              </div>
            )) || <p className="text-xs text-slate-400 italic">No status history</p>}
          </div>
        </div>
      )}

      {/* Revisions Tab */}
      {activeTab === "revisions" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-xs">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Revision History</h2>
          <div className="space-y-3">
            {quotation.revisionSnapshots?.length > 0 ? (
              quotation.revisionSnapshots.map((rev: any) => (
                <div key={rev.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold">R{rev.revisionNumber}</span>
                    {rev.revisionNumber === 1 ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">Root</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold">v{rev.revisionNumber}</span>
                    )}
                    <span className="text-slate-700 dark:text-slate-300 font-medium ml-1">{new Date(rev.createdAt).toLocaleString()}</span>
                    <span className="text-slate-400">by {rev.createdBy?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { try { const snap = JSON.parse(rev.snapshotJson); setRevisionModal({ open: true, revisionNumber: rev.revisionNumber, data: snap }); } catch { toast.error("Failed to load snapshot"); } }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer">View Snapshot</button>
                    <a
                      href={`/api/quotations/${id}/pdf?revision=${rev.revisionNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No revisions cloned yet</p>
            )}
            <p className="text-slate-400 italic mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
              <span>Current version:</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md font-bold text-[11px]",
                quotation.revisionNumber === 1
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  : "bg-blue-50 text-blue-700 border border-blue-200/50"
              )}>
                R{quotation.revisionNumber || 1} {quotation.revisionNumber === 1 ? "(Root)" : ""}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-xs">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Approval History</h2>
          <div className="space-y-3">
            {quotation.quotationApprovals?.length > 0 ? (
              quotation.quotationApprovals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.status === "Approved" ? "bg-green-100 text-green-700 border border-green-200/50" : a.status === "Rejected" ? "bg-red-100 text-red-700 border-red-200/50" : "bg-amber-100 text-amber-700 border-amber-200/50"}`}>{a.status}</span>
                    <div>
                      <p className="text-slate-700 font-semibold">Requested by {a.requestedBy?.name || "—"}</p>
                      <p className="text-slate-400 text-[10px]">Required: {a.requiredApproverRole || "SalesManager"}{a.approver && ` (Assigned: ${a.approver.name})`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">{a.discountPercent?.toFixed(1)}% Discount</p>
                    <p className="text-slate-400 text-[10px]">{new Date(a.createdAt).toLocaleDateString()}{a.decidedAt && ` → ${new Date(a.decidedAt).toLocaleDateString()}`}</p>
                    {a.notes && <p className="text-[10px] text-slate-500 mt-1">{a.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No approval requests</p>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Generated PDFs */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Generated PDFs</h2>
              <button onClick={handleGeneratePdf} disabled={generatingPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:opacity-60"><FileText size={15} /> {generatingPdf ? "Generating..." : "Generate PDF"}</button>
            </div>
            {quotationDocuments.length > 0 ? (
              <div className="space-y-2">
                {quotationDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-indigo-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{doc.fileName}</p>
                        <p className="text-xs text-slate-400">R{doc.revisionNumber} · {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "—"} · {new Date(doc.generatedAt).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDownloadDoc(doc)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Download size={14} /> Download</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">No PDFs generated yet. Click "Generate PDF" to create one for this revision.</p>
            )}
          </div>
          {/* Uploaded Documents */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Uploaded Documents</h2>
            <EntityDocumentTab entityType="Quotation" entityId={quotation.id} defaultDocumentType="Quotation" />
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && quotation && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Activity Timeline</h2>
          <EntityTimeline rootEntityId={quotation.parentQuotationId || quotation.id} />
        </div>
      )}

      {/* Linked Records */}
      {(quotation.rfq || quotation.deal) && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-xs">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Linked Records</h2>
          <div className="flex gap-3 flex-wrap">
            {quotation.rfq && <button onClick={() => router.push(`/rfq/${quotation.rfq.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200/40 cursor-pointer">RFQ: {quotation.rfq.rfqCode}</button>}
            {quotation.deal && <button onClick={() => router.push(`/deals/${quotation.deal.id}`)} className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200/40 cursor-pointer">Deal: {quotation.deal.dealName}</button>}
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

      {/* Revision Snapshot Modal */}
      {revisionModal.open && revisionModal.data && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setRevisionModal({ open: false, revisionNumber: 0, data: null })}>
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wide">Revision R{revisionModal.revisionNumber} Snapshot</h3>
              <button onClick={() => setRevisionModal({ open: false, revisionNumber: 0, data: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><Ico d={icons.x} size={18} /></button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold text-slate-600">Code:</span> <span className="text-slate-800">{revisionModal.data.quotationCode}</span></div>
                <div><span className="font-semibold text-slate-600">Status:</span> <span className="text-slate-800">{revisionModal.data.status}</span></div>
                <div><span className="font-semibold text-slate-600">Subtotal:</span> <span className="text-slate-800">₹{revisionModal.data.subtotal?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600">Tax:</span> <span className="text-slate-800">₹{revisionModal.data.taxAmount?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600">Discount:</span> <span className="text-slate-800">{revisionModal.data.discountPercent}%</span></div>
                <div><span className="font-semibold text-slate-600">Final:</span> <span className="text-slate-800">₹{revisionModal.data.finalAmount?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600">Valid Until:</span> <span className="text-slate-800">{revisionModal.data.validUntil ? new Date(revisionModal.data.validUntil).toLocaleDateString() : "—"}</span></div>
                <div><span className="font-semibold text-slate-600">Lead Time:</span> <span className="text-slate-800">{revisionModal.data.leadTimeDays ? `${revisionModal.data.leadTimeDays} days` : "—"}</span></div>
              </div>
              {(revisionModal.data.paymentTerms || revisionModal.data.deliveryTerms || revisionModal.data.freightTerms) && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-600">Commercial Terms:</p>
                  {revisionModal.data.paymentTerms && <p className="text-slate-700"><span className="font-medium">Payment:</span> {revisionModal.data.paymentTerms}</p>}
                  {revisionModal.data.deliveryTerms && <p className="text-slate-700"><span className="font-medium">Delivery:</span> {revisionModal.data.deliveryTerms}</p>}
                  {revisionModal.data.freightTerms && <p className="text-slate-700"><span className="font-medium">Freight:</span> {revisionModal.data.freightTerms}</p>}
                </div>
              )}
              {revisionModal.data.items?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 mb-2">Line Items:</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-1.5 font-semibold text-slate-600">Description</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 text-right">Qty</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 text-right">Price</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 text-center">Disc%</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revisionModal.data.items.map((it: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-3 py-1.5 text-slate-700">{it.description}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{it.quantity}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">₹{it.unitPrice?.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center text-slate-600">{it.discountPercent || 0}%</td>
                          <td className="px-3 py-1.5 text-right font-medium text-slate-800">₹{it.lineTotal?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {revisionModal.data.termsAndConditions && (
                <div>
                  <p className="font-semibold text-slate-600 mb-1">Terms & Conditions:</p>
                  <p className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 leading-relaxed">{revisionModal.data.termsAndConditions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection input overlay */}
      {confirmState.input && confirmState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{confirmState.title}</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Rejection Reason ID *</label>
              <input type="text" value={rejectReasonId} onChange={(e) => setRejectReasonId(e.target.value)} placeholder="e.g. RR-001" className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Rejection Description</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmState({ isOpen: false, title: "", message: "", action: () => {} }); setRejectReason(""); setRejectReasonId(""); }} className="px-4 py-2 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={confirmState.action} className="px-4 py-2 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* B.1: Start Negotiation Modal */}
      {showNegotiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Start Negotiation</h3>
              <button onClick={() => setShowNegotiateModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                <Ico d={icons.x} size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Negotiation Type</label>
                  <select
                    value={negotiateForm.negotiationType}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, negotiationType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  >
                    <option value="Price">Price</option>
                    <option value="Terms">Terms</option>
                    <option value="Scope">Scope</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Negotiation Reason</label>
                  <select
                    value={negotiateForm.negotiationReason}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, negotiationReason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Demands</label>
                <textarea
                  value={negotiateForm.customerDemands}
                  onChange={(e) => setNegotiateForm({ ...negotiateForm, customerDemands: e.target.value })}
                  rows={2}
                  placeholder="What is the customer asking for? (e.g. 10% discount, extended warranty, 30-day payment terms)"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Internal Notes</label>
                <textarea
                  value={negotiateForm.internalNotes}
                  onChange={(e) => setNegotiateForm({ ...negotiateForm, internalNotes: e.target.value })}
                  rows={2}
                  placeholder="Internal notes for the negotiation team (not visible to customer)"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                The negotiation will start in <strong>Active</strong> status with no revisions yet.
                You can propose a price revision from the Negotiation detail page after starting.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNegotiateModal(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleNegotiate} disabled={negotiating} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-60">
                {negotiating ? "Starting..." : "Start Negotiation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
