"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { getCustomersAction } from "@/app/actions/customers";
import { Trash2, Plus, ArrowLeft } from "lucide-react";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
};

export default function NewRFQPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerId: "",
    contactId: "",
    productId: "",
    quantity: "",
    targetPrice: "",
    deliveryDate: "",
    receivedDate: new Date().toISOString().split("T")[0],
    customerDueDate: "",
    requirementDetails: "",
    assignedUserId: "",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<any[]>([{ item_description: "", product_id: "", quantity: "1", unit: "", target_price: "", delivery_date: "", specifications: "" }]);

  useEffect(() => {
    getCustomersAction().then(res => {
      if (res.success && res.data) setCustomers(res.data as any[]);
      else console.error("Failed to load customers:", res.message);
    }).catch(err => console.error("Error loading customers:", err));
    fetch("/api/catalogue/products").then(res => res.json()).then(data => {
      if (data.success) setProducts(data.data || []);
      else console.error("Failed to load products:", data.message);
    }).catch(err => console.error("Error loading products:", err));
    fetch("/api/users").then(res => res.json()).then(data => {
      if (data.success) setUsers(data.data || []);
      else console.error("Failed to load users:", data.message);
    }).catch(err => console.error("Error loading users:", err));

    const oppId = searchParams.get("opportunityId");
    if (oppId) {
      setOpportunityId(oppId);
      setLoadingContext(true);
      setContextError(null);
      fetch(`/api/opportunities/${oppId}/context`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({ success: false }));
          if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to load opportunity context");
          }
          return data.data;
        })
        .then((ctx) => {
          if (ctx.accountId) {
            setCustomerSearch(ctx.accountName || "");
            setForm(f => ({
              ...f,
              customerId: ctx.accountId,
              contactId: ctx.contactId || "",
              productId: ctx.primaryProductId || "",
              assignedUserId: ctx.assignedUserId || "",
            }));
            if (ctx.contacts?.length > 0) {
              setContacts(ctx.contacts);
            }
          }
        })
        .catch((err) => {
          console.error("RFQ context fetch failed:", err);
          setContextError(err.message || "Could not load linked customer details — please select manually.");
        })
        .finally(() => setLoadingContext(false));
    }
  }, []);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/contacts?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setContacts(data.data || []);
      });
    } else {
      setContacts([]);
    }
  }, [form.customerId]);

  const addLineItem = () => setLineItems([...lineItems, { item_description: "", product_id: "", quantity: "1", unit: "", target_price: "", delivery_date: "", specifications: "" }]);
  const removeLineItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: string, value: string) => setLineItems(lineItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select a customer"); return; }
    const validLineItems = lineItems.filter(li => li.item_description.trim());
    if (validLineItems.length === 0) { toast.error("At least one line item with a description is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          opportunity_id: opportunityId,
          line_items: validLineItems.map(li => ({
            item_description: li.item_description,
            product_id: li.product_id || undefined,
            quantity: li.quantity,
            unit: li.unit || undefined,
            target_price: li.target_price || undefined,
            delivery_date: li.delivery_date || undefined,
            specifications: li.specifications || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("RFQ created successfully");
        if (opportunityId) {
          router.push(`/sales-pipeline/${opportunityId}/opportunity-detail`);
        } else {
          router.push(`/rfq/${data.data.id}`);
        }
      } else {
        toast.error(data.message || "Failed to create RFQ");
      }
    } catch {
      toast.error("Failed to create RFQ");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  const filteredProducts = products.filter((p: any) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.productCode?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q);
  });

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/rfq")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New RFQ</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new Request for Quotation</p>
        </div>
      </div>

      {loadingContext && (
        <div className="flex items-center gap-3 text-sm text-slate-500 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          Loading opportunity details...
        </div>
      )}

      {contextError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {contextError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer *</label>
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all mb-2"
            />
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })}
              required
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">-- Select Customer --</option>
              {filteredCustomers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
            <select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              disabled={!form.customerId}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Select Contact --</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.title ? `(${c.title})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Received Date</label>
            <input
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Due Date</label>
            <input
              type="date"
              value={form.customerDueDate}
              onChange={(e) => setForm({ ...form, customerDueDate: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">Date by which customer expects the quotation</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
            <select
              value={form.assignedUserId}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">-- Select User --</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Line Items *</h3>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((li, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLineItem(idx)} className="text-red-500 hover:text-red-700 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
                    <input
                      type="text"
                      value={li.item_description}
                      onChange={(e) => updateLineItem(idx, "item_description", e.target.value)}
                      placeholder="Item description..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Product</label>
                    <select
                      value={li.product_id}
                      onChange={(e) => updateLineItem(idx, "product_id", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="">-- Select Product --</option>
                      {filteredProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(idx, "quantity", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
                    <input
                      type="text"
                      value={li.unit}
                      onChange={(e) => updateLineItem(idx, "unit", e.target.value)}
                      placeholder="pcs, kg, set..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Target Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={li.target_price}
                      onChange={(e) => updateLineItem(idx, "target_price", e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Requested Delivery Date</label>
                    <input
                      type="date"
                      value={li.delivery_date}
                      onChange={(e) => updateLineItem(idx, "delivery_date", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Requirement Details</label>
          <textarea
            value={form.requirementDetails}
            onChange={(e) => setForm({ ...form, requirementDetails: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer"
          >
            {saving ? "Creating..." : "Create RFQ"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/rfq")}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
