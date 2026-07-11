"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

export type QuotationTab = "items" | "history" | "revisions" | "approvals" | "documents";

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  action: () => void;
  input?: boolean;
  inputLabel?: string;
}

export interface RevisionModalState {
  open: boolean;
  revisionNumber: number;
  data: any;
}

export interface NegotiateForm {
  customerDemands: string;
  internalNotes: string;
  negotiationType: string;
  negotiationReason: string;
}

export function useQuotationDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useGlobalLoading();

  const [quotation, setQuotation] = useState<any>(null);
  useSyncUrlParam(quotation?.status, "status");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QuotationTab>("items");
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: "", message: "", action: () => {} });
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
  const [revisionModal, setRevisionModal] = useState<RevisionModalState>({ open: false, revisionNumber: 0, data: null });
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [negotiateForm, setNegotiateForm] = useState<NegotiateForm>({
    customerDemands: "",
    internalNotes: "",
    negotiationType: "Price",
    negotiationReason: "Customer Request",
  });
  const [negotiating, setNegotiating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [quotationDocuments, setQuotationDocuments] = useState<any[]>([]);
  const [marginFloor, setMarginFloor] = useState(15.0);
  const [discountThreshold, setDiscountThreshold] = useState(5.0);
  const [creatingPo, setCreatingPo] = useState(false);

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

  const handleCreatePo = async () => {
    setCreatingPo(true);
    try {
      const res = await fetch(`/api/quotations/${id}/create-po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  // Loading / empty guards are handled by the consumer so all hooks above run unconditionally.
  const notFound = !loading && !quotation;

  // ---- Computed values (only meaningful when quotation is loaded) ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntilDate = quotation?.validUntil ? new Date(quotation.validUntil) : null;
  const daysRemaining = validUntilDate
    ? Math.ceil((validUntilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const validityColor =
    daysRemaining === null
      ? "text-slate-500"
      : daysRemaining <= 3
      ? "text-rose-600"
      : daysRemaining <= 7
      ? "text-amber-600"
      : "text-slate-500";

  let totalGross = 0;
  let totalNet = 0;
  let maxLineDiscount = 0;
  let hasMarginBreach = false;

  if (quotation) {
    totalNet = quotation.subtotal - (quotation.subtotal * quotation.discountPercent / 100);

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
  }

  const blendedDiscount = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

  const triggerReasons: string[] = [];
  if (quotation) {
    if (blendedDiscount > discountThreshold) {
      triggerReasons.push(`Weighted blended discount of ${blendedDiscount.toFixed(1)}% exceeds the ${discountThreshold}% limit`);
    }
    if (maxLineDiscount > discountThreshold) {
      triggerReasons.push(`Single line discount ceiling of ${maxLineDiscount.toFixed(1)}% exceeds the ${discountThreshold}% limit`);
    }
    if (hasMarginBreach) {
      triggerReasons.push(`One or more line items fall below the ${marginFloor}% margin floor`);
    }
  }

  const latestApproval = quotation?.quotationApprovals?.[0];
  const hasApprovedApproval = quotation?.quotationApprovals?.some((a: any) => a.status === "Approved");
  const needsApproval = triggerReasons.length > 0 && !hasApprovedApproval;
  const isApprover = latestApproval?.approverId === user?.id || user?.role === "Admin";

  let showBelowFloorWarning = false;
  for (const it of editItems) {
    if (it.costBasisUnitPrice) {
      const price = parseFloat(it.unitPrice) || 0;
      const cost = parseFloat(it.costBasisUnitPrice) || 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      if (margin < marginFloor) showBelowFloorWarning = true;
    }
  }

  const overallMargin = quotation?.overallMarginPercent != null ? parseFloat(String(quotation.overallMarginPercent)) : null;
  let overallMarginColor = "text-slate-400 bg-slate-100 dark:bg-slate-800";
  if (overallMargin !== null) {
    if (overallMargin >= 20) overallMarginColor = "text-emerald-700 bg-emerald-50 border border-emerald-100";
    else if (overallMargin >= marginFloor) overallMarginColor = "text-amber-700 bg-amber-50 border border-amber-100";
    else overallMarginColor = "text-rose-700 bg-rose-50 border border-rose-100 animate-pulse";
  }

  return {
    id,
    user,
    router,
    quotation,
    loading,
    notFound,
    activeTab,
    setActiveTab,
    confirmState,
    setConfirmState,
    rejectReason,
    setRejectReason,
    rejectReasonId,
    setRejectReasonId,
    editMode,
    setEditMode,
    editItems,
    setEditItems,
    editDiscount,
    setEditDiscount,
    editValidUntil,
    setEditValidUntil,
    editTerms,
    setEditTerms,
    editPaymentTerms,
    setEditPaymentTerms,
    editDeliveryTerms,
    setEditDeliveryTerms,
    editFreightTerms,
    setEditFreightTerms,
    editLeadTimeDays,
    setEditLeadTimeDays,
    savingItems,
    productSearch,
    setProductSearch,
    productResults,
    setProductResults,
    approvalNotes,
    setApprovalNotes,
    revisionModal,
    setRevisionModal,
    showNegotiateModal,
    setShowNegotiateModal,
    negotiateForm,
    setNegotiateForm,
    negotiating,
    generatingPdf,
    quotationDocuments,
    marginFloor,
    discountThreshold,
    creatingPo,
    // handlers
    loadQuotation,
    loadDocuments,
    handleGeneratePdf,
    handleDownloadDoc,
    startEdit,
    handleSaveItems,
    addEditItem,
    removeEditItem,
    updateEditItem,
    searchProducts,
    selectProduct,
    handleSend,
    handleAccept,
    handleNegotiate,
    handleReject,
    handleClone,
    handleRequestApproval,
    handleApprovalDecision,
    handleDownloadPdf,
    handleCreatePo,
    handleDelete,
    // computed
    today,
    validUntilDate,
    daysRemaining,
    validityColor,
    totalGross,
    totalNet,
    maxLineDiscount,
    hasMarginBreach,
    blendedDiscount,
    triggerReasons,
    latestApproval,
    hasApprovedApproval,
    needsApproval,
    isApprover,
    showBelowFloorWarning,
    overallMargin,
    overallMarginColor,
  };
}
