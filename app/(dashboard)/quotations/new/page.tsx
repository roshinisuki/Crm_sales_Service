"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { getCustomersAction } from "@/app/actions/customers";

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
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [opportunityContext, setOpportunityContext] = useState<any>(null);

  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    contactId: "",
    rfqId: "",
    dealId: "",
    dealTitle: "",
    opportunityCode: "",
    validUntil: "",
    discountPercent: "0",
    termsAndConditions: "",
    assignedUserId: "",
  });

  const [items, setItems] = useState<any[]>([{ productId: "", description: "", quantity: "1", unitPrice: "0", hsn: "", unit: "Nos", discountPercent: "0", taxPercent: "18" }]);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [freightTerms, setFreightTerms] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");

  useEffect(() => {
    getCustomersAction().then(res => {
      if (res.success && res.data) setCustomers(res.data as any[]);
      else console.error("Failed to load customers:", res.message);
    }).catch(err => console.error("Error loading customers:", err));
    fetch("/api/catalogue/products").then(res => res.json()).then(data => { if (data.success) setProducts(data.data || []); else console.error("Failed to load products:", data.message); }).catch(err => console.error("Error loading products:", err));
    fetch("/api/rfq").then(res => res.json()).then(data => { if (data.success) setRfqs(data.data || []); else console.error("Failed to load RFQs:", data.message); }).catch(err => console.error("Error loading RFQs:", err));
    fetch("/api/deals").then(res => res.json()).then(data => { if (data.success) setDeals(data.data || []); else console.error("Failed to load deals:", data.message); }).catch(err => console.error("Error loading deals:", err));
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); else console.error("Failed to load users:", data.message); }).catch(err => console.error("Error loading users:", err));

    // Pre-fill from query params
    const rfqId = searchParams.get("rfqId");
    const customerId = searchParams.get("customerId");
    const contactId = searchParams.get("contactId");
    const productId = searchParams.get("productId");
    const opportunityId = searchParams.get("opportunityId");

    if (opportunityId) {
      fetchOpportunityContext(opportunityId);
    } else {
      if (customerId) setForm(f => ({ ...f, customerId }));
      if (contactId) setForm(f => ({ ...f, contactId }));
      if (rfqId) setForm(f => ({ ...f, rfqId }));
    }

    if (productId) {
      setItems([{ productId, description: "", quantity: "1", unitPrice: "0" }]);
    }
  }, []);

  async function fetchOpportunityContext(oppId: string) {
    setLoadingContext(true);
    setContextError(null);
    try {
      const res = await fetch(`/api/opportunities/${oppId}/context`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to load opportunity context");
      }
      const json = await res.json();
      const data = json.data;
      setOpportunityContext(data);
      setCustomerSearch(data.accountName || "");
      setForm(prev => ({
        ...prev,
        customerId: data.accountId,
        customerName: data.accountName,
        contactId: data.contactId || "",
        dealId: data.opportunityId,
        dealTitle: data.dealTitle,
        opportunityCode: data.opportunityCode,
        rfqId: data.linkedRfqId || "",
        assignedUserId: data.assignedUserId || "",
        validUntil: getDefaultValidUntil(),
      }));
      // Pre-load contacts for the account so the contact dropdown is populated
      if (data.accountId) {
        fetch(`/api/contacts?customerId=${data.accountId}`).then(res => res.json()).then(contactData => {
          if (contactData.success) setContacts(contactData.data || []);
        });
      }
      // Pre-fill first line item product only if opportunity has a clearly associated product
      if (data.primaryProductId) {
        setItems([{ productId: data.primaryProductId, description: data.primaryProductName || "", quantity: "1", unitPrice: "0" }]);
      }
    } catch (err: any) {
      console.error("Quotation context fetch failed:", err);
      setContextError(err.message || "Could not load linked customer details — please select manually.");
    } finally {
      setLoadingContext(false);
    }
  }

  function getDefaultValidUntil() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/contacts?customerId=${form.customerId}`).then(res => res.json()).then(data => { if (data.success) setContacts(data.data || []); });
    } else {
      setContacts([]);
    }
  }, [form.customerId]);

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const lineDisc = parseFloat(item.discountPercent) || 0;
    return sum + qty * price * (1 - lineDisc / 100);
  }, 0);
  const taxAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const lineDisc = parseFloat(item.discountPercent) || 0;
    const taxPct = parseFloat(item.taxPercent) || 18;
    return sum + qty * price * (1 - lineDisc / 100) * (taxPct / 100);
  }, 0);
  const discountPercent = parseFloat(form.discountPercent) || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const finalAmount = subtotal - discountAmount + taxAmount;

  const addItem = () => setItems([...items, { productId: "", description: "", quantity: "1", unitPrice: "0", hsn: "", unit: "Nos", discountPercent: "0", taxPercent: "18" }]);
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
      const { customerName, dealTitle, opportunityCode, ...submitForm } = form;
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submitForm, items, paymentTerms, deliveryTerms, freightTerms, leadTimeDays }),
      });
      const data = await res.json();
      const opportunityId = searchParams.get("opportunityId");
      if (data.success) {
        toast.success("Quotation created");
        if (opportunityId) {
          router.push(`/sales-pipeline/${opportunityId}/opportunity-detail`);
        } else {
          router.push(`/quotations/${data.data.id}`);
        }
      }
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

      {loadingContext && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            Loading opportunity details...
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          </div>
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
            <input type="text" placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all mb-2" />
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
              <option value="">-- Select Customer --</option>
              {filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
            </select>
            {searchParams.get("opportunityId") && form.dealTitle && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>🔗</span>
                <span>Linked to: <strong>{form.dealTitle}</strong> ({form.opportunityCode})</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
            <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} disabled={!form.customerId} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer disabled:opacity-50">
              <option value="">-- Select Contact --</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.designation ? ` — ${c.designation}` : ""}{c.isPrimary ? " (Primary)" : ""}
                </option>
              ))}
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
            {searchParams.get("opportunityId") ? (
              <>
                <select value={form.dealId} disabled className="w-full px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-700 cursor-default disabled:opacity-100">
                  <option value={form.dealId}>{form.dealTitle}</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">Deal auto-linked from opportunity</p>
              </>
            ) : (
              <select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
                <option value="">-- None --</option>
                {deals.map((d: any) => <option key={d.id} value={d.id}>{d.dealName}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valid Until *</label>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
            <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer">
              <option value="">-- Select User --</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
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
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Product</label>
                    <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer">
                      <option value="">-- Product --</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
                    <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">HSN</label>
                    <input type="text" placeholder="HSN" value={item.hsn} onChange={(e) => updateItem(idx, "hsn", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Qty</label>
                    <input type="number" step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">UOM</label>
                    <input type="text" placeholder="UOM" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Price</label>
                    <input type="number" step="0.01" placeholder="Price" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Disc%</label>
                    <input type="number" step="0.01" min="0" max="100" placeholder="0" value={item.discountPercent} onChange={(e) => updateItem(idx, "discountPercent", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tax%</label>
                    <input type="number" step="0.01" placeholder="18" value={item.taxPercent} onChange={(e) => updateItem(idx, "taxPercent", e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                  </div>
                  <div className="col-span-0 flex flex-col items-end justify-end pb-1">
                    <span className="text-xs font-medium text-slate-700">{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100)).toFixed(2)}</span>
                    {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer mt-1"><Ico d={icons.x} size={12} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commercial Terms */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Commercial Terms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Terms</label>
              <input type="text" placeholder="e.g. 50% advance, 50% on delivery" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Terms</label>
              <input type="text" placeholder="e.g. Ex-Works" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Freight Terms</label>
              <input type="text" placeholder="e.g. Extra at actuals" value={freightTerms} onChange={(e) => setFreightTerms(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lead Time (days)</label>
              <input type="number" placeholder="e.g. 15" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-medium text-slate-800">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Tax (GST)</span><span className="font-medium text-slate-800">+{formatCurrency(taxAmount)}</span></div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Header Discount %</span>
            <input type="number" step="0.01" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
          <div className="flex justify-between text-sm text-red-600"><span>Discount Amount</span><span>-{formatCurrency(discountAmount)}</span></div>
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
