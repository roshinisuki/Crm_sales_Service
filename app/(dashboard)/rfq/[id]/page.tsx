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
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { CostingDetailsPanel } from "@/components/rfq/CostingDetailsPanel";
import { GenerateQuotationModal } from "@/components/rfq/GenerateQuotationModal";
import {
  CheckCircle, Clock, FileText, Calculator, ArrowRight,
  AlertTriangle, Trash2, Plus, Pencil, RotateCcw, Link2, DollarSign, Percent, Download
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

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  // Costing slide-over panel
  const [selectedLineItem, setSelectedLineItem] = useState<any | null>(null);
  const [isCostingPanelOpen, setIsCostingPanelOpen] = useState(false);

  // Generate + download Requirement Gathering Report PDF
  const [downloadingReport, setDownloadingReport] = useState(false);
  const downloadRequirementReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await fetch(`/api/rfq/${id}/requirement-report`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to load report data");
        return;
      }
      const data = json.data;

      // Dynamic import to keep jspdf out of the server bundle
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 14;

      const heading = (text: string) => {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(text, margin, y);
        y += 6;
        doc.setDrawColor(203, 213, 225);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      };

      const field = (label: string, value: string | null | undefined) => {
        if (!value) return;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(label + ":", margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        doc.text(String(value), margin + 38, y);
        y += 5;
      };

      // ── Section 1: Header ───────────────────────────────────────────────
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Requirement Gathering Report", margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `RFQ: ${data.rfq.rfqCode}  ·  Generated: ${new Date(data.generatedAt).toLocaleString()}`,
        margin, y
      );
      y += 10;

      // ── Section 2: Customer & Opportunity Summary ────────────────────────
      heading("1. Customer & Opportunity Summary");
      field("Customer", data.customer?.name);
      field("Customer Code", data.customer?.customerCode);
      field("City", data.customer?.city);
      field("Opportunity", data.opportunity?.dealName);
      field("Opp. Code", data.opportunity?.opportunityCode);
      field("Current Stage", data.opportunity?.currentStatus);
      field("Demo Outcome", data.opportunity?.demoOutcome);
      field("Demo Date", data.opportunity?.demoDate ? new Date(data.opportunity.demoDate).toLocaleDateString() : null);
      field("Demo Type", data.opportunity?.demoType);
      field("Interest Level", data.opportunity?.demoInterestLevel);
      y += 3;

      // ── Section 3: Demo Notes ────────────────────────────────────────────
      if (data.opportunity?.demoNotes) {
        heading("2. Demo Notes");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(data.opportunity.demoNotes, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 5;
      }

      // ── Section 4: RFQ Metadata ──────────────────────────────────────────
      heading("3. RFQ Metadata");
      field("RFQ Code", data.rfq.rfqCode);
      field("Status", data.rfq.status);
      field("Priority", data.rfq.priority);
      field("Received Date", data.rfq.receivedDate ? new Date(data.rfq.receivedDate).toLocaleDateString() : null);
      y += 3;

      // ── Section 5: Full Product Requirement List ─────────────────────────
      heading("4. Full Product Requirement List");
      if (data.requirementItems.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139);
        doc.text("No requirement items found.", margin, y);
        y += 8;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Product", "Qty", "Feasibility", "In RFQ?", "Needs Review", "Spec / Confirmed Spec", "Tooling"]],
          body: data.requirementItems.map((item: any) => [
            item.productName,
            String(item.estimatedQuantity),
            item.feasibility ?? "—",
            item.includedInRFQ ? "✓ Yes" : "✗ No",
            item.needsFeasibilityReview ? "⚠ Yes" : "No",
            item.confirmedSpec || item.specNotes || "—",
            item.toolingRequired || "—",
          ]),
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: "bold" },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 12, halign: "right" },
            2: { cellWidth: 28 },
            3: { cellWidth: 18, halign: "center" },
            4: { cellWidth: 20, halign: "center" },
            5: { cellWidth: 42 },
            6: { cellWidth: 25 },
          },
          didParseCell: (hookData: any) => {
            // Highlight needs-review rows in amber
            if (hookData.row.index >= 0 && hookData.row.section === "body") {
              const item = data.requirementItems[hookData.row.index];
              if (item?.needsFeasibilityReview) {
                hookData.cell.styles.fillColor = [254, 243, 199];
              }
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      // ── Section 6: Stage History ─────────────────────────────────────────
      if (data.stageHistory.length > 0) {
        heading("5. Stage History");
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["From", "To", "Date", "Notes"]],
          body: data.stageHistory.map((h: any) => [
            h.fromStatus ?? "—",
            h.toStatus,
            new Date(h.changedAt).toLocaleDateString(),
            h.outcomeNotes ?? "—",
          ]),
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: "bold" },
          bodyStyles: { fontSize: 8 },
        });
      }

      const filename = `requirement-report-${data.rfq.rfqCode}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Report generation error:", err);
      toast.error("Failed to generate report");
    } finally {
      setDownloadingReport(false);
    }
  };

  // Assign costing modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCostingUser, setAssignCostingUser] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Generate quotation checklist modal
  const [showGenQuoteModal, setShowGenQuoteModal] = useState(false);

  // Line item form
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [lineItemForm, setLineItemForm] = useState({ item_description: "", product_id: "", quantity: "1", unit: "Pcs", target_price: "", delivery_date: "", specifications: "", quantity_breaks: "" });
  const [savingLineItem, setSavingLineItem] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // Edit RFQ modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ customerDueDate: "", priority: "Normal", assignedUserId: "", requirementDetails: "", notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const canSeeFullCosting = ["CostingEngineer", "Admin", "SalesManager"].includes(user?.role || "");
  const isCostingOwner = rfq?.costingOwnerId === user?.id;
  const canOpenCosting = canSeeFullCosting || isCostingOwner || rfq?.status === "CostingPending";

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

  // Line item handlers
  const openAddLineItem = () => {
    setEditingLineItemId(null);
    setLineItemForm({ item_description: "", product_id: "", quantity: "1", unit: "Pcs", target_price: "", delivery_date: "", specifications: "", quantity_breaks: "" });
    setShowLineItemModal(true);
  };

  const openEditLineItem = (item: any) => {
    setEditingLineItemId(item.id);
    const qbString = item.quantityBreaks ? item.quantityBreaks.map((q: any) => q.quantity).join(", ") : "";
    setLineItemForm({
      item_description: item.itemDescription || "",
      product_id: item.productId || "",
      quantity: String(item.quantity || 1),
      unit: item.unit || "Pcs",
      target_price: item.targetPrice ? String(item.targetPrice) : "",
      delivery_date: item.requestedDeliveryDate ? new Date(item.requestedDeliveryDate).toISOString().split("T")[0] : "",
      specifications: item.specifications || "",
      quantity_breaks: qbString,
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
      // Parse quantity breaks (comma-separated list of numbers)
      const breaksStr = lineItemForm.quantity_breaks.trim();
      let quantityBreaks: number[] = [];
      if (breaksStr) {
        quantityBreaks = breaksStr.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0);
      }
      // Include the primary quantity in breaks if not already present
      const primaryQty = parseFloat(lineItemForm.quantity) || 1;
      if (!quantityBreaks.includes(primaryQty)) {
        quantityBreaks.unshift(primaryQty);
      }
      // Sort breaks ascending
      quantityBreaks.sort((a, b) => a - b);

      const payload: any = {
        item_description: lineItemForm.item_description,
        product_id: lineItemForm.product_id || undefined,
        quantity: primaryQty,
        unit: lineItemForm.unit || "Pcs",
        target_price: lineItemForm.target_price || undefined,
        delivery_date: lineItemForm.delivery_date || undefined,
        specifications: lineItemForm.specifications || undefined,
        quantity_breaks: quantityBreaks,
      };

      let res;
      if (editingLineItemId) {
        res = await fetch(`/api/rfq/${id}/line-items/${editingLineItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Since we also need to support quantity breaks on creation, let's pass that to POST /line-items
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

  // KPI Calculations
  const totalItemsCount = rfq.lineItems?.length || 0;
  const pendingItemsCount = rfq.lineItems?.filter((item: any) => item.costingStatus !== "Done").length || 0;

  let costedValue = 0;
  let totalMarginSum = 0;
  let costedSheetsCount = 0;

  for (const item of rfq.lineItems || []) {
    for (const qb of item.quantityBreaks || []) {
      if (qb.computedUnitPrice > 0) {
        costedValue += qb.computedUnitPrice * qb.quantity;
      }
    }
  }

  for (const cs of costingSheets) {
    if (cs.marginPercent != null) {
      totalMarginSum += cs.marginPercent;
      costedSheetsCount++;
    }
  }
  const avgMargin = costedSheetsCount > 0 ? (totalMarginSum / costedSheetsCount).toFixed(1) : "0.0";

  return (
    <PageShell
      title={rfq.rfqCode}
      subtitle={rfq.customer?.name}
      breadcrumb={[{ label: "RFQs", href: "/rfq" }]}
    >
      <div className="space-y-6">
        {/* Deal linkage link */}
        {rfq.opportunity && (
          <div className="flex items-center gap-1.5 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
            <Link2 size={13} />
            <span>RFQ created from deal:</span>
            <button
              onClick={() => router.push(`/sales-pipeline/${rfq.opportunityId}/opportunity-detail`)}
              className="font-bold underline hover:text-emerald-600 cursor-pointer"
            >
              {rfq.opportunity.dealName}
            </button>
          </div>
        )}

        {/* Lifecycle Stepper — RFQ → Quotation → Negotiation → Won/Lost */}
        <div className="crm-card p-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { label: "RFQ", key: "rfq", id: id, reached: true, current: true },
              { label: "Quotation", key: "quotation", id: rfq.quotations?.[0]?.id, reached: rfq.quotations?.length > 0 },
              { label: "Negotiation", key: "negotiation", id: rfq.quotations?.[0]?.negotiationId, reached: !!rfq.quotations?.[0]?.negotiationId },
              { label: "Won/Lost", key: "outcome", id: null, reached: ["Accepted", "Rejected"].includes(rfq.quotations?.[0]?.status) },
            ].map((step, i, arr) => (
              <div key={step.key} className="flex items-center shrink-0">
                <div
                  onClick={() => {
                    if (step.id && !step.current) {
                      if (step.key === "quotation") router.push(`/quotations/${step.id}`);
                      else if (step.key === "negotiation") router.push(`/negotiations/${step.id}`);
                    }
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    step.current
                      ? "bg-[var(--primary)] text-white"
                      : step.reached
                      ? "bg-green-50 text-green-700 cursor-pointer hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/50"
                  }`}
                >
                  {step.reached && !step.current && <CheckCircle size={12} />}
                  {step.label}
                </div>
                {i < arr.length - 1 && <div className={`w-6 h-0.5 mx-1 ${step.reached ? "bg-green-300" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Next Step Button — single prominent action driven by status */}
        <div className="crm-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Step</p>
            {rfq.status === "QuotationCreated" || rfq.status === "Closed" ? (
              <p className="text-sm text-slate-600 mt-0.5">RFQ workflow complete — view the linked quotation below</p>
            ) : pendingItemsCount > 0 ? (
              <p className="text-sm text-slate-600 mt-0.5">Cost all {pendingItemsCount} pending line item(s) to enable quotation generation</p>
            ) : rfq.lineItems?.length === 0 ? (
              <p className="text-sm text-slate-600 mt-0.5">Add at least one line item to proceed</p>
            ) : (
              <p className="text-sm text-slate-600 mt-0.5">All items costed — ready to generate quotation</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Download Requirement Report — available from status New onward */}
            {rfq.opportunityId && (
              <button
                onClick={downloadRequirementReport}
                disabled={downloadingReport}
                title="Download the full requirement gathering report as PDF"
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              >
                <Download size={14} className="text-slate-500" />
                <span>{downloadingReport ? "Generating..." : "Download Report"}</span>
              </button>
            )}
            {rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
              <button
                onClick={() => {
                  if (rfq.lineItems?.length === 0) {
                    toast.error("Add at least one line item first");
                  } else if (pendingItemsCount > 0) {
                    toast.error(`${pendingItemsCount} item(s) still need costing`);
                  } else {
                    setShowGenQuoteModal(true);
                  }
                }}
                disabled={rfq.lineItems?.length === 0 || pendingItemsCount > 0}
                title={rfq.lineItems?.length === 0 ? "Add line items first" : pendingItemsCount > 0 ? `${pendingItemsCount} item(s) need costing` : "Generate quotation from costing"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ArrowRight size={16} /> Generate Quotation →
              </button>
            )}
            {rfq.quotations?.length > 0 && (
              <button
                onClick={() => router.push(`/quotations/${rfq.quotations[0].id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer transition-all"
              >
                <ArrowRight size={16} /> View Quotation →
              </button>
            )}
          </div>
        </div>

        {/* Header Card */}
        <div className="crm-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{rfq.rfqCode}</h2>
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

        {/* KPI metrics row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="crm-card p-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Costed Value</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">₹{costedValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="crm-card p-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Costing Items</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{pendingItemsCount} of {totalItemsCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-500">
              <Clock size={20} />
            </div>
          </div>
          <div className="crm-card p-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Margin</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{avgMargin}%</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-500">
              <Percent size={20} />
            </div>
          </div>
        </div>

        {/* Status Progress Tracker */}
        <div className="crm-card p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Status Progress</h3>
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
          {/* Quick status change — sequential enforcement */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">Change status:</span>
            <select
              value={rfq.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer"
            >
              {STATUS_STEPS.map((s, idx) => {
                const currentIdx = STATUS_STEPS.findIndex((st) => st.key === rfq.status);
                const isCurrent = s.key === rfq.status;
                const isNext = idx === currentIdx + 1;
                const isPast = idx <= currentIdx;
                const label = isCurrent ? `${s.label} (current)` : isNext ? `${s.label} →` : isPast ? s.label : s.label;
                return (
                  <option key={s.key} value={s.key} disabled={!isCurrent && !isNext && !isPast}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span className="text-xs text-slate-400">Only the next status in sequence is selectable. Closed RFQs can be reopened via the Reopen button.</span>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Line Items</h3>
              <p className="text-xs text-slate-400 mt-0.5">💡 Click on any line item to open its costing sheet and input manufacturing parameters.</p>
            </div>
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
                    <th className="crm-th">Product Linked</th>
                    <th className="crm-th">Status</th>
                    <th className="crm-th">Quantity Breaks / Tiers</th>
                    <th className="crm-th">Target Price</th>
                    <th className="crm-th">Requested Delivery Date</th>
                    {rfq.status === "CostingPending" && canOpenCosting && (
                      <th className="crm-th text-right">Costing</th>
                    )}
                    {rfq.status !== "CostingPending" && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
                      <th className="crm-th text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rfq.lineItems.map((item: any) => {
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (canOpenCosting) {
                            setSelectedLineItem(item);
                            setIsCostingPanelOpen(true);
                          }
                        }}
                        className={cn(
                          "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors",
                          item.needsFeasibilityReview && "bg-amber-50/30 dark:bg-amber-950/10 border-l-2 border-l-amber-500"
                        )}
                      >
                        <td className="crm-td font-medium text-foreground">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{item.itemDescription}</span>
                            {item.needsFeasibilityReview && (
                              <span className="inline-flex items-center w-max gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-250 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30">
                                ⚠ Needs Feasibility Review
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="crm-td text-foreground">{item.product?.name || item.product?.productCode || <span className="text-slate-300 italic">No master product</span>}</td>
                        <td className="crm-td">
                          {item.costingStatus === "Done" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Costed
                            </span>
                          ) : item.costingStatus === "InProgress" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                              Costing Pending
                            </span>
                          )}
                        </td>
                        <td className="crm-td text-foreground">
                          <div className="flex flex-wrap gap-1">
                            {item.quantityBreaks && item.quantityBreaks.length > 0 ? (
                              item.quantityBreaks.map((qb: any) => (
                                <span key={qb.id} className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/50">
                                  {qb.quantity} qty {qb.computedUnitPrice > 0 && `(₹${qb.computedUnitPrice.toFixed(2)})`}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="crm-td text-foreground">{item.targetPrice ? `₹${item.targetPrice.toFixed(2)}` : "—"}</td>
                        <td className="crm-td text-foreground">{item.requestedDeliveryDate ? formatDate(item.requestedDeliveryDate) : "—"}</td>
                        {rfq.status === "CostingPending" && canOpenCosting && (
                          <td className="crm-td text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedLineItem(item);
                                setIsCostingPanelOpen(true);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                                item.costingStatus === "Done"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                  : "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                              }`
                              }
                            >
                              <Calculator size={14} />
                              {item.costingStatus === "Done" ? "Edit Costing" : "Start Costing"}
                            </button>
                          </td>
                        )}
                        {rfq.status !== "CostingPending" && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
                          <td className="crm-td text-right" onClick={(e) => e.stopPropagation()}>
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
                    );
                  })}
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
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Assign Costing Owner</h3>
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
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Status History</h3>
            <div className="space-y-3">
              {rfq.rfqStatusHistories.map((h: any, idx: number) => (
                <div key={h.id || idx} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-2.5 h-2.5 rounded-full", idx === 0 ? "bg-[var(--primary)]" : "bg-slate-300")} />
                    {idx < rfq.rfqStatusHistories.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{h.toStatus.replace(/([A-Z])/g, " $1").trim()}</span>
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

        {/* Generate Quotation Button */}
        {rfq.lineItems && rfq.lineItems.length > 0 && rfq.status !== "QuotationCreated" && rfq.status !== "Closed" && (
          <div className="crm-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Generate Quotation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Create a quotation from this RFQ with the latest costing</p>
              </div>
              <button
                onClick={() => setShowGenQuoteModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 cursor-pointer animate-pulse"
              >
                <ArrowRight size={16} /> Generate Quotation
              </button>
            </div>
          </div>
        )}

        {/* Linked Quotations */}
        {rfq.quotations && rfq.quotations.length > 0 && (
          <div className="crm-card p-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Linked Quotations</h3>
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

      {/* Slide-over panel costing details */}
      <CostingDetailsPanel
        isOpen={isCostingPanelOpen}
        onClose={() => {
          setSelectedLineItem(null);
          setIsCostingPanelOpen(false);
        }}
        lineItem={selectedLineItem}
        rfqId={id}
        onSaved={() => {
          loadRFQ();
          loadCostingSheets();
        }}
      />

      {/* Generate Quotation Checklist Modal */}
      <GenerateQuotationModal
        isOpen={showGenQuoteModal}
        onClose={() => setShowGenQuoteModal(false)}
        rfqId={id}
        userRole={user?.role}
        onSuccess={(quotationId, quotationCode) => {
          toast.success(`Quotation ${quotationCode} generated successfully!`);
          router.push(`/quotations/${quotationId}`);
        }}
      />

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
            <FormField label="Primary Quantity">
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
            <FormField label="Quantity Breaks / Tiers (optional)">
              <Input
                type="text"
                value={lineItemForm.quantity_breaks}
                onChange={(e: any) => setLineItemForm({ ...lineItemForm, quantity_breaks: e.target.value })}
                placeholder="e.g. 500, 1000, 2000"
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
