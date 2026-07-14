"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContactAction } from "@/app/actions/contacts";
import { getCustomersAction } from "@/app/actions/customers";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { validateEmail, validatePhone, validateAlphabetic, validateRequired } from "@/lib/formValidation";

const CONTACT_TYPES = ["Technical", "Purchase", "Finance", "Management"];

export default function NewContactPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    designation: "",
    contactType: "Technical",
    isPrimary: false,
    status: "Active",
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadCustomers = async (query: string) => {
    if (query.length < 2) return;
    const res = await getCustomersAction({ search: query });
    if (res.success && res.data) setCustomers(res.data);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    const nameErr = validateRequired(form.name, "Name"); if (nameErr) errors.name = nameErr;
    else { const e = validateAlphabetic(form.name, "Name"); if (e) errors.name = e; }
    const emailErr = validateEmail(form.email); if (emailErr) errors.email = emailErr;
    const phoneErr = validatePhone(form.phone); if (phoneErr) errors.phone = phoneErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fix the errors below");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await createContactAction({
        ...form,
        customerId: selectedCustomer?.id ?? null,
      });
      if (res.success) {
        toast.success("Contact created");
        router.push("/contacts");
      } else {
        toast.error(res.message || "Failed to create contact");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="New Contact" subtitle="Create a new contact linked to a customer."
      action={
        <Link href="/contacts" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Contacts
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center"><UserPlus size={20} className="text-[var(--primary)]" /></div>
            <h2 className="text-lg font-semibold text-slate-800">Contact Information</h2>
          </div>

          {/* Customer selector */}
          <FormField label="Linked Customer" hint="Search and select a customer">
            {selectedCustomer ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-700">{selectedCustomer.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{selectedCustomer.customerCode}</span>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); loadCustomers(e.target.value); setShowCustomerSearch(true); }}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
                {showCustomerSearch && customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {customers.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{c.customerCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Name" required error={fieldErrors.name}><Input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFieldErrors((p) => ({ ...p, name: "" })); }} placeholder="e.g. John Smith" className={fieldErrors.name ? "border-rose-500" : ""} /></FormField>
            <FormField label="Email" error={fieldErrors.email}><Input type="email" value={form.email} onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFieldErrors((p) => ({ ...p, email: "" })); }} placeholder="john@company.com" className={fieldErrors.email ? "border-rose-500" : ""} /></FormField>
            <FormField label="Phone" error={fieldErrors.phone}><Input value={form.phone} onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setFieldErrors((p) => ({ ...p, phone: "" })); }} placeholder="+1 555-0000" className={fieldErrors.phone ? "border-rose-500" : ""} /></FormField>
            <FormField label="Company"><Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Company name" /></FormField>
            <FormField label="Title"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Manager" /></FormField>
            <FormField label="Designation"><Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. CTO" /></FormField>
            <FormField label="Contact Type">
              <Select value={form.contactType} onChange={(e) => setForm((f) => ({ ...f, contactType: e.target.value }))}>
                {CONTACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="sr-only" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
            <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${form.isPrimary ? "bg-[var(--primary)] border-[var(--primary)]" : "border-slate-300 bg-white"}`}>
              {form.isPrimary && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-sm text-slate-600">Is Primary Contact</span>
          </label>

          <FormField label="Notes"><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." rows={3} /></FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/contacts" className="btn-secondary text-sm">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? "Saving…" : <><Save size={14} /> Create Contact</>}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
