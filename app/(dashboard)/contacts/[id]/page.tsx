"use client";
import { CRMSpinner } from "@/components/CRMSpinner";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getContactByIdAction, updateContactAction } from "@/app/actions/contacts";
import { getCustomersAction } from "@/app/actions/customers";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotePanel } from "@/components/ui/NotePanel";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { getInitials, getAvatarColor, formatDateTime, cn } from "@/lib/ui-utils";
import { ArrowLeft, Phone, Mail, Building2, Tag, Save, Pencil, X, Check, User, Calendar } from "lucide-react";

const CONTACT_TYPES = ["Technical", "Purchase", "Finance", "Management"];

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContactByIdAction(contactId);
      if (res.success && res.data) {
        setContact(res.data);
        setForm({
          name: res.data.name,
          email: res.data.email ?? "",
          phone: res.data.phone ?? "",
          company: res.data.company ?? "",
          title: res.data.title ?? "",
          designation: res.data.designation ?? "",
          contactType: res.data.contactType ?? "Technical",
          isPrimary: res.data.isPrimary ?? false,
          status: res.data.status ?? "Active",
          notes: res.data.notes ?? "",
          customerId: res.data.customerId ?? null,
        });
      } else {
        toast.error("Contact not found.");
        router.push("/contacts");
      }
    } finally {
      setLoading(false);
    }
  }, [contactId, router, toast]);

  useEffect(() => { load(); }, [load]);

  const loadCustomers = async (query: string) => {
    if (query.length < 2) return;
    const res = await getCustomersAction({ search: query });
    if (res.success && res.data) setCustomers(res.data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateContactAction(contactId, {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        title: form.title || undefined,
        designation: form.designation || undefined,
        contactType: form.contactType,
        isPrimary: form.isPrimary,
        status: form.status,
        notes: form.notes || undefined,
        customerId: form.customerId,
      });
      if (res.success) {
        toast.success("Contact updated");
        setEditing(false);
        load();
      } else {
        toast.error(res.message || "Update failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading contact details..." /></div>
    );
  }

  if (!contact) return null;

  const initials = getInitials(contact.name);
  const avatarColor = getAvatarColor(contact.name);

  return (
    <div className="page-shell max-w-5xl mx-auto">
      <div>
        <button onClick={() => router.push("/contacts")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors mb-4">
          <ArrowLeft size={16} /> Back to Contacts
        </button>
      </div>

      {/* Header card */}
      <div className="crm-card p-6 border-t-4 border-t-[var(--primary)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm text-white", avatarColor)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{contact.name}</h1>
              <StatusBadge status={contact.status} showDot size="md" />
              {contact.isPrimary && <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded font-bold">Primary</span>}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {contact.email && <div className="flex items-center gap-1.5 text-slate-500 text-sm"><Mail size={13} className="text-slate-400" /> {contact.email}</div>}
              {contact.phone && <div className="flex items-center gap-1.5 text-slate-500 text-sm"><Phone size={13} className="text-slate-400" /> {contact.phone}</div>}
              {contact.company && <div className="flex items-center gap-1.5 text-slate-500 text-sm"><Building2 size={13} className="text-slate-400" /> {contact.company}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">Code: <span className="font-mono font-semibold text-slate-600">{contact.contactCode}</span></div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">Type: <span className="font-semibold text-slate-600">{contact.contactType}</span></div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">Created: <span className="font-semibold text-slate-600">{formatDateTime(contact.createdAt)}</span></div>
            </div>
          </div>
          <div className="shrink-0">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Pencil size={13} /> Edit</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs flex items-center gap-1.5"><X size={13} /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5"><Save size={13} /> {saving ? "Savingâ€¦" : "Save"}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        {/* Details / Edit Form */}
        <div className="crm-card p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Contact Information</h3>
          {!editing ? (
            <dl className="space-y-3">
              {[
                { label: "Name", value: contact.name },
                { label: "Email", value: contact.email || "â€”" },
                { label: "Phone", value: contact.phone || "â€”" },
                { label: "Company", value: contact.company || "â€”" },
                { label: "Title", value: contact.title || "â€”" },
                { label: "Designation", value: contact.designation || "â€”" },
                { label: "Contact Type", value: contact.contactType },
                { label: "Customer", value: contact.customer ? contact.customer.name : "â€”" },
                { label: "Status", value: <StatusBadge status={contact.status} size="sm" /> },
                { label: "Notes", value: contact.notes || "â€”" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-4">
              <FormField label="Name" required><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} /></FormField>
                <FormField label="Phone"><Input value={form.phone} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></FormField>
                <FormField label="Company"><Input value={form.company} onChange={(e) => setForm((f: any) => ({ ...f, company: e.target.value }))} /></FormField>
                <FormField label="Title"><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></FormField>
                <FormField label="Designation"><Input value={form.designation} onChange={(e) => setForm((f: any) => ({ ...f, designation: e.target.value }))} /></FormField>
                <FormField label="Contact Type">
                  <Select value={form.contactType} onChange={(e) => setForm((f: any) => ({ ...f, contactType: e.target.value }))}>
                    {CONTACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </Select>
                </FormField>
                <FormField label="Status">
                  <Select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </FormField>
              </div>

              {/* Customer selector */}
              <FormField label="Linked Customer">
                {form.customerId ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-sm text-slate-700">{contact.customer?.name || "Customer"}</span>
                    <button onClick={() => setForm((f: any) => ({ ...f, customerId: null }))} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); loadCustomers(e.target.value); setShowCustomerSearch(true); }} className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                    {showCustomerSearch && customers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {customers.map((c) => (
                          <button key={c.id} onClick={() => { setForm((f: any) => ({ ...f, customerId: c.id })); setShowCustomerSearch(false); setCustomerSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-slate-400 ml-2">{c.customerCode}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </FormField>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" className="sr-only" checked={form.isPrimary} onChange={(e) => setForm((f: any) => ({ ...f, isPrimary: e.target.checked }))} />
                <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${form.isPrimary ? "bg-[var(--primary)] border-[var(--primary)]" : "border-slate-300 bg-white"}`}>
                  {form.isPrimary && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm text-slate-600">Is Primary Contact</span>
              </label>

              <FormField label="Notes"><Textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} /></FormField>
            </div>
          )}
        </div>

        {/* Notes Panel */}
        <div>
          <NotePanel entityType="CONTACT" entityId={contact.id} />
        </div>
      </div>
    </div>
  );
}

