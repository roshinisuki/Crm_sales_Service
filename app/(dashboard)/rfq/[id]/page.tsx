"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

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
  CostingPending: "bg-orange-100 text-orange-700",
  QuotationCreated: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-600",
};

const statusOptions = ["New", "UnderReview", "CostingPending", "QuotationCreated", "Closed"];

export default function RFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const [editForm, setEditForm] = useState<any>({});

  const loadRFQ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rfq/${id}`);
      const data = await res.json();
      if (data.success) {
        setRfq(data.data);
        setEditForm({
          customerId: data.data.customerId,
          contactId: data.data.contactId || "",
          productId: data.data.productId || "",
          quantity: data.data.quantity || "",
          targetPrice: data.data.targetPrice || "",
          deliveryDate: data.data.deliveryDate ? new Date(data.data.deliveryDate).toISOString().split("T")[0] : "",
          requirementDetails: data.data.requirementDetails || "",
          assignedUserId: data.data.assignedUserId || "",
          notes: data.data.notes || "",
          status: data.data.status,
        });
      }
    } catch {
      toast.error("Failed to load RFQ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRFQ();
  }, [id]);

  useEffect(() => {
    if (editing) {
      fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
      fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); });
      fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rfq/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("RFQ updated");
        setEditing(false);
        loadRFQ();
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

  if (loading) return <PageContainer className="p-6"><p className="text-slate-400">Loading...</p></PageContainer>;
  if (!rfq) return <PageContainer className="p-6"><p className="text-slate-400">RFQ not found</p></PageContainer>;

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/rfq")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
            <Ico d={icons.back} size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{rfq.rfqCode}</h1>
            <p className="text-sm text-slate-500 mt-0.5">RFQ Details</p>
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

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[rfq.status] || "bg-gray-100 text-gray-600"}`}>
            {rfq.status}
          </span>
          <select
            value={rfq.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {rfq.status === "QuotationCreated" && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <button
              onClick={() => router.push(`/quotations/new?rfqId=${rfq.id}&customerId=${rfq.customerId}&contactId=${rfq.contactId || ""}&productId=${rfq.productId || ""}`)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              <Ico d={icons.arrow} size={16} /> Create Quotation from this RFQ
            </button>
          </div>
        )}

        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Customer" value={rfq.customer?.name} />
            <Field label="Contact" value={rfq.contact?.name} />
            <Field label="Product" value={rfq.product ? `${rfq.product.productCode} - ${rfq.product.name}` : "—"} />
            <Field label="Quantity" value={rfq.quantity?.toString()} />
            <Field label="Target Price" value={rfq.targetPrice ? formatCurrency(rfq.targetPrice) : "—"} />
            <Field label="Delivery Date" value={rfq.deliveryDate ? new Date(rfq.deliveryDate).toLocaleDateString() : "—"} />
            <Field label="Assigned To" value={rfq.assignedUser?.name} />
            <Field label="Received Date" value={new Date(rfq.receivedDate).toLocaleDateString()} />
            <div className="md:col-span-2">
              <Field label="Requirement Details" value={rfq.requirementDetails} full />
            </div>
            <div className="md:col-span-2">
              <Field label="Notes" value={rfq.notes} full />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer</label>
                <select value={editForm.customerId} onChange={(e) => setEditForm({ ...editForm, customerId: e.target.value, contactId: "" })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
                <select value={editForm.contactId} onChange={(e) => setEditForm({ ...editForm, contactId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
                  <option value="">-- None --</option>
                  {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product</label>
                <select value={editForm.productId} onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
                  <option value="">-- None --</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity</label>
                <input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Price</label>
                <input type="number" step="0.01" value={editForm.targetPrice} onChange={(e) => setEditForm({ ...editForm, targetPrice: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Delivery Date</label>
                <input type="date" value={editForm.deliveryDate} onChange={(e) => setEditForm({ ...editForm, deliveryDate: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
                <select value={editForm.assignedUserId} onChange={(e) => setEditForm({ ...editForm, assignedUserId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
                  <option value="">-- None --</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Requirement Details</label>
              <textarea value={editForm.requirementDetails} onChange={(e) => setEditForm({ ...editForm, requirementDetails: e.target.value })} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
            </div>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {rfq.quotations && rfq.quotations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Linked Quotations</h3>
            <div className="space-y-2">
              {rfq.quotations.map((q: any) => (
                <button key={q.id} onClick={() => router.push(`/quotations/${q.id}`)} className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">{q.quotationCode}</span>
                  <span className="text-sm text-slate-500">{formatCurrency(q.finalAmount)} · {q.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}
