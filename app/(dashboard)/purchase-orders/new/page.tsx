"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { FormSection, FormGrid, FormActions, FormButton, CompactFormContainer } from "@/components/ui/FormLayout";
import { validatePositiveNumeric, validateCurrency, validatePercentage } from "@/lib/formValidation";
import { cn } from "@/lib/ui-utils";

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

  // Auto-fill from selected quotation
  useEffect(() => {
    if (form.quotationId) {
      fetch(`/api/quotations/${form.quotationId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const q = data.data;
            setForm((f) => ({
              ...f,
              customerId: q.customerId || f.customerId,
              contactId: q.contactId || f.contactId,
              dealId: q.dealId || f.dealId,
              paymentTerms: q.paymentTerms || f.paymentTerms,
              deliveryTerms: q.deliveryTerms || f.deliveryTerms,
              discountPercent: String(q.discountPercent || 0),
              expectedDelivery: q.leadTimeDays
                ? new Date(Date.now() + q.leadTimeDays * 86400000).toISOString().split("T")[0]
                : f.expectedDelivery,
              billingAddress: q.customer?.billingAddress || f.billingAddress,
              shippingAddress: q.customer?.shippingAddress || q.customer?.billingAddress || f.shippingAddress,
            }));
            // Auto-fill line items from quotation items
            if (q.items && q.items.length > 0) {
              setItems(q.items.map((it: any) => ({
                productId: it.productId || "",
                description: it.description || "",
                quantity: String(it.quantity || 1),
                unitPrice: String(it.unitPrice || 0),
                totalPrice: it.totalPrice || (it.quantity || 1) * (it.unitPrice || 0),
              })));
            }
          }
        })
        .catch(() => {});
    }
  }, [form.quotationId]);

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
    for (const it of items) {
      const qtyErr = validatePositiveNumeric(it.quantity, "Quantity");
      if (qtyErr) { toast.error(`Item "${it.description}": ${qtyErr}`); return; }
      const priceErr = validateCurrency(it.unitPrice, "Unit Price");
      if (priceErr) { toast.error(`Item "${it.description}": ${priceErr}`); return; }
    }
    const discErr = validatePercentage(form.discountPercent, "Discount");
    if (discErr) { toast.error(discErr); return; }

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
      <CompactFormContainer width="wide">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/purchase-orders")} className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] cursor-pointer transition-colors">
          <Ico d={icons.back} size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Purchase Order</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create a purchase order with line items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header section */}
        <FormSection title="PO Header" description="Customer and purchase order details">
          <FormGrid>
            <FormField label="Customer" required>
              <Input
                type="text"
                placeholder="Search customer..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })}
                required
              >
                <option value="">-- Select Customer --</option>
                {filteredCustomers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Contact">
              <Select
                value={form.contactId}
                onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                disabled={!form.customerId}
              >
                <option value="">-- Select Contact --</option>
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Linked Negotiation">
              <Select
                value={form.negotiationId}
                onChange={(e) => setForm({ ...form, negotiationId: e.target.value })}
                disabled={!form.customerId}
              >
                <option value="">-- None --</option>
                {negotiations.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.negotiationCode} - {n.status}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Linked Quotation">
              <Select
                value={form.quotationId}
                onChange={(e) => setForm({ ...form, quotationId: e.target.value })}
                disabled={!form.customerId}
              >
                <option value="">-- None --</option>
                {quotations.map((q: any) => (
                  <option key={q.id} value={q.id}>{q.quotationCode}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="PO Number (customer's)">
              <Input
                type="text"
                value={form.poNumber}
                onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                placeholder="Customer's PO reference"
              />
            </FormField>

            <FormField label="PO Date">
              <Input
                type="date"
                value={form.poDate}
                onChange={(e) => setForm({ ...form, poDate: e.target.value })}
              />
            </FormField>

            <FormField label="Expected Delivery">
              <Input
                type="date"
                value={form.expectedDelivery}
                onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })}
              />
            </FormField>

            <FormField label="Assigned To">
              <Select
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              >
                <option value="">-- Unassigned --</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Payment Terms">
              <Input
                type="text"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="e.g. Net 30"
              />
            </FormField>

            <FormField label="Delivery Terms">
              <Input
                type="text"
                value={form.deliveryTerms}
                onChange={(e) => setForm({ ...form, deliveryTerms: e.target.value })}
                placeholder="e.g. FOB Destination"
              />
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField label="Shipping Address">
              <Textarea
                value={form.shippingAddress}
                onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                rows={2}
              />
            </FormField>
            <FormField label="Billing Address">
              <Textarea
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                rows={2}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Line items */}
        <FormSection
          title="Line Items"
          description="Products and quantities for this purchase order"
          actions={<FormButton variant="secondary" type="button" onClick={addItem}><Ico d={icons.plus} size={14} /> Add Item</FormButton>}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Product</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-24">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-28">Unit Price</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-28">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-[var(--border-subtle)]">
                    <td className="px-3 py-2">
                      <Select
                        value={it.productId}
                        onChange={(e) => updateItem(i, "productId", e.target.value)}
                        className="py-1.5 text-sm"
                      >
                        <option value="">-- None --</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.productCode || p.name}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={it.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        placeholder="Item description"
                        className="py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className={cn("py-1.5 text-sm text-right", it.quantity && validatePositiveNumeric(it.quantity, "Quantity") && "border-rose-500")}
                      />
                      {it.quantity && validatePositiveNumeric(it.quantity, "Quantity") && <p className="text-[10px] text-rose-500 mt-0.5">{validatePositiveNumeric(it.quantity, "Quantity")}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                        className={cn("py-1.5 text-sm text-right", it.unitPrice && validateCurrency(it.unitPrice, "Unit Price") && "border-rose-500")}
                      />
                      {it.unitPrice && validateCurrency(it.unitPrice, "Unit Price") && <p className="text-[10px] text-rose-500 mt-0.5">{validateCurrency(it.unitPrice, "Unit Price")}</p>}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-[var(--text-primary)]">
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
                <span className="text-[var(--text-secondary)]">Subtotal</span>
                <span className="font-medium text-[var(--text-primary)]">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-secondary)]">Discount %</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className={cn("w-20 text-right", validatePercentage(form.discountPercent, "Discount") && "border-rose-500")}
                />
                {validatePercentage(form.discountPercent, "Discount") && <p className="text-[10px] text-rose-500 mt-0.5">{validatePercentage(form.discountPercent, "Discount")}</p>}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Discount Amount</span>
                <span className="text-[var(--text-primary)]">-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base pt-2 border-t border-[var(--border)]">
                <span className="font-semibold text-[var(--text-primary)]">Final Total</span>
                <span className="font-bold text-[var(--primary)]">${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Notes */}
        <FormSection title="Additional Information">
          <FormField label="Special Instructions">
            <Textarea
              value={form.specialInstructions}
              onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
              rows={2}
              placeholder="Any special handling, packaging, or delivery instructions..."
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Internal notes..."
            />
          </FormField>
        </FormSection>

        <FormActions>
          <FormButton variant="secondary" type="button" onClick={() => router.push("/purchase-orders")}>Cancel</FormButton>
          <FormButton type="submit" disabled={saving}>{saving ? "Saving..." : "Create Purchase Order"}</FormButton>
        </FormActions>
      </form>
      </CompactFormContainer>
    </PageContainer>
  );
}
