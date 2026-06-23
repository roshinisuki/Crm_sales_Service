"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  plus: "M12 4v16m8-8H4",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.993-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    contactId: "",
    negotiationId: "",
    quotationId: "",
    dealId: "",
    poNumber: "",
    poDate: "",
    expectedDelivery: "",
    discountPercent: "0",
    paymentTerms: "",
    deliveryTerms: "",
    shippingAddress: "",
    billingAddress: "",
    notes: "",
    specialInstructions: "",
    assignedUserId: "",
  });

  const [items, setItems] = useState<any[]>([
    { productId: "", description: "", quantity: "1", unitPrice: "0", totalPrice: 0 },
  ]);

  useEffect(() => {
    fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
    fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); });
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });

    const qCustomerId = searchParams.get("customerId");
    const qNegotiationId = searchParams.get("negotiationId");
    const qQuotationId = searchParams.get("quotationId");
    if (qCustomerId) setForm(f => ({ ...f, customerId: qCustomerId }));
    if (qNegotiationId) setForm(f => ({ ...f, negotiationId: qNegotiationId }));
    if (qQuotationId) setForm(f => ({ ...f, quotationId: qQuotationId }));
  }, [searchParams]);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/contacts?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setContacts(data.data || []);
      });
      fetch(`/api/negotiations?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setNegotiations(data.data || []);
      });
      fetch(`/api/quotations?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setQuotations(data.data || []);
      });
      fetch(`/api/deals?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setDeals(data.data || []);
      });
    } else {
      setContacts([]); setNegotiations([]); setQuotations([]); setDeals([]);
    }
  }, [form.customerId]);

  // Auto-fill from selected negotiation
  useEffect(() => {
    if (form.negotiationId) {
      const n = negotiations.find((x: any) => x.id === form.negotiationId);
      if (n) {
        const amount = n.revisedAmount || n.initialAmount;
        if (amount && items.length === 1 && !items[0].description) {
          setItems([{ productId: "", description: `From negotiation ${n.negotiationCode}`, quantity: "1", unitPrice: String(amount), totalPrice: amount }]);
        }
      }
    }
  }, [form.negotiationId, negotiations]);

  const updateItem = (index: number, field: string, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-calc totalPrice
      const qty = parseFloat(next[index].quantity) || 0;
      const price = parseFloat(next[index].unitPrice) || 0;
      next[index].totalPrice = qty * price;
      // Auto-fill description from product
      if (field === "productId" && value) {
        const p = products.find((x: any) => x.id === value);
        if (p && !next[index].description) next[index].description = p.name;
        if (p && p.basePrice && parseFloat(next[index].unitPrice) === 0) {
          next[index].unitPrice = String(p.basePrice);
          next[index].totalPrice = (parseFloat(next[index].quantity) || 0) * p.basePrice;
        }
      }
      return next;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { productId: "", description: "", quantity: "1", unitPrice: "0", totalPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
  const discountPercent = parseFloat(form.discountPercent) || 0;
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select a customer"); return; }
    if (items.length === 0) { toast.error("At least one line item is required"); return; }
    const invalidItems = items.some(it => !it.description || parseFloat(it.quantity) <= 0);
    if (invalidItems) { toast.error("All items need a description and quantity > 0"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Purchase order created");
        router.push(`/purchase-orders/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to create purchase order");
      }
    } catch {
      toast.error("Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/purchase-orders")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
          <Ico d={icons.back} size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a purchase order with line items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header section */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">PO Header</h2>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked Negotiation</label>
              <select
                value={form.negotiationId}
                onChange={(e) => setForm({ ...form, negotiationId: e.target.value })}
                disabled={!form.customerId}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="">-- None --</option>
                {negotiations.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.negotiationCode} - {n.status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked Quotation</label>
              <select
                value={form.quotationId}
                onChange={(e) => setForm({ ...form, quotationId: e.target.value })}
                disabled={!form.customerId}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="">-- None --</option>
                {quotations.map((q: any) => (
                  <option key={q.id} value={q.id}>{q.quotationCode}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">PO Number (customer's)</label>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                placeholder="Customer's PO reference"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">PO Date</label>
              <input
                type="date"
                value={form.poDate}
                onChange={(e) => setForm({ ...form, poDate: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Delivery</label>
              <input
                type="date"
                value={form.expectedDelivery}
                onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
              <select
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
              >
                <option value="">-- Unassigned --</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Terms</label>
              <input
                type="text"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="e.g. Net 30"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Delivery Terms</label>
              <input
                type="text"
                value={form.deliveryTerms}
                onChange={(e) => setForm({ ...form, deliveryTerms: e.target.value })}
                placeholder="e.g. FOB Destination"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Shipping Address</label>
              <textarea
                value={form.shippingAddress}
                onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Billing Address</label>
              <textarea
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Line Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
              <Ico d={icons.plus} size={14} /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Product</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-24">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-28">Unit Price</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-28">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <select
                        value={it.productId}
                        onChange={(e) => updateItem(i, "productId", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                      >
                        <option value="">-- None --</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.productCode || p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        placeholder="Item description"
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-slate-700">
                      ${(it.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="p-1 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer">
                          <Ico d={icons.trash} size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-800">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Discount %</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className="w-20 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Discount Amount</span>
                <span className="text-slate-700">-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800">Final Total</span>
                <span className="font-bold text-[var(--primary)]">${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Additional Information</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Special Instructions</label>
              <textarea
                value={form.specialInstructions}
                onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
                rows={2}
                placeholder="Any special handling, packaging, or delivery instructions..."
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Internal notes..."
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/purchase-orders")} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60">
            {saving ? "Saving..." : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
