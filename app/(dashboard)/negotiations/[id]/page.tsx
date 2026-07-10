"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSyncUrlParam } from "@/lib/use-sync-url-param";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

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
  Won: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
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
  Active: ["PriceRevision", "Won", "Lost"],
  PriceRevision: ["CommercialDiscussion", "Won", "Lost"],
  CommercialDiscussion: ["PendingApproval", "Won", "Lost"],
  PendingApproval: ["Won", "Lost"],
  Won: [],
  Lost: [],
};

const ALL_STATUSES = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Won", "Lost"];

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

  const loadNegotiation = async () => {
    try {
      const res = await fetch(`/api/negotiations/${id}`);
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.data);
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
    if (newStatus === "Won") startLoading("Closing the deal...", "handshake");
    setSaving(true);
    try {
      const payload: any = { status: newStatus };
      if (newStatus === "Won" && negotiation.revisedAmount) {
        payload.finalAmount = negotiation.revisedAmount;
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

  if (loading) return <PageContainer className="p-6"><div className="text-center text-slate-400">Loading...</div></PageContainer>;
  if (!negotiation) return null;

  const canRevise = ["Active", "PriceRevision"].includes(negotiation.status);
  const isClosed = ["Won", "Lost"].includes(negotiation.status);

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
        {canRevise && (
          <button
            onClick={() => setShowRevisionModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
          >
            <Ico d={icons.plus} size={16} /> Add Revision
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      {negotiation.quotation && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {negotiation.quotation?.rfq && (
            <>
              <button onClick={() => router.push(`/rfq/${negotiation.quotation.rfq.id}`)} className="hover:text-[var(--primary)] cursor-pointer">
                {negotiation.quotation.rfq.rfqCode}
              </button>
              <span>›</span>
            </>
          )}
          <button onClick={() => router.push(`/quotations/${negotiation.quotation.id}`)} className="hover:text-[var(--primary)] cursor-pointer">
            {negotiation.quotation.quotationCode}
          </button>
          <span>›</span>
          <span className="font-medium text-slate-700">{negotiation.negotiationCode}</span>
        </div>
      )}

      {/* Stage Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { label: "RFQ", key: "rfq", id: negotiation.quotation?.rfq?.id, reached: !!negotiation.quotation?.rfq },
            { label: "Quotation", key: "quotation", id: negotiation.quotation?.id, reached: !!negotiation.quotation },
            { label: "Negotiation", key: "negotiation", id: id, reached: true, current: true },
            { label: "Revision", key: "revision", id: null, reached: (negotiation.revisions?.length || 0) > 0 },
            { label: negotiation.status === "Won" ? "Won" : negotiation.status === "Lost" ? "Lost" : "Won/Lost", key: "outcome", id: null, reached: ["Won", "Lost"].includes(negotiation.status) },
          ].map((step, i, arr) => (
            <div key={step.key} className="flex items-center shrink-0">
              <div
                onClick={() => step.id && step.key !== "negotiation" && router.push(`/${step.key === "rfq" ? "rfq" : step.key === "quotation" ? "quotations" : "negotiations"}/${step.id}`)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  step.current
                    ? "bg-[var(--primary)] text-white"
                    : step.reached
                    ? "bg-green-50 text-green-700 cursor-pointer hover:bg-green-100"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                {step.reached && !step.current && <Ico d={icons.check} size={12} />}
                {step.label}
              </div>
              {i < arr.length - 1 && <div className={`w-6 h-0.5 mx-1 ${step.reached ? "bg-green-300" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Status flow bar — sequential enforcement */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => {
            const isCurrent = negotiation.status === s;
            const allowed = STATUS_FLOW[negotiation.status] || [];
            const isAllowed = allowed.includes(s);
            const isClosed = ["Won", "Lost"].includes(negotiation.status);
            const tooltip = isCurrent ? "Current status" : isClosed ? "Negotiation is closed" : !isAllowed ? `Must go through ${allowed.join(" → ")} first` : `Click to transition to ${s}`;
            return (
              <button
                key={s}
                disabled={saving || isClosed || (!isCurrent && !isAllowed)}
                onClick={() => handleStatusChange(s)}
                title={tooltip}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-[var(--primary)] text-white"
                    : isAllowed
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-2">Status transitions are sequential. Only reachable statuses are clickable; others are disabled with a tooltip.</p>
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
              <Field label="Quotation" value={negotiation.quotation ? negotiation.quotation.quotationCode : "—"} />
              <Field label="RFQ" value={negotiation.quotation?.rfq ? negotiation.quotation.rfq.rfqCode : "—"} />
              <Field label="Deal" value={negotiation.deal ? negotiation.deal.dealName : "—"} />
              <Field label="Assigned To" value={negotiation.assignedUser?.name || "—"} />
              <Field label="Approved By" value={negotiation.approvedBy?.name || "—"} />
              <Field label="Created" value={new Date(negotiation.createdAt).toLocaleDateString()} />
              {negotiation.closedAt && <Field label="Closed" value={new Date(negotiation.closedAt).toLocaleDateString()} />}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Demands</label>
              <textarea
                value={editForm.customerDemands}
                onChange={(e) => setEditForm({ ...editForm, customerDemands: e.target.value })}
                rows={3}
                disabled={isClosed}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Internal Notes</label>
              <textarea
                value={editForm.internalNotes}
                onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                rows={3}
                disabled={isClosed}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none disabled:opacity-60"
              />
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
        <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Price Revisions</h2>
            {canRevise && (
              <button onClick={() => setShowRevisionModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                <Ico d={icons.plus} size={14} /> Add Revision
              </button>
            )}
          </div>
          {negotiation.revisions?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No revisions yet</p>
              <p className="text-xs mt-1">Add a revision to propose a new price</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Proposed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Δ Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Discount %</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Margin %</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Δ Margin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {negotiation.revisions?.map((r: any, idx: number) => {
                  const prevAmount = idx === 0 ? negotiation.initialAmount : negotiation.revisions[idx - 1].proposedAmount;
                  const amountDelta = r.proposedAmount - prevAmount;
                  // Margin: use negotiation's overallMarginPercent as baseline, compute revised margin if available
                  const baseMargin = Number(negotiation.overallMarginPercent) || 0;
                  const revisedMargin = baseMargin > 0 && negotiation.initialAmount > 0
                    ? baseMargin * (r.proposedAmount / negotiation.initialAmount)
                    : null;
                  const prevMargin = idx === 0 ? baseMargin : (baseMargin * (negotiation.revisions[idx - 1].proposedAmount / negotiation.initialAmount));
                  const marginDelta = revisedMargin != null ? revisedMargin - prevMargin : null;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">R{r.revisionNumber + 1} <span className="text-xs text-slate-400">(#{r.revisionNumber})</span></td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(r.proposedAmount)}</td>
                      <td className={`px-4 py-3 text-sm ${amountDelta < 0 ? "text-red-600" : "text-green-600"}`}>{amountDelta < 0 ? "" : "+"}{formatCurrency(Math.abs(amountDelta))}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.discountPercent ? `${r.discountPercent}%` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{revisedMargin != null ? `${revisedMargin.toFixed(1)}%` : "—"}</td>
                      <td className={`px-4 py-3 text-sm ${marginDelta != null && marginDelta < 0 ? "text-red-600" : "text-green-600"}`}>{marginDelta != null ? `${marginDelta < 0 ? "" : "+"}${marginDelta.toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{r.reason || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${revisionStatusColors[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.createdBy?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Discount / Margin Trend Panel */}
        {negotiation.revisions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Negotiation Trajectory</h2>
            <div className="space-y-3">
              {/* R1 baseline */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-slate-500 w-12">R1</span>
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-sm text-slate-700">{formatCurrency(negotiation.initialAmount)}</span>
                  <span className="text-xs text-slate-400">Discount: 0%</span>
                  <span className="text-xs text-slate-400">Margin: {Number(negotiation.overallMarginPercent).toFixed(1)}%</span>
                </div>
              </div>
              {negotiation.revisions?.map((r: any, idx: number) => {
                const revisedMargin = Number(negotiation.overallMarginPercent) > 0 && negotiation.initialAmount > 0
                  ? Number(negotiation.overallMarginPercent) * (r.proposedAmount / negotiation.initialAmount)
                  : null;
                const barWidth = Math.max(10, Math.min(100, (r.proposedAmount / negotiation.initialAmount) * 100));
                return (
                  <div key={r.id} className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500 w-12">R{r.revisionNumber + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-slate-700">{formatCurrency(r.proposedAmount)}</span>
                        <span className="text-xs text-slate-400">Discount: {r.discountPercent || 0}%</span>
                        <span className={`text-xs ${revisedMargin != null && revisedMargin < Number(negotiation.overallMarginPercent) ? "text-red-500" : "text-green-500"}`}>
                          Margin: {revisedMargin != null ? `${revisedMargin.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${revisedMargin != null && revisedMargin < Number(negotiation.overallMarginPercent) ? "bg-amber-400" : "bg-green-400"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {activeTab === "Discussion" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Commercial Discussion Log</h2>
          <textarea
            value={discussionNote}
            onChange={(e) => setDiscussionNote(e.target.value)}
            rows={4}
            placeholder="Log a discussion point, customer feedback, or internal decision..."
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={savingNote || !discussionNote.trim()}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60"
            >
              {savingNote ? "Saving..." : "Add Note"}
            </button>
          </div>
          <div className="pt-4 border-t border-slate-100 space-y-3">
            {discussionNotes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No discussion notes yet. Add one above.</p>
            ) : (
              discussionNotes.map((note: any) => (
                <div key={note.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-sm text-slate-700">{note.text}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>{note.createdByName || "Unknown"}</span>
                    <span>•</span>
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
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
                  placeholder="0"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">Discounts above 5% require approval.</p>
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
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
