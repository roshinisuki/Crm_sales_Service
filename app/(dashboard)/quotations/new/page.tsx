"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
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
  x: "M6 18L18 6M6 6l12 12",
};

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    contactId: "",
    rfqId: "",
    dealId: "",
    validUntil: "",
    discountPercent: "0",
    termsAndConditions: "",
  });

  const [items, setItems] = useState<any[]>([{ productId: "", description: "", quantity: "1", unitPrice: "0" }]);

  useEffect(() => {
    fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
    fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); });
    fetch("/api/rfq").then(res => res.json()).then(data => { if (data.success) setRfqs(data.data || []); });
    fetch("/api/deals").then(res => res.json()).then(data => { if (data.success) setDeals(data.data || []); });

    // Pre-fill from query params
    const rfqId = searchParams.get("rfqId");
    const customerId = searchParams.get("customerId");
    const contactId = searchParams.get("contactId");
    const productId = searchParams.get("productId");

    if (customerId) setForm(f => ({ ...f, customerId }));
    if (contactId) setForm(f => ({ ...f, contactId }));
    if (rfqId) setForm(f => ({ ...f, rfqId }));

    if (productId) {
      setItems([{ productId, description: "", quantity: "1", unitPrice: "0" }]);
    }
  }, []);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/contacts?customerId=${form.customerId}`).then(res => res.json()).then(data => { if (data.success) setContacts(data.data || []); });
    } else {
      setContacts([]);
    }
  }, [form.customerId]);

  const totalAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const discountPercent = parseFloat(form.discountPercent) || 0;
  const finalAmount = totalAmount * (1 - discountPercent / 100);

  const addItem = () => setItems([...items, { productId: "", description: "", quantity: "1", unitPrice: "0" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select a customer"); return; }
    if (!form.validUntil) { toast.error("Please set valid until date"); return; }
    if (items.length === 0) { toast.error("At least one line item is required"); return; }
    if (items.some(i => !i.description)) { toast.error("All items need a description"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Quotation created"); router.push(`/quotations/${data.data.id}`); }
      else toast.error(data.message || "Failed to create quotation");
    } catch { toast.error("Failed to create quotation"); }
    finally { setSaving(false); }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/quotations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.back} size={18} /></button>
        <div><h1 className="text-2xl font-bold text-slate-800">New Quotation</h1><p className="text-sm text-slate-500 mt-0.5">Create a new quotation</p></div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer *</label>
            <input type="text" placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all mb-2" />
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
              <option value="">-- Select Customer --</option>
              {filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
            <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} disabled={!form.customerId} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer disabled:opacity-50">
              <option value="">-- Select Contact --</option>
              {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link to RFQ</label>
            <select value={form.rfqId} onChange={(e) => setForm({ ...form, rfqId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
              <option value="">-- None --</option>
              {rfqs.map((r: any) => <option key={r.id} value={r.id}>{r.rfqCode} - {r.customer?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link to Deal</label>
            <select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
              <option value="">-- None --</option>
              {deals.map((d: any) => <option key={d.id} value={d.id}>{d.dealName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valid Until *</label>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Terms & Conditions</label>
          <textarea value={form.termsAndConditions} onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Line Items</h3>
            <button type="button" onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 cursor-pointer"><Ico d={icons.plus} size={14} /> Add Item</button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-3">
                  <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} className="w-full px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
                    <option value="">-- Product --</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-3"><input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="w-full px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
                <div className="col-span-2"><input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="w-full px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
                <div className="col-span-2"><input type="number" step="0.01" placeholder="Unit Price" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className="w-full px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
                <div className="col-span-1 text-right text-xs font-medium text-slate-700 py-2">{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}</div>
                <div className="col-span-1 flex justify-end">{items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Ico d={icons.x} size={14} /></button>}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Grand Total</span><span className="font-medium text-slate-800">{formatCurrency(totalAmount)}</span></div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Discount %</span>
            <input type="number" step="0.01" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2"><span className="text-slate-800">Final Amount</span><span className="text-[var(--primary)]">{formatCurrency(finalAmount)}</span></div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer">{saving ? "Creating..." : "Create Quotation"}</button>
          <button type="button" onClick={() => router.push("/quotations")} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">Cancel</button>
        </div>
      </form>
    </PageContainer>
  );
}
