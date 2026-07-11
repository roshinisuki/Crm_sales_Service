"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { cn } from "@/lib/ui-utils";
import { StatusStepper } from "@/components/ui/StatusStepper";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ChevronRight, ChevronLeft, CheckCircle, Plus } from "lucide-react";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  plus: "M12 4v16m8-8H4",
  x: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

const statusColors: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  PriceRevision: "bg-amber-100 text-amber-700",
  CommercialDiscussion: "bg-purple-100 text-purple-700",
  PendingApproval: "bg-orange-100 text-orange-700",
  "Closed-Success": "bg-green-100 text-green-700",
  "Closed-Failure": "bg-red-100 text-red-700",
};

const revisionStatusColors: Record<string, string> = {
  Proposed: "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Pending: "bg-orange-100 text-orange-700",
};

const tabs = ["Overview", "Revisions", "Discussion"];

// Sequential status flow: each status can only transition to the next one(s)
const STATUS_FLOW: Record<string, string[]> = {
  Active: ["PriceRevision", "Closed-Success", "Closed-Failure"],
  PriceRevision: ["CommercialDiscussion", "Closed-Success", "Closed-Failure"],
  CommercialDiscussion: ["PendingApproval", "PriceRevision", "Closed-Success", "Closed-Failure"],
  PendingApproval: ["Closed-Success", "Closed-Failure"],
  "Closed-Success": [],
  "Closed-Failure": [],
};

const ALL_STATUSES = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Closed-Success", "Closed-Failure"];

export default function NegotiationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();

  const [negotiation, setNegotiation] = useState<any>(null);
  useSyncUrlParam(negotiation?.status, "status");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoading();
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: "", message: "", action: () => {} });

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  // Revision form
  const [revisionForm, setRevisionForm] = useState({
    proposedAmount: "",
    discountPercent: "",
    reason: "",
  });

  // Discussion note
  const [discussionNote, setDiscussionNote] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState<any[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // B.4: Dynamic threshold config from API
  const [config, setConfig] = useState({ discountThreshold: 5, escalationThreshold: 15, escalationRole: "SalesDirector" });
  const [requestingApproval, setRequestingApproval] = useState(false);

  const loadNegotiation = async () => {
    try {
      const res = await fetch(`/api/negotiations/${id}`);
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.data);
        if (data.config) setConfig(data.config);
        setEditForm({
          customerDemands: data.data.customerDemands || "",
          internalNotes: data.data.internalNotes || "",
          assignedUserId: data.data.assignedUserId || "",
        });
      } else {
        toast.error("Negotiation not found");
        router.push("/negotiations");
      }
    } catch {
      toast.error("Failed to load negotiation");
    } finally {
      setLoading(false);
    }
  };

  const loadDiscussionNotes = async () => {
    try {
      const res = await fetch(`/api/negotiations/${id}/notes`);
      const data = await res.json();
      if (data.success) {
        setDiscussionNotes(data.data || []);
      }
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    loadNegotiation();
    loadDiscussionNotes();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!negotiation) return;
    if (newStatus === negotiation.status) return;
    // Enforce sequential transitions
    const allowed = STATUS_FLOW[negotiation.status] || [];
    if (!allowed.includes(newStatus)) {
      toast.error(`Cannot move from ${negotiation.status} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`);
      return;
    }

    const executeChange = async () => {
      if (newStatus === "Closed-Success") startLoading("Closing negotiation successfully...", "pulse");
      setSaving(true);
      try {
        const payload: any = { status: newStatus };
        if (newStatus === "Closed-Success") {
          payload.finalAmount = negotiation.revisedAmount || negotiation.initialAmount;
        }
        const res = await fetch(`/api/negotiations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setNegotiation(data.data);
          toast.success(`Status changed to ${newStatus}`);
        } else {
          toast.error(data.message || "Failed to update status");
        }
      } catch {
        toast.error("Failed to update status");
      } finally {
        setSaving(false);
        stopLoading();
      }
    };

    if (newStatus === "Closed-Success" || newStatus === "Closed-Failure") {
      const isWon = newStatus === "Closed-Success";
      const outcomeText = isWon ? "Won" : "Lost";
      const message = `This will mark the negotiation as ${newStatus}. Are you sure you want to proceed?`;

      setConfirmState({
        isOpen: true,
        title: `Transition to ${newStatus}`,
        message,
        action: async () => {
          await executeChange();
          setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
        }
      });
    } else {
      await executeChange();
    }
  };

  const handleAddNote = async () => {
    if (!discussionNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/negotiations/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: discussionNote }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscussionNotes(data.data || []);
        setDiscussionNote("");
        toast.success("Note added");
      } else {
        toast.error(data.message || "Failed to add note");
      }
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveOverview = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/negotiations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.data);
        toast.success("Saved");
      } else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!revisionForm.proposedAmount) { toast.error("Proposed amount is required"); return; }
    const proposed = parseFloat(revisionForm.proposedAmount);
    const currentAmount = negotiation.revisedAmount || negotiation.initialAmount;
    if (proposed > currentAmount) {
      toast.error(`Proposed amount cannot exceed current amount (${formatCurrency(currentAmount)})`);
      return;
    }
    if (proposed <= 0) {
      toast.error("Proposed amount must be positive");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/negotiations/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revisionForm),
      });
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.data);
        setShowRevisionModal(false);
        setRevisionForm({ proposedAmount: "", discountPercent: "", reason: "" });
        toast.success(data.message || "Revision created");
      } else {
        toast.error(data.message || "Failed to create revision");
      }
    } catch {
      toast.error("Failed to create revision");
    } finally {
      setSaving(false);
    }
  };

  // B.3: Manually request approval — creates a real ApprovalHistory entry
  const handleRequestApproval = async () => {
    setRequestingApproval(true);
    try {
      const res = await fetch(`/api/negotiations/${id}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.data);
        toast.success(data.message || "Approval requested — visible in Approval Center");
      } else {
        toast.error(data.message || "Failed to request approval");
      }
    } catch {
      toast.error("Failed to request approval");
    } finally {
      setRequestingApproval(false);
    }
  };

  if (loading) return <PageContainer className="p-6"><div className="text-center text-slate-400">Loading...</div></PageContainer>;
  if (!negotiation) return null;

  const canRevise = ["Active", "PriceRevision"].includes(negotiation.status);
  const isClosed = ["Closed-Success", "Closed-Failure"].includes(negotiation.status);
  const canRequestApproval = negotiation.status === "CommercialDiscussion";
  const canResumeRevision = negotiation.status === "CommercialDiscussion";

  // B.6: Auto-calculate discount from proposedAmount vs current amount
  const currentAmount = negotiation.revisedAmount || negotiation.initialAmount;
  const autoDiscount = revisionForm.proposedAmount && currentAmount > 0
    ? Math.max(0, ((currentAmount - parseFloat(revisionForm.proposedAmount)) / currentAmount) * 100)
    : 0;
  const userEnteredDiscount = revisionForm.discountPercent !== "";
  const discountMismatch = userEnteredDiscount && Math.abs(parseFloat(revisionForm.discountPercent) - autoDiscount) > 0.01;

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/negotiations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
          <Ico d={icons.back} size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{negotiation.negotiationCode}</h1>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[negotiation.status] || "bg-gray-100 text-gray-600"}`}>
              {negotiation.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{negotiation.customer?.name} • {negotiation.customer?.customerCode}</p>
        </div>
        <div className="flex items-center gap-2">
          {canRevise && (
            <button
              onClick={() => setShowRevisionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              <Ico d={icons.plus} size={16} /> Add Revision
            </button>
          )}
          {canResumeRevision && (
            <button
              onClick={() => handleStatusChange("PriceRevision")}
              disabled={saving}
              title="Go back to price revision to propose a new price"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-60"
            >
              ↩ Resume Price Revision
            </button>
          )}
          {canRequestApproval && (
            <button
              onClick={handleRequestApproval}
              disabled={requestingApproval}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--status-warning)] hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
            >
              {requestingApproval ? "Requesting..." : "Request Approval"}
            </button>
          )}
          {!isClosed && (
            <>
              <button
                onClick={() => handleStatusChange("Closed-Success")}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--status-success)] hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
              >
                🤝 Accept & Close
              </button>
              <button
                onClick={() => handleStatusChange("Closed-Failure")}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--status-danger)] hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
              >
                ❌ Reject & Close
              </button>
            </>
          )}
          {negotiation.status === "Closed-Success" && (
            <button
              onClick={() => router.push(`/purchase-orders/new?customerId=${negotiation.customerId}&negotiationId=${negotiation.id}&quotationId=${negotiation.quotationId || ""}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              📋 Create PO
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumbs — full lineage: RFQ → Quotation → Negotiation */}
      {negotiation.quotation && (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/40 w-max animate-fadeIn">
          {negotiation.quotation.rfq ? (
            <>
              <button
                onClick={() => router.push(`/rfq/${negotiation.quotation.rfq.id}`)}
                className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline cursor-pointer transition-colors flex items-center gap-1"
              >
                📄 {negotiation.quotation.rfq.rfqCode}
              </button>
              <ChevronRight size={12} className="text-slate-450" />
            </>
          ) : (
            <span className="text-slate-400">No RFQ</span>
          )}
          <button
            onClick={() => router.push(`/quotations/${negotiation.quotation.id}`)}
            className="text-slate-600 dark:text-slate-400 hover:text-[var(--primary)] hover:underline cursor-pointer transition-colors flex items-center gap-1"
          >
            💼 {negotiation.quotation.quotationCode}
          </button>
          <ChevronRight size={12} className="text-slate-450" />
          <span className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-bold flex items-center gap-1">
            🤝 {negotiation.negotiationCode}
          </span>
        </div>
      )}

      {/* Approval Confirmation Alert */}
      {(() => {
        const approvedRev = negotiation.revisions?.find((r: any) => r.status === "Approved");
        if (!approvedRev) return null;
        return (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-4 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-400 font-semibold animate-fadeIn shadow-sm">
            <span className="text-base">✅</span>
            <div>
              <p>Revision R{approvedRev.revisionNumber} approved by {negotiation.approvedBy?.name || "System"} on {new Date(negotiation.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-normal mt-0.5">The revised price of {formatCurrency(approvedRev.proposedAmount)} has been applied to the quotation.</p>
            </div>
          </div>
        );
      })()}

      {/* Stage Stepper — RFQ → Quotation → Negotiation → Won/Lost */}
      <div className="crm-card p-4">
        <StatusStepper
          steps={[
            { label: "RFQ", key: "rfq", reached: !!negotiation.quotation?.rfq, active: false, onClick: () => negotiation.quotation?.rfq?.id && router.push(`/rfq/${negotiation.quotation.rfq.id}`), clickable: !!negotiation.quotation?.rfq?.id },
            { label: "Quotation", key: "quotation", reached: !!negotiation.quotation, active: false, onClick: () => negotiation.quotation?.id && router.push(`/quotations/${negotiation.quotation.id}`), clickable: !!negotiation.quotation?.id },
            { label: "Negotiation", key: "negotiation", reached: true, active: true },
            { label: "Revision", key: "revision", reached: (negotiation.revisions?.length || 0) > 0, active: false },
            { label: negotiation.status === "Closed-Success" ? "Closed-Success" : negotiation.status === "Closed-Failure" ? "Closed-Failure" : "Closed", key: "outcome", reached: ["Closed-Success", "Closed-Failure"].includes(negotiation.status), active: false, terminal: negotiation.status === "Closed-Failure" ? "danger" : negotiation.status === "Closed-Success" ? "success" : undefined },
          ]}
        />
      </div>

      {/* Status flow bar — sequential enforcement */}
      <div className="crm-card p-4">
        <StatusStepper
          steps={ALL_STATUSES.map((s, idx) => {
            const isCurrent = negotiation.status === s;
            const allowed = STATUS_FLOW[negotiation.status] || [];
            const isAllowed = allowed.includes(s);
            const isClosed = ["Closed-Success", "Closed-Failure"].includes(negotiation.status);
            const statusIdx = ALL_STATUSES.indexOf(negotiation.status);
            const stepIdx = idx;
            const isCompleted = stepIdx < statusIdx || (negotiation.status === "Closed-Success" && s === "Closed-Success") || (negotiation.status === "Closed-Failure" && s === "Closed-Failure");
            const isClickable = !isClosed && !isCurrent && isAllowed;
            return {
              label: s,
              key: s,
              reached: isCompleted || isCurrent,
              active: isCurrent,
              onClick: () => isClickable && handleStatusChange(s),
              clickable: isClickable,
              terminal: s === "Closed-Failure" && isCompleted ? "danger" as const : s === "Closed-Success" && isCompleted ? "success" as const : undefined,
            };
          })}
        />
        <p className="text-[10px] text-[var(--text-muted)] mt-2 font-medium">Status transitions are sequential. Only reachable adjacent statuses are active; non-adjacent steps are disabled-with-tooltip.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === t
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Negotiation Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Initial Amount" value={negotiation.initialAmount ? formatCurrency(negotiation.initialAmount) : "—"} />
              <Field label="Revised Amount" value={negotiation.revisedAmount ? formatCurrency(negotiation.revisedAmount) : "—"} />
              <Field label="Final Amount" value={negotiation.finalAmount ? formatCurrency(negotiation.finalAmount) : "—"} />
              <Field label="Discount Requested" value={negotiation.discountRequested ? `${negotiation.discountRequested}%` : "—"} />
              <Field label="Discount Approved" value={negotiation.discountApproved ? `${negotiation.discountApproved}%` : "—"} />
              <Field label="Quotation" value={negotiation.quotation ? negotiation.quotation.quotationCode : "—"} />
              <Field label="RFQ" value={negotiation.quotation?.rfq ? negotiation.quotation.rfq.rfqCode : "—"} />
              <Field label="Deal" value={negotiation.deal ? negotiation.deal.dealName : "—"} />
              <Field label="Assigned To" value={negotiation.assignedUser?.name || "—"} />
              <Field label="Approved By" value={negotiation.approvedBy?.name || "—"} />
              <Field label="Created" value={new Date(negotiation.createdAt).toLocaleDateString()} />
              {negotiation.closedAt && <Field label="Closed" value={new Date(negotiation.closedAt).toLocaleDateString()} />}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 uppercase tracking-wider">Customer Demands</label>
                  {!isClosed && <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">✏️ Editable</span>}
                </div>
                <textarea
                  value={editForm.customerDemands}
                  onChange={(e) => setEditForm({ ...editForm, customerDemands: e.target.value })}
                  rows={3}
                  disabled={isClosed}
                  placeholder="Enter specific discount demands or terms requested by the customer..."
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none disabled:opacity-60 text-slate-700 dark:text-slate-250 shadow-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 uppercase tracking-wider">Internal Notes</label>
                  {!isClosed && <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">✏️ Editable</span>}
                </div>
                <textarea
                  value={editForm.internalNotes}
                  onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                  rows={3}
                  disabled={isClosed}
                  placeholder="Enter internal negotiation strategy, margin trade-offs, or notes..."
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none disabled:opacity-60 text-slate-700 dark:text-slate-250 shadow-sm"
                />
              </div>
            </div>

            {!isClosed && (
              <div className="flex justify-end">
                <button onClick={handleSaveOverview} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Customer & Contact</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400">Customer</p>
                <p className="text-sm font-medium text-slate-800">{negotiation.customer?.name}</p>
                <p className="text-xs text-slate-500">{negotiation.customer?.customerCode}</p>
                {negotiation.customer?.city && <p className="text-xs text-slate-500">{negotiation.customer.city}</p>}
              </div>
              {negotiation.contact && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Contact</p>
                  <p className="text-sm font-medium text-slate-800">{negotiation.contact.name}</p>
                  {negotiation.contact.title && <p className="text-xs text-slate-500">{negotiation.contact.title}</p>}
                  {negotiation.contact.email && <p className="text-xs text-slate-500">{negotiation.contact.email}</p>}
                  {negotiation.contact.phone && <p className="text-xs text-slate-500">{negotiation.contact.phone}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Revisions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left / Main side: Revisions List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Price Revision History</h2>
              {canRevise ? (
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer shadow-sm"
                >
                  <Plus size={14} /> Add Revision
                </button>
              ) : !isClosed ? (
                <button
                  disabled
                  title="Only available in Active or PriceRevision status"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-100 cursor-not-allowed shadow-sm"
                >
                  <Plus size={14} /> Add Revision
                </button>
              ) : null}
            </div>
            {negotiation.revisions?.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-xs font-semibold">No revisions yet</p>
                <p className="text-[10px] mt-1">Add a revision to propose a new price</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <th className="crm-th text-left w-14">#</th>
                      <th className="crm-th text-right">Proposed</th>
                      <th className="crm-th text-right">Δ Amount</th>
                      <th className="crm-th text-right">Discount</th>
                      <th className="crm-th text-right">Cum. Disc.</th>
                      <th className="crm-th text-right">Margin</th>
                      <th className="crm-th text-right">Δ Margin</th>
                      <th className="crm-th text-left">Reason</th>
                      <th className="crm-th text-center">Status</th>
                      <th className="crm-th text-left">By</th>
                      <th className="crm-th text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negotiation.revisions?.map((r: any, idx: number) => {
                      const prevAmount = idx === 0 ? negotiation.initialAmount : negotiation.revisions[idx - 1].proposedAmount;
                      const amountDelta = r.proposedAmount - prevAmount;
                      // C.2: Cumulative discount from original initialAmount
                      const cumulativeDiscount = negotiation.initialAmount > 0
                        ? ((negotiation.initialAmount - r.proposedAmount) / negotiation.initialAmount) * 100
                        : 0;
                      // Margin: use cost-based formula
                      const costBasis = Number(negotiation.costBasisUnitPrice) || 0;
                      const revisedMargin = costBasis > 0 && r.proposedAmount > 0
                        ? ((r.proposedAmount - costBasis) / r.proposedAmount) * 100
                        : null;
                      const prevProposed = idx === 0 ? negotiation.initialAmount : negotiation.revisions[idx - 1].proposedAmount;
                      const prevMargin = costBasis > 0 && prevProposed > 0
                        ? ((prevProposed - costBasis) / prevProposed) * 100
                        : null;
                      const marginDelta = revisedMargin != null && prevMargin != null ? revisedMargin - prevMargin : null;
                      return (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50">
                          <td className="crm-td font-semibold text-slate-700 dark:text-slate-200">R{r.revisionNumber} <span className="text-[9px] text-slate-400 font-normal">(#{r.revisionNumber})</span></td>
                          <td className="crm-td text-right font-medium text-slate-700 dark:text-slate-200">{formatCurrency(r.proposedAmount)}</td>
                          <td className={cn("crm-td text-right font-semibold", amountDelta < 0 ? "text-rose-600" : "text-emerald-600")}>
                            {amountDelta < 0 ? "" : "+"}{formatCurrency(amountDelta)}
                          </td>
                          <td className="crm-td text-right text-slate-700 dark:text-slate-200">{r.discountPercent ? `${r.discountPercent}%` : "—"}</td>
                          <td className="crm-td text-right font-semibold text-slate-600 dark:text-slate-300">{cumulativeDiscount > 0 ? `${cumulativeDiscount.toFixed(2)}%` : "—"}</td>
                          <td className="crm-td text-right text-slate-700 dark:text-slate-200">{revisedMargin != null ? `${revisedMargin.toFixed(1)}%` : "—"}</td>
                          <td className={cn("crm-td text-right font-semibold", marginDelta != null && marginDelta < 0 ? "text-rose-600" : "text-emerald-600")}>
                            {marginDelta != null ? `${marginDelta < 0 ? "" : "+"}${marginDelta.toFixed(1)}%` : "—"}
                          </td>
                          <td className="crm-td text-left text-slate-750 dark:text-slate-350 max-w-xs truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                          <td className="crm-td text-center">
                            <span className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              r.status === "Approved"
                                ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-900/30"
                                : r.status === "Rejected"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/30"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30"
                            )}>
                              {r.status}
                            </span>
                          </td>
                          <td className="crm-td text-left text-slate-500">{r.createdBy?.name || "—"}</td>
                          <td className="crm-td text-left text-slate-455">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right side: Discount / Margin Trend Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-750 dark:text-slate-400 uppercase tracking-wider">Negotiation Trajectory</h2>
            <div className="space-y-4">
              {/* R1 baseline */}
              <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-850/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-[var(--primary)] mt-0.5">R1</span>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <span>{formatCurrency(negotiation.initialAmount)}</span>
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Baseline</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-400 font-medium">
                    <span>Discount: 0%</span>
                    <span>Margin: {Number(negotiation.overallMarginPercent).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Revisions list */}
              {negotiation.revisions?.length === 0 ? (
                <p className="text-[10px] text-slate-450 italic text-center py-4">No revisions logged yet.</p>
              ) : (
                negotiation.revisions?.map((r: any, idx: number) => {
                  const costBasis = Number(negotiation.costBasisUnitPrice) || 0;
                  const revisedMargin = costBasis > 0 && r.proposedAmount > 0
                    ? ((r.proposedAmount - costBasis) / r.proposedAmount) * 100
                    : null;
                  const barWidth = Math.max(10, Math.min(100, (r.proposedAmount / negotiation.initialAmount) * 100));
                  const cumulativeDiscount = negotiation.initialAmount > 0
                    ? ((negotiation.initialAmount - r.proposedAmount) / negotiation.initialAmount) * 100
                    : 0;
                  return (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">R{r.revisionNumber}</span>
                        <span className="text-xs font-semibold text-slate-850 dark:text-slate-200">{formatCurrency(r.proposedAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                        <span>Round: {r.discountPercent || 0}% | Cum: {cumulativeDiscount.toFixed(1)}%</span>
                        <span className={cn(
                          "font-bold",
                          revisedMargin != null && revisedMargin < (Number(negotiation.overallMarginPercent) || 0) ? "text-rose-500" : "text-emerald-500"
                        )}>
                          Margin: {revisedMargin != null ? `${revisedMargin.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            revisedMargin != null && revisedMargin < Number(negotiation.overallMarginPercent) ? "bg-amber-400" : "bg-[var(--primary)]"
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Discussion" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Commercial Discussion Log</h2>
          <div className="space-y-4">
            <textarea
              value={discussionNote}
              onChange={(e) => setDiscussionNote(e.target.value)}
              rows={3}
              placeholder="Log a discussion point, customer feedback, or internal decision..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-805 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none shadow-sm text-slate-700 dark:text-slate-200"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddNote}
                disabled={savingNote || !discussionNote.trim()}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
              >
                {savingNote ? "Saving..." : "Add Log Entry"}
              </button>
            </div>
          </div>
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {discussionNotes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 italic">No discussion notes yet. Add one above.</p>
            ) : (
              [...discussionNotes].reverse().map((note: any) => (
                <div key={note.id} className="flex gap-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                    {(note.createdByName || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{note.createdByName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-medium">{note.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add Price Revision</h3>
              <button onClick={() => setShowRevisionModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                <Ico d={icons.x} size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Proposed Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={revisionForm.proposedAmount}
                  onChange={(e) => setRevisionForm({ ...revisionForm, proposedAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">Current revised amount: {negotiation.revisedAmount ? formatCurrency(negotiation.revisedAmount) : formatCurrency(negotiation.initialAmount)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Discount %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={revisionForm.discountPercent}
                  onChange={(e) => setRevisionForm({ ...revisionForm, discountPercent: e.target.value })}
                  placeholder={autoDiscount > 0 ? autoDiscount.toFixed(2) : "0"}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Auto-calculated: {autoDiscount.toFixed(2)}%{userEnteredDiscount ? " (manual override)" : ""}
                </p>
                {discountMismatch && (
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">⚠ Manual discount doesn't match the calculated value.</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                  Discounts above {config.discountThreshold}% require approval. Above {config.escalationThreshold}% escalates to {config.escalationRole}.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason</label>
                <textarea
                  value={revisionForm.reason}
                  onChange={(e) => setRevisionForm({ ...revisionForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Why is this revision being proposed?"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowRevisionModal(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleCreateRevision} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
                {saving ? "Creating..." : "Create Revision"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50/50 dark:bg-slate-850/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 shadow-sm">
      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
    </div>
  );
}
