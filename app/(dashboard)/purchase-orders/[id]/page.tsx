"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  check: "M5 13l4 4L19 7",
  x: "M6 18L18 6M6 6l12 12",
  sync: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
};

const statusColors: Record<string, string> = {
  New: "bg-slate-100 text-slate-700",
  UnderValidation: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Rejected: "bg-red-100 text-red-700",
  Closed: "bg-green-100 text-green-700",
};

const erpStatusColors: Record<string, string> = {
  Synced: "bg-green-100 text-green-700",
  Pending: "bg-amber-100 text-amber-700",
  Failed: "bg-red-100 text-red-700",
};

const tabs = ["Details", "Validation", "ERP Sync"];

const checklistItems = [
  { key: "customerVerified", label: "Customer details verified" },
  { key: "contactVerified", label: "Contact person confirmed" },
  { key: "productsConfirmed", label: "Products & quantities confirmed" },
  { key: "documentUploaded", label: "PO document uploaded" },
  { key: "amountMatches", label: "Amount matches quotation/negotiation" },
];

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();

  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Details");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoading();

  // Validation checklist state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [poDocumentUrl, setPoDocumentUrl] = useState("");

  // Edit form
  const [editForm, setEditForm] = useState<any>({});

  const loadPo = async () => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
        setEditForm({
          paymentTerms: data.data.paymentTerms || "",
          deliveryTerms: data.data.deliveryTerms || "",
          shippingAddress: data.data.shippingAddress || "",
          billingAddress: data.data.billingAddress || "",
          notes: data.data.notes || "",
          specialInstructions: data.data.specialInstructions || "",
          expectedDelivery: data.data.expectedDelivery ? data.data.expectedDelivery.split("T")[0] : "",
          assignedUserId: data.data.assignedUserId || "",
        });
        // Parse checklist
        let parsed: Record<string, boolean> = {};
        if (data.data.validationChecklist) {
          try { parsed = JSON.parse(data.data.validationChecklist); } catch {}
        }
        setChecklist(parsed);
        setPoDocumentUrl(data.data.poDocumentUrl || "");
      } else {
        toast.error("Purchase order not found");
        router.push("/purchase-orders");
      }
    } catch {
      toast.error("Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPo();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!po || newStatus === po.status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
        toast.success(`Status changed to ${newStatus}`);
      } else toast.error(data.message || "Failed to update status");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          expectedDelivery: editForm.expectedDelivery || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
        toast.success("Saved");
      } else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChecklist = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationChecklist: JSON.stringify(checklist),
          poDocumentUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
        toast.success("Validation checklist saved");
        // Auto-move to UnderValidation if currently New and at least one item checked
        const allChecked = checklistItems.every((it) => checklist[it.key]);
        if (po.status === "New" && allChecked) {
          toast.success("All items validated — moving to UnderValidation");
          await handleStatusChange("UnderValidation");
        }
      } else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncErp = async () => {
    setSyncing(true);
    startLoading("Syncing with SUKI ERP...", "handshake");
    try {
      const res = await fetch(`/api/purchase-orders/${id}/sync-erp`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
        toast.success(data.message || "Synced to ERP");
      } else {
        toast.error(data.message || "ERP sync failed");
      }
    } catch {
      toast.error("ERP sync failed");
    } finally {
      setSyncing(false);
      stopLoading();
    }
  };

  if (loading) return <PageContainer className="p-6"><div className="text-center text-slate-400">Loading...</div></PageContainer>;
  if (!po) return null;

  const isClosed = po.status === "Closed";
  const isRejected = po.status === "Rejected";
  const readOnly = isClosed || isRejected;
  const allChecked = checklistItems.every((it) => checklist[it.key]);
  const canApprove = po.status === "UnderValidation" && allChecked;

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/purchase-orders")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
          <Ico d={icons.back} size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{po.poCode}</h1>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || "bg-gray-100 text-gray-600"}`}>{po.status}</span>
            {po.erpSyncStatus && (
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${erpStatusColors[po.erpSyncStatus] || "bg-gray-100 text-gray-600"}`}>
                ERP: {po.erpSyncStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{po.customer?.name} • {po.customer?.customerCode}</p>
        </div>
      </div>

      {/* Status flow bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {["New", "UnderValidation", "Approved", "Rejected", "Closed"].map((s) => (
            <button
              key={s}
              disabled={saving || readOnly}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                po.status === s ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {!canApprove && po.status === "UnderValidation" && (
          <p className="text-xs text-amber-600 mt-2">Complete all validation checklist items before approving.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === t ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Details */}
      {activeTab === "Details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">PO Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="PO Number" value={po.poNumber || "—"} />
              <Field label="PO Date" value={po.poDate ? new Date(po.poDate).toLocaleDateString() : "—"} />
              <Field label="Expected Delivery" value={po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "—"} />
              <Field label="Actual Delivery" value={po.actualDelivery ? new Date(po.actualDelivery).toLocaleDateString() : "—"} />
              <Field label="Subtotal" value={formatCurrency(po.totalAmount)} />
              <Field label="Discount" value={`${po.discountPercent}%`} />
              <Field label="Final Amount" value={formatCurrency(po.finalAmount)} />
              <Field label="Items" value={String(po.items?.length || 0)} />
              <Field label="Negotiation" value={po.negotiation ? po.negotiation.negotiationCode : "—"} />
              <Field label="Quotation" value={po.quotation ? po.quotation.quotationCode : "—"} />
              <Field label="Assigned To" value={po.assignedUser?.name || "—"} />
              <Field label="Created" value={new Date(po.createdAt).toLocaleDateString()} />
            </div>

            {/* Line items table */}
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Line Items</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Product</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Description</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Unit Price</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items?.map((it: any) => (
                      <tr key={it.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-sm text-slate-700">{it.product ? `${it.product.productCode || it.product.name}` : "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{it.description}</td>
                        <td className="px-3 py-2 text-sm text-slate-700 text-right">{it.quantity}</td>
                        <td className="px-3 py-2 text-sm text-slate-700 text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-sm font-medium text-slate-800 text-right">{formatCurrency(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!readOnly && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Terms</label>
                    <input type="text" value={editForm.paymentTerms} onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Delivery Terms</label>
                    <input type="text" value={editForm.deliveryTerms} onChange={(e) => setEditForm({ ...editForm, deliveryTerms: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Delivery</label>
                    <input type="date" value={editForm.expectedDelivery} onChange={(e) => setEditForm({ ...editForm, expectedDelivery: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Shipping Address</label>
                    <textarea value={editForm.shippingAddress} onChange={(e) => setEditForm({ ...editForm, shippingAddress: e.target.value })} rows={2}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Special Instructions</label>
                  <textarea value={editForm.specialInstructions} onChange={(e) => setEditForm({ ...editForm, specialInstructions: e.target.value })} rows={2}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                  <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveDetails} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Customer & Contact</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400">Customer</p>
                <p className="text-sm font-medium text-slate-800">{po.customer?.name}</p>
                <p className="text-xs text-slate-500">{po.customer?.customerCode}</p>
                {po.customer?.city && <p className="text-xs text-slate-500">{po.customer.city}</p>}
              </div>
              {po.contact && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Contact</p>
                  <p className="text-sm font-medium text-slate-800">{po.contact.name}</p>
                  {po.contact.email && <p className="text-xs text-slate-500">{po.contact.email}</p>}
                  {po.contact.phone && <p className="text-xs text-slate-500">{po.contact.phone}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Validation */}
      {activeTab === "Validation" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Validation Checklist</h2>
            {allChecked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <Ico d={icons.check} size={12} /> All Validated
              </span>
            )}
          </div>

          <div className="space-y-3">
            {checklistItems.map((item) => (
              <label key={item.key} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={!!checklist[item.key]}
                  disabled={readOnly}
                  onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer disabled:opacity-40"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
                {checklist[item.key] && <Ico d={icons.check} size={16} className="text-green-600 ml-auto" />}
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">PO Document URL</label>
            <input
              type="text"
              value={poDocumentUrl}
              disabled={readOnly}
              onChange={(e) => setPoDocumentUrl(e.target.value)}
              placeholder="https://... (upload URL or external link to signed PO)"
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all disabled:opacity-60"
            />
            <p className="text-xs text-slate-400 mt-1">Upload the customer's signed PO document and paste the URL here.</p>
          </div>

          {!readOnly && (
            <div className="flex justify-end gap-3">
              <button onClick={handleSaveChecklist} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
                {saving ? "Saving..." : "Save Checklist"}
              </button>
              {canApprove && (
                <button onClick={() => handleStatusChange("Approved")} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
                  Approve PO
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: ERP Sync */}
      {activeTab === "ERP Sync" && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">ERP Integration</h2>

          {/* Sync status card */}
          <div className={`p-4 rounded-xl border ${po.erpSyncStatus === "Synced" ? "bg-green-50 border-green-200" : po.erpSyncStatus === "Failed" ? "bg-red-50 border-red-200" : po.erpSyncStatus === "Pending" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Sync Status: {po.erpSyncStatus || "Not Synced"}
                </p>
                {po.erpReferenceNumber && <p className="text-xs text-slate-600 mt-1">ERP Reference: {po.erpReferenceNumber}</p>}
                {po.erpSyncedAt && <p className="text-xs text-slate-600">Synced At: {new Date(po.erpSyncedAt).toLocaleString()}</p>}
              </div>
              {po.status === "Approved" && po.erpSyncStatus !== "Synced" && (
                <button
                  onClick={handleSyncErp}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Ico d={icons.sync} size={16} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing..." : po.erpSyncStatus === "Failed" ? "Retry Sync" : "Sync to ERP"}
                </button>
              )}
            </div>
          </div>

          {po.status !== "Approved" && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Purchase order must be in <strong>Approved</strong> status before it can be synced to ERP. Current status: {po.status}
            </div>
          )}

          {/* ERP payload (if exists) */}
          {po.erpPayload && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">ERP Payload (sent)</h3>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                {(() => { try { return JSON.stringify(JSON.parse(po.erpPayload), null, 2); } catch { return po.erpPayload; } })()}
              </pre>
            </div>
          )}

          {/* ERP response (if exists) */}
          {po.erpResponse && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">ERP Response (received)</h3>
              <pre className={`p-4 rounded-xl text-xs overflow-x-auto max-h-64 overflow-y-auto ${po.erpSyncStatus === "Failed" ? "bg-red-900 text-red-100" : "bg-slate-900 text-slate-100"}`}>
                {(() => { try { return JSON.stringify(JSON.parse(po.erpResponse), null, 2); } catch { return po.erpResponse; } })()}
              </pre>
            </div>
          )}

          {!po.erpPayload && !po.erpResponse && (
            <p className="text-sm text-slate-400 text-center py-8">No ERP sync attempts yet. Approve the PO and click "Sync to ERP".</p>
          )}
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
