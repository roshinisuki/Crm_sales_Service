"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
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
  check: "M5 13l4 4L19 7",
  arrow: "M14 5l7 7m0 0l-7 7m7-7H3",
};

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  SentToCustomer: "bg-purple-100 text-purple-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Revision: "bg-orange-100 text-orange-700",
};

const statusOptions = ["New", "UnderReview", "SentToCustomer", "Approved", "Rejected", "Revision"];

// Status flow guidance: which next statuses are recommended from each status
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

  if (loading) return <PageContainer className="p-6"><p className="text-slate-400">Loading...</p></PageContainer>;
  if (!sample) return <PageContainer className="p-6"><p className="text-slate-400">Sample not found</p></PageContainer>;

  const allowedNext = nextStatusOptions[sample.status] || [];

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/samples")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
            <Ico d={icons.back} size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{sample.sampleCode}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sample Request Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            <Ico d={icons.edit} size={15} /> {editing ? "Cancel Edit" : "Edit"}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
            <Ico d={icons.x} size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[sample.status] || "bg-gray-100 text-gray-600"}`}>
            {sample.status}
          </span>
          <select
            value={sample.status}
            onChange={(e) => handleStatusClick(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
          >
            <option value={sample.status}>{sample.status} (current)</option>
            {statusOptions.filter(s => s !== sample.status).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Status flow quick actions */}
        {allowedNext.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusClick(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  s === "Approved" ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200" :
                  s === "Rejected" ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" :
                  s === "Revision" ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200" :
                  "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Ico d={icons.arrow} size={13} /> Move to {s}
              </button>
            ))}
          </div>
        )}

        {/* Status flow timeline */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="font-semibold text-slate-600">Timeline:</span>
          <span>Requested: {new Date(sample.requestDate).toLocaleDateString()}</span>
          {sample.sentDate && <span>• Sent: {new Date(sample.sentDate).toLocaleDateString()}</span>}
          {sample.approvedDate && <span className="text-green-600">• Approved: {new Date(sample.approvedDate).toLocaleDateString()}</span>}
          {sample.rejectedDate && <span className="text-red-600">• Rejected: {new Date(sample.rejectedDate).toLocaleDateString()}</span>}
          {sample.revisionDate && <span className="text-orange-600">• Revision: {new Date(sample.revisionDate).toLocaleDateString()}</span>}
        </div>

        {/* B17: Convert to Quotation button when Approved */}
        {sample.status === "Approved" && (
          <div className="mt-4">
            <button
              onClick={() => router.push(`/quotations/new?sampleId=${sample.id}&customerId=${sample.customerId}&productId=${sample.productId}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              <Ico d={icons.arrow} size={14} /> Convert to Quotation
            </button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
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
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1.5">Specifications / Notes</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-xl p-4">{sample.specifications}</p>
              </div>
            )}

            {sample.customerFeedback && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1.5">Customer Feedback</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-xl p-4">{sample.customerFeedback}</p>
              </div>
            )}

            {sample.revisionNotes && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1.5">Revision Notes</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap bg-orange-50 rounded-xl p-4 border border-orange-100">{sample.revisionNotes}</p>
              </div>
            )}

            {(sample.approvedBy || sample.rejectedBy) && (
              <div className="flex gap-6 text-sm text-slate-600 pt-2 border-t border-slate-100">
                {sample.approvedBy && <span>Approved by: <strong>{sample.approvedBy.name}</strong></span>}
                {sample.rejectedBy && <span>Rejected by: <strong>{sample.rejectedBy.name}</strong></span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 mt-6">
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
            <h3 className="text-lg font-bold text-slate-800">Customer Feedback</h3>
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
              <button onClick={() => submitFeedback("Rejected")} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer">Mark Rejected</button>
              <button onClick={() => submitFeedback("Approved")} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">Mark Approved</button>
            </div>
          </div>
        </div>
      )}

      {/* Revision modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Revision Notes</h3>
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
              <button onClick={submitRevision} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">Submit Revision</button>
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
