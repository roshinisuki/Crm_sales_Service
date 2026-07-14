"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { FormSection, FormGrid, FormActions, FormButton, CompactFormContainer } from "@/components/ui/FormLayout";
import { getCustomersAction } from "@/app/actions/customers";
import { TemplateUploader, ParsedLineItem } from "@/components/rfq/TemplateUploader";
import { Trash2, Plus, ArrowLeft, Upload, Edit3 } from "lucide-react";
import { validatePositiveNumeric, validateCurrency } from "@/lib/formValidation";

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

  const [uploadMode, setUploadMode] = useState<"manual" | "template">("manual");
  const [templateFileName, setTemplateFileName] = useState<string | null>(null);
  const [templateFileUrl, setTemplateFileUrl] = useState<string | null>(null);

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

  const handleParsed = (data: {
    lineItems: ParsedLineItem[];
    templateFileName: string;
    templateFileUrl: string;
    rawText?: string;
  }) => {
    setTemplateFileName(data.templateFileName);
    setTemplateFileUrl(data.templateFileUrl);
    setLineItems(
      data.lineItems.map(li => ({
        item_description: li.item_description,
        product_id: "",
        quantity: li.quantity,
        unit: li.unit,
        target_price: li.target_price,
        delivery_date: "",
        specifications: li.specifications,
      }))
    );
    setUploadMode("manual");
    toast.success("Template parsed successfully. Please review the line items.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select a customer"); return; }
    const validLineItems = lineItems.filter(li => li.item_description.trim());
    if (validLineItems.length === 0) { toast.error("At least one line item with a description is required"); return; }
    for (const li of validLineItems) {
      const qtyErr = validatePositiveNumeric(li.quantity, "Quantity");
      if (qtyErr) { toast.error(`Item "${li.item_description}": ${qtyErr}`); return; }
      if (li.target_price) {
        const priceErr = validateCurrency(li.target_price, "Target Price");
        if (priceErr) { toast.error(`Item "${li.item_description}": ${priceErr}`); return; }
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          opportunityId: opportunityId,
          templateFileName,
          templateFileUrl,
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
      <CompactFormContainer width="wide">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/rfq")} className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">New RFQ</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create a new Request for Quotation</p>
        </div>
      </div>

      {loadingContext && (
        <div className="form-section">
          <div className="form-section-body">
            <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
              Loading opportunity details...
            </div>
          </div>
        </div>
      )}

      {contextError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {contextError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="RFQ Details" description="Customer and request information">
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
                  <option key={c.id} value={c.id}>{c.name} {c.title ? `(${c.title})` : ""}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Received Date">
              <Input
                type="date"
                value={form.receivedDate}
                onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              />
            </FormField>

            <FormField label="Customer Due Date" hint="Date by which customer expects the quotation">
              <Input
                type="date"
                value={form.customerDueDate}
                onChange={(e) => setForm({ ...form, customerDueDate: e.target.value })}
              />
            </FormField>

            <FormField label="Assigned To">
              <Select
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              >
                <option value="">-- Select User --</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </Select>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Line Items"
          description="Items requested in this RFQ"
          actions={<FormButton variant="secondary" type="button" onClick={addLineItem}><Plus size={14} /> Add Line Item</FormButton>}
        >
          <div className="mb-4 flex space-x-2 border-b border-[var(--border-subtle)] pb-2">
            <button
              type="button"
              onClick={() => setUploadMode("manual")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${uploadMode === "manual" ? "bg-[var(--surface-1)] border-b-2 border-primary-600 text-primary-700" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <div className="flex items-center gap-2"><Edit3 size={16} /> Manual Entry</div>
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("template")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${uploadMode === "template" ? "bg-[var(--surface-1)] border-b-2 border-primary-600 text-primary-700" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <div className="flex items-center gap-2"><Upload size={16} /> Upload Template</div>
            </button>
          </div>

          {uploadMode === "template" ? (
            <div className="p-6 bg-[var(--surface-0)] border border-[var(--border-subtle)] rounded-lg">
              <TemplateUploader onParsed={handleParsed} />
            </div>
          ) : (
            <div className="space-y-4">
              {templateFileName && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex justify-between items-center">
                  <span className="text-sm font-medium">Imported from template: {templateFileName}</span>
                  <button type="button" onClick={() => { setTemplateFileName(null); setTemplateFileUrl(null); }} className="text-blue-500 hover:text-blue-700 text-xs font-semibold">
                    Remove Link
                  </button>
                </div>
              )}
              {lineItems.map((li, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-tertiary)]">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLineItem(idx)} className="text-red-500 hover:text-red-700 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <FormGrid>
                  <FormField label="Description" required className="sm:col-span-2">
                    <Input
                      type="text"
                      value={li.item_description}
                      onChange={(e) => updateLineItem(idx, "item_description", e.target.value)}
                      placeholder="Item description..."
                    />
                  </FormField>
                  <FormField label="Product">
                    <Select
                      value={li.product_id}
                      onChange={(e) => updateLineItem(idx, "product_id", e.target.value)}
                    >
                      <option value="">-- Select Product --</option>
                      {filteredProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Quantity" error={li.quantity && validatePositiveNumeric(li.quantity, "Quantity")}>
                    <Input
                      type="number"
                      min="1"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(idx, "quantity", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Unit">
                    <Input
                      type="text"
                      value={li.unit}
                      onChange={(e) => updateLineItem(idx, "unit", e.target.value)}
                      placeholder="pcs, kg, set..."
                    />
                  </FormField>
                  <FormField label="Target Price (₹)" error={li.target_price && validateCurrency(li.target_price, "Target Price")}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={li.target_price}
                      onChange={(e) => updateLineItem(idx, "target_price", e.target.value)}
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField label="Requested Delivery Date" className="sm:col-span-2">
                    <Input
                      type="date"
                      value={li.delivery_date}
                      onChange={(e) => updateLineItem(idx, "delivery_date", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
              </div>
            ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Additional Information">
          <FormField label="Requirement Details">
            <Textarea
              value={form.requirementDetails}
              onChange={(e) => setForm({ ...form, requirementDetails: e.target.value })}
              rows={3}
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </FormField>
        </FormSection>

        <FormActions>
          <FormButton type="submit" disabled={saving}>{saving ? "Creating..." : "Create RFQ"}</FormButton>
          <FormButton variant="secondary" type="button" onClick={() => router.push("/rfq")}>Cancel</FormButton>
        </FormActions>
      </form>
      </CompactFormContainer>
    </PageContainer>
  );
}
