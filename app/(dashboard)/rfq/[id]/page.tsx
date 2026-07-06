"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { formatDate, formatDateTime, cn } from "@/lib/ui-utils";
import { FieldGrid } from "@/components/shared/FieldGrid";
import { StatusPill } from "@/components/shared/StatusPill";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import {
  CheckCircle, Clock, FileText, Calculator, ArrowRight,
  AlertTriangle, Upload, Download, Trash2, Plus, Pencil, X, RotateCcw,
} from "lucide-react";

const STATUS_STEPS = [
  { key: "New", label: "New", icon: FileText },
  { key: "UnderReview", label: "Under Review", icon: Clock },
  { key: "CostingPending", label: "Costing Pending", icon: Calculator },
  { key: "QuotationCreated", label: "Quotation Created", icon: CheckCircle },
  { key: "Closed", label: "Closed", icon: CheckCircle },
];

const statusStyles: Record<string, { badge: string; dot: string; step: string }> = {
  New: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", step: "bg-blue-500" },
  UnderReview: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", step: "bg-amber-500" },
  CostingPending: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", step: "bg-orange-500" },
  QuotationCreated: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", step: "bg-emerald-500" },
  Closed: { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", step: "bg-slate-400" },
};

export default function RFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [rfq, setRfq] = useState<any>(null);
  useSyncUrlParam(rfq?.status, "status");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [costingSheets, setCostingSheets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  // Costing form state — per-line-item mode
  const [costingForm, setCostingForm] = useState({ material_cost: "", labour_cost: "", overhead_percent: "", margin_percent: "", freight_cost: "", packaging_cost: "", tooling_cost: "", other_cost: "", notes: "" });
  const [submittingCosting, setSubmittingCosting] = useState(false);
  const [perLineItemCosting, setPerLineItemCosting] = useState<Record<string, any>>({});
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [showCostingHistory, setShowCostingHistory] = useState(false);

  // Assign costing modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCostingUser, setAssignCostingUser] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Generate quotation confirmation
  const [showGenQuoteModal, setShowGenQuoteModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Line item form
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [lineItemForm, setLineItemForm] = useState({ item_description: "", product_id: "", quantity: "1", unit: "", target_price: "", delivery_date: "", specifications: "" });
  const [savingLineItem, setSavingLineItem] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // Edit RFQ modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ customerDueDate: "", priority: "Normal", assignedUserId: "", requirementDetails: "", notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const canSeeFullCosting = ["CostingEngineer", "Admin", "SalesManager"].includes(user?.role || "");

  const loadRFQ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rfq/${id}`);
      const data = await res.json();
      if (data.success) {
        setRfq(data.data);
      }
    } catch {
      toast.error("Failed to load RFQ");
    } finally {
      setLoading(false);
    }
  };

  const loadCostingSheets = async () => {
    try {
      const res = await fetch(`/api/rfq/${id}/costing-sheet`);
      const data = await res.json();
      if (data.success) setCostingSheets(data.data);
    } catch {}
  };

  const loadDocuments = async () => {
    try {
      const res = await fetch(`/api/rfq/${id}/documents`);
      const data = await res.json();
      if (data.success) setDocuments(data.data);
    } catch {}
  };

  useEffect(() => {
    loadRFQ();
    loadCostingSheets();
    loadDocuments();
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
    fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); });
  }, [id]);

  // Real-time costing calculator — includes additional costs
  const computedPrice = (() => {
    const m = parseFloat(costingForm.material_cost) || 0;
    const l = parseFloat(costingForm.labour_cost) || 0;
    const o = parseFloat(costingForm.overhead_percent) || 0;
    const mg = parseFloat(costingForm.margin_percent) || 0;
    const fr = parseFloat(costingForm.freight_cost) || 0;
    const pk = parseFloat(costingForm.packaging_cost) || 0;
    const tl = parseFloat(costingForm.tooling_cost) || 0;
    const ot = parseFloat(costingForm.other_cost) || 0;
    if (m <= 0 || l <= 0) return 0;
    return (m + l + fr + pk + tl + ot) * (1 + o / 100) * (1 + mg / 100);
  })();

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/rfq/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status changed to ${newStatus}`);
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleAssignCosting = async () => {
    if (!assignCostingUser) {
      toast.error("Please select a costing owner");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`/api/rfq/${id}/assign-costing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_costing_owner: assignCostingUser }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Costing owner assigned");
        setShowAssignModal(false);
        setAssignCostingUser("");
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to assign costing owner");
      }
    } catch {
      toast.error("Failed to assign costing owner");
    } finally {
      setAssigning(false);
    }
  };

  const handleSubmitCosting = async () => {
    // Check if per-line-item mode (RFQ has line items)
    const hasLineItems = rfq?.lineItems && rfq.lineItems.length > 0;

    setSubmittingCosting(true);
    try {
      let body: any;

      if (hasLineItems) {
        // Per-line-item costing
        const lineItems = rfq.lineItems.map((li: any) => {
          const lc = perLineItemCosting[li.id] || {};
          return {
            line_item_id: li.id,
            material_cost: lc.material_cost || "0",
            labour_cost: lc.labour_cost || "0",
            overhead_percent: lc.overhead_percent || "0",
            margin_percent: lc.margin_percent || "0",
            freight_cost: lc.freight_cost || "0",
            packaging_cost: lc.packaging_cost || "0",
            tooling_cost: lc.tooling_cost || "0",
            other_cost: lc.other_cost || "0",
            notes: costingForm.notes || undefined,
          };
        });

        // Validate at least material + labour > 0 for each
        for (const li of lineItems) {
          if (parseFloat(li.material_cost) <= 0 || parseFloat(li.labour_cost) <= 0) {
            toast.error("Material and labour cost must be > 0 for each line item");
            setSubmittingCosting(false);
            return;
          }
        }

        body = { line_items: lineItems };
      } else {
        // Legacy single costing
        const m = parseFloat(costingForm.material_cost);
        const l = parseFloat(costingForm.labour_cost);
        const o = parseFloat(costingForm.overhead_percent);
        const mg = parseFloat(costingForm.margin_percent);

        if (!m || m <= 0) { toast.error("Material cost must be greater than 0"); setSubmittingCosting(false); return; }
        if (!l || l <= 0) { toast.error("Labour cost must be greater than 0"); setSubmittingCosting(false); return; }
        if (isNaN(o) || o < 0) { toast.error("Overhead percent must be 0 or greater"); setSubmittingCosting(false); return; }
        if (isNaN(mg) || mg < 0) { toast.error("Margin percent must be 0 or greater"); setSubmittingCosting(false); return; }

        body = {
          material_cost: m,
          labour_cost: l,
          overhead_percent: o,
          margin_percent: mg,
          freight_cost: parseFloat(costingForm.freight_cost) || 0,
          packaging_cost: parseFloat(costingForm.packaging_cost) || 0,
          tooling_cost: parseFloat(costingForm.tooling_cost) || 0,
          other_cost: parseFloat(costingForm.other_cost) || 0,
          notes: costingForm.notes || undefined,
        };
      }

      const res = await fetch(`/api/rfq/${id}/costing-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Costing sheet submitted");
        setCostingForm({ material_cost: "", labour_cost: "", overhead_percent: "", margin_percent: "", freight_cost: "", packaging_cost: "", tooling_cost: "", other_cost: "", notes: "" });
        setPerLineItemCosting({});
        loadCostingSheets();
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to submit costing");
      }
    } catch {
      toast.error("Failed to submit costing");
    } finally {
      setSubmittingCosting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      toast.error("A reason is required to reopen the RFQ");
      return;
    }
    setReopening(true);
    try {
      const res = await fetch(`/api/rfq/${id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("RFQ reopened");
        setShowReopenModal(false);
        setReopenReason("");
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to reopen");
      }
    } catch {
      toast.error("Failed to reopen RFQ");
    } finally {
      setReopening(false);
    }
  };

  const handleGenerateQuotation = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/rfq/${id}/generate-quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Quotation ${data.data.quotation_code} generated`);
        setShowGenQuoteModal(false);
        router.push(`/quotations/${data.data.quotation_id}`);
      } else {
        toast.error(data.message || "Failed to generate quotation");
      }
    } catch {
      toast.error("Failed to generate quotation");
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", "Drawing");
      const res = await fetch(`/api/rfq/${id}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        toast.success("File uploaded");
        loadDocuments();
      } else {
        toast.error(data.message || "Failed to upload");
      }
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Line item handlers
  const openAddLineItem = () => {
    setEditingLineItemId(null);
    setLineItemForm({ item_description: "", product_id: "", quantity: "1", unit: "", target_price: "", delivery_date: "", specifications: "" });
    setShowLineItemModal(true);
  };

  const openEditLineItem = (item: any) => {
    setEditingLineItemId(item.id);
    setLineItemForm({
      item_description: item.itemDescription || "",
      product_id: item.productId || "",
      quantity: String(item.quantity || 1),
      unit: item.unit || "",
      target_price: item.targetPrice ? String(item.targetPrice) : "",
      delivery_date: item.requestedDeliveryDate ? new Date(item.requestedDeliveryDate).toISOString().split("T")[0] : "",
      specifications: item.specifications || "",
    });
    setShowLineItemModal(true);
  };

  const handleSaveLineItem = async () => {
    if (!lineItemForm.item_description.trim()) {
      toast.error("Description is required");
      return;
    }
    setSavingLineItem(true);
    try {
      const payload: any = {
        item_description: lineItemForm.item_description,
        product_id: lineItemForm.product_id || undefined,
        quantity: lineItemForm.quantity,
        unit: lineItemForm.unit || undefined,
        target_price: lineItemForm.target_price || undefined,
        delivery_date: lineItemForm.delivery_date || undefined,
        specifications: lineItemForm.specifications || undefined,
      };

      let res;
      if (editingLineItemId) {
        res = await fetch(`/api/rfq/${id}/line-items/${editingLineItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/rfq/${id}/line-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data.success) {
        toast.success(editingLineItemId ? "Line item updated" : "Line item added");
        setShowLineItemModal(false);
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to save line item");
      }
    } catch {
      toast.error("Failed to save line item");
    } finally {
      setSavingLineItem(false);
    }
  };

  const handleDeleteLineItem = (itemId: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Line Item",
      message: "Are you sure you want to delete this line item?",
      action: async () => {
        try {
          const res = await fetch(`/api/rfq/${id}/line-items/${itemId}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Line item deleted");
            loadRFQ();
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete line item");
        }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  // Edit RFQ handler
  const openEditModal = () => {
    if (!rfq) return;
    setEditForm({
      customerDueDate: rfq.customerDueDate ? new Date(rfq.customerDueDate).toISOString().split("T")[0] : "",
      priority: rfq.priority || "Normal",
      assignedUserId: rfq.assignedUserId || "",
      requirementDetails: rfq.requirementDetails || "",
      notes: rfq.notes || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/rfq/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerDueDate: editForm.customerDueDate || undefined,
          priority: editForm.priority,
          assignedUserId: editForm.assignedUserId || undefined,
          requirementDetails: editForm.requirementDetails || undefined,
          notes: editForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("RFQ updated");
        setShowEditModal(false);
        loadRFQ();
      } else {
        toast.error(data.message || "Failed to update RFQ");
      }
    } catch {
      toast.error("Failed to update RFQ");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete RFQ",
      message: "Are you sure you want to delete this RFQ?",
      action: async () => {
        try {
          const res = await fetch(`/api/rfq/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("RFQ deleted");
            router.push("/rfq");
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete");
        }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  if (loading) return <PageShell title="RFQ Details"><p className="text-slate-400 p-6">Loading...</p></PageShell>;
  if (!rfq) return <PageShell title="RFQ Details"><p className="text-slate-400 p-6">RFQ not found</p></PageShell>;

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === rfq.status);
  const now = new Date();
  const daysUntilDue = rfq.customerDueDate
    ? Math.ceil((new Date(rfq.customerDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const hasLineItems = rfq.lineItems && rfq.lineItems.length > 0;
  const hasCostingSheet = costingSheets.length > 0;
  const latestCosting = costingSheets[0];

  return (
    <PageShell
      title={rfq.rfqCode}
      subtitle={rfq.customer?.name}
      breadcrumb={[{ label: "RFQs", href: "/rfq" }]}
    >
      <div className="space-y-6">
        {/* Header Card */}
        <div className="crm-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{rfq.rfqCode}</h2>
                {rfq.revisedAt && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium" title={`Revised: ${formatDate(rfq.revisedAt)}`}>
                    REVISED
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${(statusStyles[rfq.status] || statusStyles.Closed).badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${(statusStyles[rfq.status] || statusStyles.Closed).dot}`} />
                  {rfq.status.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${rfq.priority === "Urgent" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {rfq.priority || "Normal"}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {rfq.customer?.name} · Received {formatDate(rfq.receivedDate)}
                {rfq.assignedUser && ` · Assigned to ${rfq.assignedUser.name}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={openEditModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                <Pencil size={14} /> Edit
              </button>
              {rfq.status === "Closed" && (
                <button onClick={() => setShowReopenModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer">
                  <RotateCcw size={14} /> Reopen
                </button>
              )}
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {/* Urgency countdown */}
          {daysUntilDue !== null && rfq.status !== "Closed" && rfq.status !== "QuotationCreated" && (
            <div className={cn("p-3 rounded-xl text-sm font-medium", daysUntilDue <= 2 ? "bg-red-50 text-red-700" : daysUntilDue <= 5 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>
              {daysUntilDue > 0
                ? `${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""} until customer due date (${formatDate(rfq.customerDueDate)})`
                : daysUntilDue === 0
                ? "Customer due date is today!"
                : `Customer due date was ${Math.abs(daysUntilDue)} day(s) ago — OVERDUE`}
            </div>
          )}
        </div>

        {/* Status Progress Tracker */}
        <div className="crm-card p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Status Progress</h3>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all border",
                      isCompleted ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-slate-50 text-slate-400 border-slate-200",
                      isCurrent && "ring-4 ring-[var(--primary)]/15"
                    )}>
                      <Icon size={18} />
                    </div>
                    <span className={cn("text-xs font-medium", isCompleted ? "text-slate-800" : "text-slate-400")}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-2 rounded-full transition-colors", idx < currentStepIndex ? "bg-[var(--primary)]" : "bg-slate-200")} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Quick status change */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">Change status:</span>
            <select
              value={rfq.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer"
            >
              {STATUS_STEPS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Line Items</h3>
            {rfq.status !== "CostingPending" && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
              <button onClick={openAddLineItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">
                <Plus size={14} /> Add Line Item
              </button>
            )}
          </div>
          {rfq.lineItems && rfq.lineItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">Description</th>
                    <th className="crm-th">Product</th>
                    <th className="crm-th">Qty</th>
                    <th className="crm-th">Unit</th>
                    <th className="crm-th">Target Price</th>
                    <th className="crm-th">Delivery Date</th>
                    {rfq.status !== "CostingPending" && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
                      <th className="crm-th text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rfq.lineItems.map((item: any) => (
                    <tr key={item.id}>
                      <td className="crm-td font-medium text-foreground">{item.itemDescription}</td>
                      <td className="crm-td text-foreground">{item.product?.name || item.product?.productCode || "—"}</td>
                      <td className="crm-td text-foreground">{item.quantity}</td>
                      <td className="crm-td text-foreground">{item.unit || "—"}</td>
                      <td className="crm-td text-foreground">{item.targetPrice ? `₹${item.targetPrice.toFixed(2)}` : "—"}</td>
                      <td className="crm-td text-foreground">{item.requestedDeliveryDate ? formatDate(item.requestedDeliveryDate) : "—"}</td>
                      {rfq.status !== "CostingPending" && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
                        <td className="crm-td text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEditLineItem(item)} className="row-action-btn" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteLineItem(item.id)} className="row-action-btn row-action-btn-danger" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No line items added yet</p>
          )}
        </div>

        {/* Assign Costing Button — visible when UnderReview and no costing owner */}
        {rfq.status === "UnderReview" && !rfq.costingOwnerId && (
          <div className="crm-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Assign Costing Owner</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign a costing engineer to proceed with costing</p>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                <Calculator size={16} /> Assign Costing
              </button>
            </div>
          </div>
        )}

        {/* Status History */}
        {rfq.rfqStatusHistories && rfq.rfqStatusHistories.length > 0 && (
          <div className="crm-card p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Status History</h3>
            <div className="space-y-3">
              {rfq.rfqStatusHistories.map((h: any, idx: number) => (
                <div key={h.id || idx} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-2.5 h-2.5 rounded-full", idx === 0 ? "bg-[var(--primary)]" : "bg-slate-300")} />
                    {idx < rfq.rfqStatusHistories.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{h.toStatus.replace(/([A-Z])/g, " $1").trim()}</span>
                      {h.fromStatus && <span className="text-xs text-slate-400">from {h.fromStatus.replace(/([A-Z])/g, " $1").trim()}</span>}
                    </div>
                    {h.notes && <p className="text-xs text-slate-500 mt-0.5">{h.notes}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {h.changedBy?.name || "System"} · {formatDateTime(h.changedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drawings / Attachments */}
        <div className="crm-card p-6">
          <EntityDocumentTab
            entityType="RFQ"
            entityId={rfq.id}
            defaultDocumentType="Drawing"
            allowedDocumentTypes={["Drawing", "TechnicalSpec", "Other"]}
          />
        </div>

        {/* Costing Sheet Section — visible after Costing Pending */}
        {(rfq.status === "CostingPending" || rfq.status === "QuotationCreated" || rfq.status === "Closed") && (
          <div className="crm-card p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Costing Sheet</h3>

            {/* Role-restricted: Full breakdown for Costing Engineer / Admin / Sales Manager */}
            {canSeeFullCosting ? (
              <>
                {rfq.status === "CostingPending" && (
                  <div className="space-y-4 mb-6">
                    {/* Per-line-item costing mode */}
                    {rfq.lineItems && rfq.lineItems.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Per-Line-Item Costing</p>
                        {rfq.lineItems.map((li: any) => {
                          const lc = perLineItemCosting[li.id] || {};
                          const liPrice = (() => {
                            const m = parseFloat(lc.material_cost) || 0;
                            const l = parseFloat(lc.labour_cost) || 0;
                            const o = parseFloat(lc.overhead_percent) || 0;
                            const mg = parseFloat(lc.margin_percent) || 0;
                            const fr = parseFloat(lc.freight_cost) || 0;
                            const pk = parseFloat(lc.packaging_cost) || 0;
                            const tl = parseFloat(lc.tooling_cost) || 0;
                            const ot = parseFloat(lc.other_cost) || 0;
                            if (m <= 0 || l <= 0) return 0;
                            return (m + l + fr + pk + tl + ot) * (1 + o / 100) * (1 + mg / 100);
                          })();
                          return (
                            <div key={li.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-800">{li.itemDescription}</span>
                                <span className="text-xs text-slate-500">Qty: {li.quantity} {li.unit || ""}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <FormField label="Material ₹" required>
                                  <Input type="number" step="0.01" value={lc.material_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, material_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                                <FormField label="Labour ₹" required>
                                  <Input type="number" step="0.01" value={lc.labour_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, labour_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                                <FormField label="Overhead %">
                                  <Input type="number" step="0.01" value={lc.overhead_percent || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, overhead_percent: e.target.value } })} placeholder="0" />
                                </FormField>
                                <FormField label="Margin %">
                                  <Input type="number" step="0.01" value={lc.margin_percent || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, margin_percent: e.target.value } })} placeholder="0" />
                                </FormField>
                                <FormField label="Freight ₹">
                                  <Input type="number" step="0.01" value={lc.freight_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, freight_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                                <FormField label="Packaging ₹">
                                  <Input type="number" step="0.01" value={lc.packaging_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, packaging_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                                <FormField label="Tooling ₹">
                                  <Input type="number" step="0.01" value={lc.tooling_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, tooling_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                                <FormField label="Other ₹">
                                  <Input type="number" step="0.01" value={lc.other_cost || ""} onChange={(e: any) => setPerLineItemCosting({ ...perLineItemCosting, [li.id]: { ...lc, other_cost: e.target.value } })} placeholder="0.00" />
                                </FormField>
                              </div>
                              {liPrice > 0 && (
                                <p className="text-xs text-slate-600 mt-2">Unit Price: <span className="font-bold">₹{liPrice.toFixed(2)}</span></p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Legacy single costing mode */
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Material Cost (₹)" required>
                          <Input type="number" step="0.01" value={costingForm.material_cost} onChange={(e: any) => setCostingForm({ ...costingForm, material_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                        <FormField label="Labour Cost (₹)" required>
                          <Input type="number" step="0.01" value={costingForm.labour_cost} onChange={(e: any) => setCostingForm({ ...costingForm, labour_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                        <FormField label="Overhead %" required>
                          <Input type="number" step="0.01" value={costingForm.overhead_percent} onChange={(e: any) => setCostingForm({ ...costingForm, overhead_percent: e.target.value })} placeholder="0" />
                        </FormField>
                        <FormField label="Margin %" required>
                          <Input type="number" step="0.01" value={costingForm.margin_percent} onChange={(e: any) => setCostingForm({ ...costingForm, margin_percent: e.target.value })} placeholder="0" />
                        </FormField>
                        <FormField label="Freight Cost (₹)">
                          <Input type="number" step="0.01" value={costingForm.freight_cost} onChange={(e: any) => setCostingForm({ ...costingForm, freight_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                        <FormField label="Packaging Cost (₹)">
                          <Input type="number" step="0.01" value={costingForm.packaging_cost} onChange={(e: any) => setCostingForm({ ...costingForm, packaging_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                        <FormField label="Tooling Cost (₹)">
                          <Input type="number" step="0.01" value={costingForm.tooling_cost} onChange={(e: any) => setCostingForm({ ...costingForm, tooling_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                        <FormField label="Other Cost (₹)">
                          <Input type="number" step="0.01" value={costingForm.other_cost} onChange={(e: any) => setCostingForm({ ...costingForm, other_cost: e.target.value })} placeholder="0.00" />
                        </FormField>
                      </div>
                    )}

                    {/* Real-time formula display — only for legacy mode */}
                    {(!rfq.lineItems || rfq.lineItems.length === 0) && (
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Formula: (Material + Labour + Freight + Packaging + Tooling + Other) × (1 + Overhead%) × (1 + Margin%)</p>
                        <p className="text-lg font-bold text-slate-800">
                          Computed Unit Price: ₹{computedPrice > 0 ? computedPrice.toFixed(2) : "0.00"}
                        </p>
                      </div>
                    )}

                    <FormField label="Notes (optional)">
                      <Textarea
                        value={costingForm.notes}
                        onChange={(e: any) => setCostingForm({ ...costingForm, notes: e.target.value })}
                        rows={2}
                      />
                    </FormField>

                    <button
                      onClick={handleSubmitCosting}
                      disabled={submittingCosting}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                    >
                      {submittingCosting ? "Submitting..." : "Submit Costing"}
                    </button>
                  </div>
                )}

                {/* Costing history */}
                {costingSheets.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Costing History</p>
                      <button onClick={() => setShowCostingHistory(!showCostingHistory)} className="text-xs text-[var(--primary)] hover:underline cursor-pointer">
                        {showCostingHistory ? "Hide" : "Show All"}
                      </button>
                    </div>
                    {(showCostingHistory ? costingSheets : costingSheets.slice(0, 1)).map((cs: any) => (
                      <div key={cs.id} className="p-3 rounded-xl bg-slate-50">
                        {cs.rfqLineItemId && (
                          <p className="text-xs font-medium text-slate-600 mb-1">
                            Line Item: {rfq.lineItems?.find((li: any) => li.id === cs.rfqLineItemId)?.itemDescription || "—"}
                          </p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                          <div><span className="text-slate-500">Material:</span> <span className="font-medium text-slate-800">₹{cs.materialCost.toFixed(2)}</span></div>
                          <div><span className="text-slate-500">Labour:</span> <span className="font-medium text-slate-800">₹{cs.labourCost.toFixed(2)}</span></div>
                          <div><span className="text-slate-500">Overhead:</span> <span className="font-medium text-slate-800">{cs.overheadPercent}%</span></div>
                          <div><span className="text-slate-500">Margin:</span> <span className="font-medium text-slate-800">{cs.marginPercent}%</span></div>
                          <div><span className="text-slate-500">Freight:</span> <span className="font-medium text-slate-800">₹{(cs.freightCost || 0).toFixed(2)}</span></div>
                          <div><span className="text-slate-500">Unit Price:</span> <span className="font-bold text-slate-800">₹{cs.computedUnitPrice.toFixed(2)}</span></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">By {cs.submittedBy?.name || "—"} · {formatDateTime(cs.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Sales Executive / Telecaller: Read-only computed price only */
              <div className="p-4 bg-slate-50 rounded-xl">
                {latestCosting ? (
                  <p className="text-lg font-bold text-slate-800">Computed Unit Price: ₹{latestCosting.computedUnitPrice.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-slate-400">Costing sheet not yet submitted</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Quotation Button */}
        {hasCostingSheet && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
          <div className="crm-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Generate Quotation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Create a quotation from this RFQ with the latest costing</p>
              </div>
              <button
                onClick={() => setShowGenQuoteModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                <ArrowRight size={16} /> Generate Quotation
              </button>
            </div>
          </div>
        )}

        {/* Linked Quotations */}
        {rfq.quotations && rfq.quotations.length > 0 && (
          <div className="crm-card p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Linked Quotations</h3>
            <div className="space-y-2">
              {rfq.quotations.map((q: any) => (
                <button key={q.id} onClick={() => router.push(`/quotations/${q.id}`)} className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">{q.quotationCode}</span>
                  <span className="text-sm text-slate-500">₹{q.finalAmount?.toFixed(2) || "0"} · {q.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assign Costing Modal */}
      <Modal
        open={showAssignModal}
        title="Assign Costing Owner"
        subtitle="Select a user to handle costing for this RFQ"
        onClose={() => setShowAssignModal(false)}
        footer={
          <>
            <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button onClick={handleAssignCosting} disabled={assigning || !assignCostingUser} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
              {assigning ? "Assigning..." : "Assign & Move to Costing"}
            </button>
          </>
        }
      >
        <FormField label="Costing Owner" required>
          <Select value={assignCostingUser} onChange={(e: any) => setAssignCostingUser(e.target.value)}>
            <option value="">-- Select User --</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </Select>
        </FormField>
      </Modal>

      {/* Generate Quotation Confirmation Modal */}
      <Modal
        open={showGenQuoteModal}
        title="Generate Quotation"
        subtitle="This will create a quotation with line items from this RFQ"
        onClose={() => setShowGenQuoteModal(false)}
        footer={
          <>
            <button onClick={() => setShowGenQuoteModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button onClick={handleGenerateQuotation} disabled={generating} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 cursor-pointer">
              {generating ? "Generating..." : "Generate"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          A quotation will be created with:
          <br />• {rfq.lineItems?.length || 0} line item(s) from this RFQ
          <br />• Unit price: ₹{latestCosting?.computedUnitPrice.toFixed(2) || "0.00"} (from latest costing)
          <br />• Validity: 30 days from today
          <br />• Status: Draft
          <br /><br />
          You will be redirected to the quotation page after generation.
        </p>
      </Modal>

      {/* Line Item Modal (Add / Edit) */}
      <Modal
        open={showLineItemModal}
        title={editingLineItemId ? "Edit Line Item" : "Add Line Item"}
        subtitle={editingLineItemId ? "Update line item details" : "Add a new line item to this RFQ"}
        onClose={() => setShowLineItemModal(false)}
        footer={
          <>
            <button onClick={() => setShowLineItemModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button onClick={handleSaveLineItem} disabled={savingLineItem} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
              {savingLineItem ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Description" required>
            <Input
              type="text"
              value={lineItemForm.item_description}
              onChange={(e: any) => setLineItemForm({ ...lineItemForm, item_description: e.target.value })}
              placeholder="Item description..."
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Product">
              <Select value={lineItemForm.product_id} onChange={(e: any) => setLineItemForm({ ...lineItemForm, product_id: e.target.value })}>
                <option value="">-- Select Product --</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Quantity">
              <Input
                type="number"
                value={lineItemForm.quantity}
                onChange={(e: any) => setLineItemForm({ ...lineItemForm, quantity: e.target.value })}
              />
            </FormField>
            <FormField label="Unit">
              <Input
                type="text"
                value={lineItemForm.unit}
                onChange={(e: any) => setLineItemForm({ ...lineItemForm, unit: e.target.value })}
                placeholder="pcs, kg, set..."
              />
            </FormField>
            <FormField label="Target Price">
              <Input
                type="number"
                step="0.01"
                value={lineItemForm.target_price}
                onChange={(e: any) => setLineItemForm({ ...lineItemForm, target_price: e.target.value })}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Requested Delivery Date">
              <Input
                type="date"
                value={lineItemForm.delivery_date}
                onChange={(e: any) => setLineItemForm({ ...lineItemForm, delivery_date: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Specifications">
            <Textarea
              value={lineItemForm.specifications}
              onChange={(e: any) => setLineItemForm({ ...lineItemForm, specifications: e.target.value })}
              rows={2}
            />
          </FormField>
        </div>
      </Modal>

      {/* Edit RFQ Modal */}
      <Modal
        open={showEditModal}
        title="Edit RFQ"
        subtitle="Update RFQ details"
        onClose={() => setShowEditModal(false)}
        footer={
          <>
            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer Due Date">
              <Input
                type="date"
                value={editForm.customerDueDate}
                onChange={(e: any) => setEditForm({ ...editForm, customerDueDate: e.target.value })}
              />
            </FormField>
            <FormField label="Priority">
              <Select value={editForm.priority} onChange={(e: any) => setEditForm({ ...editForm, priority: e.target.value })}>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </Select>
            </FormField>
            <FormField label="Assigned To">
              <Select value={editForm.assignedUserId} onChange={(e: any) => setEditForm({ ...editForm, assignedUserId: e.target.value })}>
                <option value="">-- Select User --</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Requirement Details">
            <Textarea
              value={editForm.requirementDetails}
              onChange={(e: any) => setEditForm({ ...editForm, requirementDetails: e.target.value })}
              rows={3}
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={editForm.notes}
              onChange={(e: any) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={2}
            />
          </FormField>
        </div>
      </Modal>

      {/* Reopen RFQ Modal */}
      <Modal
        open={showReopenModal}
        title="Reopen RFQ"
        subtitle="Reopen this closed RFQ — a reason is required"
        onClose={() => setShowReopenModal(false)}
        footer={
          <>
            <button onClick={() => setShowReopenModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button onClick={handleReopen} disabled={reopening} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer">
              {reopening ? "Reopening..." : "Reopen RFQ"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-800">
              Reopening will change the status from <strong>Closed</strong> to <strong>Under Review</strong>.
              The costing owner will be notified if one is assigned.
            </p>
          </div>
          <FormField label="Reason for Reopening" required>
            <Textarea
              value={reopenReason}
              onChange={(e: any) => setReopenReason(e.target.value)}
              rows={3}
              placeholder="e.g. Customer returned with revised requirements..."
            />
          </FormField>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageShell>
  );
}
