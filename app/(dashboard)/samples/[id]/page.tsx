"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { ArrowLeft, Pencil, Trash2, CheckCircle2, XCircle, ArrowRight, Package, Clock, Send, RotateCw, Calendar, User, Mail, Phone, FileText, Truck, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
  New:           { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: Package,      label: "New" },
  UnderReview:   { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: Clock,        label: "Under Review" },
  SentToCustomer:{ color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  icon: Send,         label: "Sent to Customer" },
  Approved:      { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2, label: "Approved" },
  Rejected:      { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: XCircle,      label: "Rejected" },
  Revision:      { color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  icon: RotateCw,     label: "Revision" },
};

const STAGES = ["New", "UnderReview", "SentToCustomer", "Approved"];
const statusOptions = ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"];

const nextStatusOptions: Record<string, string[]> = {
  New: ["UnderReview"],
  UnderReview: ["SentToCustomer", "Revision"],
  SentToCustomer: ["Approved", "Rejected", "Revision"],
  Approved: [],
  Rejected: ["Revision"],
  Revision: ["UnderReview"],
};

export default function SampleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();

  const [sample, setSample] = useState<any>(null);
  useSyncUrlParam(sample?.status, "status");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoading();
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionText, setRevisionText] = useState("");

  const [editForm, setEditForm] = useState<any>({});

  const loadSample = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/samples/${id}`);
      const data = await res.json();
      if (data.success) {
        setSample(data.data);
        setEditForm({
          customerId: data.data.customerId,
          contactId: data.data.contactId || "",
          productId: data.data.productId,
          rfqId: data.data.rfqId || "",
          quantity: data.data.quantity || 1,
          specifications: data.data.specifications || "",
          assignedUserId: data.data.assignedUserId || "",
          trackingNumber: data.data.trackingNumber || "",
        });
        setFeedbackText(data.data.customerFeedback || "");
        setRevisionText(data.data.revisionNotes || "");
      }
    } catch {
      toast.error("Failed to load sample");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSample();
  }, [id]);

  useEffect(() => {
    if (editing) {
      fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
      fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); });
      fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
      fetch("/api/rfq").then(res => res.json()).then(data => { if (data.success) setRfqs(data.data || []); });
    }
  }, [editing]);

  useEffect(() => {
    if (editForm.customerId) {
      fetch(`/api/contacts?customerId=${editForm.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setContacts(data.data || []);
      });
    } else {
      setContacts([]);
    }
  }, [editForm.customerId]);

  const handleStatusChange = async (newStatus: string, extra: Record<string, any> = {}) => {
    setUpdatingStatus(true);
    startLoading("Updating sample status...", "handshake");
    try {
      const res = await fetch(`/api/samples/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status changed to ${newStatus}`);
        
        // Auto-advance linked opportunity when sample is approved
        if (newStatus === "Approved" && sample.opportunityId) {
          try {
            // 1. Update sampleStatus on opportunity detail
            await fetch(`/api/opportunities/${sample.opportunityId}/details`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sampleStatus: "approved" }),
            });

            // 2. Advance deal stage to RequirementGathering (force=true bypasses sequential check)
            const stageRes = await fetch(`/api/opportunities/${sample.opportunityId}/stage-change`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to_stage: "RequirementGathering", force: true }),
            });
            const stageData = await stageRes.json();
            if (stageData.success) {
              toast.success("Deal advanced to Requirement Gathering");
            } else if (stageData.message?.includes("Already at this stage")) {
              toast.info("Deal is already at Requirement Gathering");
            } else {
              toast.error(`Stage change failed: ${stageData.message || "Unknown error"}`);
            }
          } catch {
            console.error("Failed to advance opportunity stage");
            toast.error("Failed to advance deal stage");
          }
        }
        
        // Move opportunity to Rejected when sample is rejected
        if (newStatus === "Rejected" && sample.opportunityId) {
          try {
            await fetch(`/api/opportunities/${sample.opportunityId}/details`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sampleStatus: "rejected" }),
            });
            const rejRes = await fetch(`/api/opportunities/${sample.opportunityId}/stage-change`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to_stage: "Rejected", rejectedReason: "Sample rejected" }),
            });
            const rejData = await rejRes.json();
            if (!rejData.success) {
              toast.error(`Failed to reject deal: ${rejData.message || "Unknown error"}`);
            }
          } catch {
            console.error("Failed to update opportunity stage");
          }
        }
        
        loadSample();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
      stopLoading();
    }
  };

  const handleStatusClick = (newStatus: string) => {
    if (newStatus === "Approved" || newStatus === "Rejected") {
      // Open feedback modal to capture customer feedback
      setShowFeedbackModal(true);
      return;
    }
    if (newStatus === "Revision") {
      setShowRevisionModal(true);
      return;
    }
    handleStatusChange(newStatus);
  };

  const submitFeedback = (status: string) => {
    handleStatusChange(status, { customerFeedback: feedbackText });
    setShowFeedbackModal(false);
  };

  const submitRevision = () => {
    handleStatusChange("Revision", { revisionNotes: revisionText });
    setShowRevisionModal(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/samples/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sample updated");
        setEditing(false);
        loadSample();
      } else {
        toast.error(data.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Sample Request",
      message: "Are you sure you want to delete this sample request?",
      action: async () => {
        try {
          const res = await fetch(`/api/samples/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Sample deleted");
            router.push("/samples");
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

  if (loading) return <PageContainer className="p-6"><div className="flex flex-col items-center gap-3 py-20"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /><p className="text-sm text-slate-400">Loading sample...</p></div></PageContainer>;
  if (!sample) return <PageContainer className="p-6"><div className="flex flex-col items-center gap-3 py-20"><Package size={36} className="text-slate-200" /><p className="text-sm text-slate-400">Sample not found</p></div></PageContainer>;

  const allowedNext = nextStatusOptions[sample.status] || [];
  const currentStageIdx = STAGES.indexOf(sample.status);
  const cfg = statusConfig[sample.status] || statusConfig.New;
  const StatusIcon = cfg.icon;

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/samples")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Package size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{sample.sampleCode}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sample Request Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            <Pencil size={15} /> {editing ? "Cancel Edit" : "Edit"}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Status Progress Stepper */}
      <div className="crm-card p-5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {STAGES.map((stage, idx) => {
            const isDone = idx < currentStageIdx;
            const isActive = idx === currentStageIdx;
            const isRejected = sample.status === "Rejected";
            const stageCfg = statusConfig[stage];
            const StageIcon = stageCfg.icon;
            return (
              <div key={stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    isDone ? "bg-emerald-500 text-white" :
                    isActive && !isRejected ? cn(stageCfg.bg, stageCfg.color, "ring-2 ring-offset-2 ring-current") :
                    isActive && isRejected ? "bg-red-500 text-white" :
                    "bg-slate-100 text-slate-400"
                  )}>
                    {isDone ? <CheckCircle2 size={16} /> : <StageIcon size={15} />}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold hidden sm:inline whitespace-nowrap",
                    isActive ? stageCfg.color : isDone ? "text-emerald-600" : "text-slate-400"
                  )}>
                    {stageCfg.label}
                  </span>
                </div>
                {idx < STAGES.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1.5 sm:mx-2 rounded-full transition-all",
                    isDone ? "bg-emerald-400" : "bg-slate-200"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current status badge + dropdown */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
          <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border", cfg.bg, cfg.color, cfg.border)}>
            <StatusIcon size={14} /> {cfg.label}
          </span>
          <select
            value={sample.status}
            onChange={(e) => handleStatusClick(e.target.value)}
            disabled={updatingStatus}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer disabled:opacity-50"
          >
            <option value={sample.status}>{cfg.label} (current)</option>
            {statusOptions.filter(s => s !== sample.status).map((s) => (
              <option key={s} value={s}>{statusConfig[s].label}</option>
            ))}
          </select>
        </div>

        {/* Status flow quick actions */}
        {allowedNext.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {allowedNext.map((s) => {
              const nextCfg = statusConfig[s];
              const NextIcon = nextCfg.icon;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusClick(s)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:opacity-80 border", nextCfg.bg, nextCfg.color, nextCfg.border)}
                >
                  <NextIcon size={13} /> Move to {nextCfg.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Timeline */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <Calendar size={12} className="text-slate-400" />
          <span className="font-semibold text-slate-600">Timeline:</span>
          <span>Requested: {new Date(sample.requestDate).toLocaleDateString()}</span>
          {sample.sentDate && <span>• Sent: {new Date(sample.sentDate).toLocaleDateString()}</span>}
          {sample.approvedDate && <span className="text-emerald-600">• Approved: {new Date(sample.approvedDate).toLocaleDateString()}</span>}
          {sample.rejectedDate && <span className="text-red-600">• Rejected: {new Date(sample.rejectedDate).toLocaleDateString()}</span>}
          {sample.revisionDate && <span className="text-orange-600">• Revision: {new Date(sample.revisionDate).toLocaleDateString()}</span>}
        </div>

        {/* Approved state — deal auto-advances to Requirement Gathering */}
        {sample.status === "Approved" && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Sample Approved</p>
              <p className="text-xs text-emerald-600">
                {sample.opportunityId
                  ? "Deal automatically advanced to Requirement Gathering in Sales Pipeline"
                  : "Sample approved successfully"}
              </p>
            </div>
          </div>
        )}
        {sample.status === "Rejected" && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <XCircle size={18} className="text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Sample Rejected</p>
              <p className="text-xs text-red-600">
                {sample.opportunityId
                  ? "Deal moved to Rejected stage in Sales Pipeline"
                  : "Sample rejected by customer"}
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Details Card */}
      <div className="crm-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText size={18} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sample Information</h2>
        </div>
        {editing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer *</label>
                <select
                  value={editForm.customerId}
                  onChange={(e) => setEditForm({ ...editForm, customerId: e.target.value, contactId: "" })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">-- Select --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
                <select
                  value={editForm.contactId}
                  onChange={(e) => setEditForm({ ...editForm, contactId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">-- None --</option>
                  {contacts.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product *</label>
                <select
                  value={editForm.productId}
                  onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">-- Select --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked RFQ</label>
                <select
                  value={editForm.rfqId}
                  onChange={(e) => setEditForm({ ...editForm, rfqId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">-- None --</option>
                  {rfqs.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.rfqCode}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
                <select
                  value={editForm.assignedUserId}
                  onChange={(e) => setEditForm({ ...editForm, assignedUserId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tracking Number</label>
                <input
                  type="text"
                  value={editForm.trackingNumber}
                  onChange={(e) => setEditForm({ ...editForm, trackingNumber: e.target.value })}
                  placeholder="Courier tracking number..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specifications / Notes</label>
              <textarea
                value={editForm.specifications}
                onChange={(e) => setEditForm({ ...editForm, specifications: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditing(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Customer" value={sample.customer ? `${sample.customer.customerCode} - ${sample.customer.name}` : "—"} />
              <Field label="Contact" value={sample.contact ? `${sample.contact.name}${sample.contact.title ? ` (${sample.contact.title})` : ""}` : "—"} />
              <Field label="Product" value={sample.product ? `${sample.product.productCode} - ${sample.product.name}` : "—"} />
              <Field label="Quantity" value={`${sample.quantity} ${sample.product?.unit || ""}`} />
              <Field label="Linked RFQ" value={sample.rfq ? sample.rfq.rfqCode : "—"} link={sample.rfq ? `/rfq/${sample.rfq.id}` : undefined} />
              <Field label="Assigned To" value={sample.assignedUser?.name || "—"} />
              <Field label="Tracking Number" value={sample.trackingNumber || "—"} />
              <Field label="Request Date" value={new Date(sample.requestDate).toLocaleDateString()} />
            </div>

            {sample.specifications && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <FileText size={14} className="text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Specifications / Notes</h3>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap p-4">{sample.specifications}</p>
              </div>
            )}

            {sample.customerFeedback && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <MessageSquare size={14} className="text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Customer Feedback</h3>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap p-4">{sample.customerFeedback}</p>
              </div>
            )}

            {sample.revisionNotes && (
              <div className="rounded-xl border border-orange-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-200">
                  <RotateCw size={14} className="text-orange-500" />
                  <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider">Revision Notes</h3>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap p-4">{sample.revisionNotes}</p>
              </div>
            )}

            {(sample.approvedBy || sample.rejectedBy) && (
              <div className="flex gap-6 text-sm text-slate-600 pt-4 border-t border-slate-100">
                {sample.approvedBy && (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Approved by: <strong>{sample.approvedBy.name}</strong>
                  </span>
                )}
                {sample.rejectedBy && (
                  <span className="flex items-center gap-1.5">
                    <XCircle size={14} className="text-red-500" /> Rejected by: <strong>{sample.rejectedBy.name}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="crm-card p-6">
        <EntityDocumentTab entityType="SampleRequest" entityId={sample.id} />
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
      />

      {/* Feedback modal for Approved/Rejected */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-slate-800">Customer Feedback</h3>
            </div>
            <p className="text-sm text-slate-500">Capture the customer&apos;s feedback on this sample.</p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              placeholder="Enter customer feedback..."
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={() => submitFeedback("Rejected")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer">
                <XCircle size={15} /> Mark Rejected
              </button>
              <button onClick={() => submitFeedback("Approved")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">
                <CheckCircle2 size={15} /> Mark Approved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <RotateCw size={20} className="text-orange-500" />
              <h3 className="text-lg font-bold text-slate-800">Revision Notes</h3>
            </div>
            <p className="text-sm text-slate-500">Describe what needs to be revised on this sample.</p>
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              rows={4}
              placeholder="Enter revision requirements..."
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRevisionModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={submitRevision} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">
                <RotateCw size={15} /> Submit Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {link ? (
        <a href={link} className="text-sm text-[var(--primary)] hover:underline font-medium">{value}</a>
      ) : (
        <p className="text-sm text-slate-700">{value}</p>
      )}
    </div>
  );
}
