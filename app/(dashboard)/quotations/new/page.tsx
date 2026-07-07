"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { FormSection, FormGrid, FormActions, FormButton, CompactFormContainer } from "@/components/ui/FormLayout";
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
      <CompactFormContainer width="wide">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/quotations")} className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] cursor-pointer transition-colors"><Ico d={icons.back} size={18} /></button>
        <div><h1 className="text-2xl font-bold text-[var(--text-primary)]">New Quotation</h1><p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create a new quotation</p></div>
      </div>

      {loadingContext && (
        <div className="form-section">
          <div className="form-section-body">
            <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
              Loading opportunity details...
            </div>
            <FormGrid>
              <div className="h-10 rounded-xl bg-[var(--surface-2)] animate-pulse" />
              <div className="h-10 rounded-xl bg-[var(--surface-2)] animate-pulse" />
              <div className="h-10 rounded-xl bg-[var(--surface-2)] animate-pulse" />
              <div className="h-10 rounded-xl bg-[var(--surface-2)] animate-pulse" />
            </FormGrid>
          </div>
        </div>
      )}

      {contextError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {contextError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="Quotation Details" description="Customer and linkage information">
          <FormGrid>
            <FormField label="Customer" required>
              <Input type="text" placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="mb-2" />
              <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })} required>
                <option value="">-- Select Customer --</option>
                {filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
              </Select>
              {searchParams.get("opportunityId") && form.dealTitle && (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 flex items-center gap-1">
                  <span>🔗</span>
                  <span>Linked to: <strong>{form.dealTitle}</strong> ({form.opportunityCode})</span>
                </p>
              )}
            </FormField>
            <FormField label="Contact">
              <Select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} disabled={!form.customerId}>
                <option value="">-- Select Contact --</option>
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.designation ? ` — ${c.designation}` : ""}{c.isPrimary ? " (Primary)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Link to RFQ">
              <Select value={form.rfqId} onChange={(e) => setForm({ ...form, rfqId: e.target.value })}>
                <option value="">-- None --</option>
                {rfqs.map((r: any) => <option key={r.id} value={r.id}>{r.rfqCode} - {r.customer?.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Link to Deal">
              {searchParams.get("opportunityId") ? (
                <>
                  <Select value={form.dealId} disabled>
                    <option value={form.dealId}>{form.dealTitle}</option>
                  </Select>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">Deal auto-linked from opportunity</p>
                </>
              ) : (
                <Select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })}>
                  <option value="">-- None --</option>
                  {deals.map((d: any) => <option key={d.id} value={d.id}>{d.dealName}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Valid Until" required>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required />
            </FormField>
            <FormField label="Assigned To">
              <Select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
                <option value="">-- Select User --</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </Select>
            </FormField>
          </FormGrid>
          <FormField label="Terms & Conditions">
            <Textarea value={form.termsAndConditions} onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })} rows={3} />
          </FormField>
        </FormSection>

        {/* Line Items */}
        <FormSection
          title="Line Items"
          description="Products and pricing for this quotation"
          actions={<FormButton variant="secondary" type="button" onClick={addItem}><Ico d={icons.plus} size={14} /> Add Item</FormButton>}
        >
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)]">
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Product</label>
                    <Select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} className="text-xs py-1.5">
                      <option value="">-- Product --</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Description</label>
                    <Input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">HSN</label>
                    <Input type="text" placeholder="HSN" value={item.hsn} onChange={(e) => updateItem(idx, "hsn", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Qty</label>
                    <Input type="number" step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">UOM</label>
                    <Input type="text" placeholder="UOM" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Price</label>
                    <Input type="number" step="0.01" placeholder="Price" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Disc%</label>
                    <Input type="number" step="0.01" min="0" max="100" placeholder="0" value={item.discountPercent} onChange={(e) => updateItem(idx, "discountPercent", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-tertiary)] mb-0.5">Tax%</label>
                    <Input type="number" step="0.01" placeholder="18" value={item.taxPercent} onChange={(e) => updateItem(idx, "taxPercent", e.target.value)} className="text-xs py-1.5" />
                  </div>
                  <div className="col-span-0 flex flex-col items-end justify-end pb-1">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100)).toFixed(2)}</span>
                    {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer mt-1"><Ico d={icons.x} size={12} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        {/* Commercial Terms */}
        <FormSection title="Commercial Terms">
          <FormGrid>
            <FormField label="Payment Terms">
              <Input type="text" placeholder="e.g. 50% advance, 50% on delivery" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </FormField>
            <FormField label="Delivery Terms">
              <Input type="text" placeholder="e.g. Ex-Works" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            </FormField>
            <FormField label="Freight Terms">
              <Input type="text" placeholder="e.g. Extra at actuals" value={freightTerms} onChange={(e) => setFreightTerms(e.target.value)} />
            </FormField>
            <FormField label="Lead Time (days)">
              <Input type="number" placeholder="e.g. 15" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Totals */}
        <FormSection title="Summary">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Tax (GST)</span><span className="font-medium text-[var(--text-primary)]">+{formatCurrency(taxAmount)}</span></div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-secondary)]">Header Discount %</span>
              <Input type="number" step="0.01" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="w-24 text-right" />
            </div>
            <div className="flex justify-between text-sm text-red-600"><span>Discount Amount</span><span>-{formatCurrency(discountAmount)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-[var(--border)] pt-2"><span className="text-[var(--text-primary)]">Final Amount</span><span className="text-[var(--primary)]">{formatCurrency(finalAmount)}</span></div>
          </div>
        </FormSection>

        <FormActions>
          <FormButton type="submit" disabled={saving}>{saving ? "Creating..." : "Create Quotation"}</FormButton>
          <FormButton variant="secondary" type="button" onClick={() => router.push("/quotations")}>Cancel</FormButton>
        </FormActions>
      </form>
      </CompactFormContainer>
    </PageContainer>
  );
}
