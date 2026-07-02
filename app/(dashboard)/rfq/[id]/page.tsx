"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { formatDate, formatDateTime, cn } from "@/lib/ui-utils";
import { FieldGrid } from "@/components/shared/FieldGrid";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  CheckCircle, Clock, FileText, Calculator, ArrowRight,
  AlertTriangle, Upload, Download, Trash2, Plus,
} from "lucide-react";

const STATUS_STEPS = [
  { key: "New", label: "New", icon: FileText },
  { key: "UnderReview", label: "Under Review", icon: Clock },
  { key: "CostingPending", label: "Costing Pending", icon: Calculator },
  { key: "QuotationCreated", label: "Quotation Created", icon: CheckCircle },
  { key: "Closed", label: "Closed", icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  CostingPending: "bg-orange-100 text-orange-700",
  QuotationCreated: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-600",
};

export default function RFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [costingSheets, setCostingSheets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  // Costing form state
  const [costingForm, setCostingForm] = useState({ material_cost: "", labour_cost: "", overhead_percent: "", margin_percent: "", notes: "" });
  const [submittingCosting, setSubmittingCosting] = useState(false);

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
  }, [id]);

  // Real-time costing calculator
  const computedPrice = (() => {
    const m = parseFloat(costingForm.material_cost) || 0;
    const l = parseFloat(costingForm.labour_cost) || 0;
    const o = parseFloat(costingForm.overhead_percent) || 0;
    const mg = parseFloat(costingForm.margin_percent) || 0;
    if (m <= 0 || l <= 0) return 0;
    return (m + l) * (1 + o / 100) * (1 + mg / 100);
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
    const m = parseFloat(costingForm.material_cost);
    const l = parseFloat(costingForm.labour_cost);
    const o = parseFloat(costingForm.overhead_percent);
    const mg = parseFloat(costingForm.margin_percent);

    if (!m || m <= 0) { toast.error("Material cost must be greater than 0"); return; }
    if (!l || l <= 0) { toast.error("Labour cost must be greater than 0"); return; }
    if (isNaN(o) || o < 0) { toast.error("Overhead percent must be 0 or greater"); return; }
    if (isNaN(mg) || mg < 0) { toast.error("Margin percent must be 0 or greater"); return; }

    setSubmittingCosting(true);
    try {
      const res = await fetch(`/api/rfq/${id}/costing-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_cost: m,
          labour_cost: l,
          overhead_percent: o,
          margin_percent: mg,
          notes: costingForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Costing sheet submitted");
        setCostingForm({ material_cost: "", labour_cost: "", overhead_percent: "", margin_percent: "", notes: "" });
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
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[rfq.status] || "bg-gray-100 text-gray-600"}`}>
                  {rfq.status.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${rfq.priority === "Urgent" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {rfq.priority || "Normal"}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {rfq.customer?.name} · Received {formatDate(rfq.receivedDate)}
                {rfq.assignedUser && ` · Assigned to ${rfq.assignedUser.name}`}
              </p>
            </div>
            <div className="flex gap-2">
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
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isCompleted ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-400",
                      isCurrent && "ring-4 ring-[var(--primary)]/20"
                    )}>
                      <Icon size={18} />
                    </div>
                    <span className={cn("text-xs font-medium", isCompleted ? "text-slate-800" : "text-slate-400")}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-2", idx < currentStepIndex ? "bg-[var(--primary)]" : "bg-slate-200")} />
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

        {/* Line Items Table */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Line Items</h3>
            <div className="flex gap-2">
              {rfq.status === "New" || rfq.status === "UnderReview" ? (
                <button
                  onClick={() => setShowAssignModal(true)}
                  disabled={!hasLineItems}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer",
                    hasLineItems ? "text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]" : "text-slate-400 bg-slate-100 cursor-not-allowed"
                  )}
                  title={hasLineItems ? "Assign for Costing" : "Add at least 1 line item first"}
                >
                  <Calculator size={14} /> Assign for Costing
                </button>
              ) : null}
            </div>
          </div>
          {!hasLineItems ? (
            <p className="text-sm text-slate-400 py-4 text-center">No line items added yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Description</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Product</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Qty</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Unit</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Target Price</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Delivery Date</th>
                </tr>
              </thead>
              <tbody>
                {rfq.lineItems.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-800">{item.itemDescription}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.product ? `${item.product.productCode} - ${item.product.name}` : "—"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.unit || "—"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.targetPrice ? `₹${item.targetPrice.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.requestedDeliveryDate ? formatDate(item.requestedDeliveryDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Drawings / Attachments */}
        <div className="crm-card p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Drawings & Attachments</h3>
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[var(--primary)] hover:bg-slate-50 transition-all"
            >
              <Upload size={24} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">{uploading ? "Uploading..." : "Click to upload drawing or document"}</p>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        <p className="text-xs text-slate-500">{doc.documentType} · {formatDate(doc.createdAt)}</p>
                      </div>
                    </div>
                    <a href={doc.fileUrl} download className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer" title="Download">
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Material Cost (₹)" required>
                        <Input
                          type="number"
                          step="0.01"
                          value={costingForm.material_cost}
                          onChange={(e: any) => setCostingForm({ ...costingForm, material_cost: e.target.value })}
                          placeholder="0.00"
                        />
                      </FormField>
                      <FormField label="Labour Cost (₹)" required>
                        <Input
                          type="number"
                          step="0.01"
                          value={costingForm.labour_cost}
                          onChange={(e: any) => setCostingForm({ ...costingForm, labour_cost: e.target.value })}
                          placeholder="0.00"
                        />
                      </FormField>
                      <FormField label="Overhead %" required>
                        <Input
                          type="number"
                          step="0.01"
                          value={costingForm.overhead_percent}
                          onChange={(e: any) => setCostingForm({ ...costingForm, overhead_percent: e.target.value })}
                          placeholder="0"
                        />
                      </FormField>
                      <FormField label="Margin %" required>
                        <Input
                          type="number"
                          step="0.01"
                          value={costingForm.margin_percent}
                          onChange={(e: any) => setCostingForm({ ...costingForm, margin_percent: e.target.value })}
                          placeholder="0"
                        />
                      </FormField>
                    </div>

                    {/* Real-time formula display */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Formula: (Material + Labour) × (1 + Overhead%) × (1 + Margin%)</p>
                      <p className="text-lg font-bold text-slate-800">
                        Computed Unit Price: ₹{computedPrice > 0 ? computedPrice.toFixed(2) : "0.00"}
                      </p>
                    </div>

                    <FormField label="Notes (optional)">
                      <Textarea
                        value={costingForm.notes}
                        onChange={(e: any) => setCostingForm({ ...costingForm, notes: e.target.value })}
                        rows={2}
                      />
                    </FormField>

                    <button
                      onClick={handleSubmitCosting}
                      disabled={submittingCosting || computedPrice <= 0}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                    >
                      {submittingCosting ? "Submitting..." : "Submit Costing"}
                    </button>
                  </div>
                )}

                {/* Costing history */}
                {costingSheets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Costing History</p>
                    {costingSheets.map((cs: any) => (
                      <div key={cs.id} className="p-3 rounded-xl bg-slate-50">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div><span className="text-slate-500">Material:</span> <span className="font-medium text-slate-800">₹{cs.materialCost.toFixed(2)}</span></div>
                          <div><span className="text-slate-500">Labour:</span> <span className="font-medium text-slate-800">₹{cs.labourCost.toFixed(2)}</span></div>
                          <div><span className="text-slate-500">Overhead:</span> <span className="font-medium text-slate-800">{cs.overheadPercent}%</span></div>
                          <div><span className="text-slate-500">Margin:</span> <span className="font-medium text-slate-800">{cs.marginPercent}%</span></div>
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
