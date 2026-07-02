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
import { FieldGrid } from "@/components/shared/FieldGrid";
import { StatusPill } from "@/components/shared/StatusPill";
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

  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading contact details..." /></div>
    );
  }

  if (!contact) return null;

  const initials = getInitials(contact.name);
  const avatarColor = getAvatarColor(contact.name);

  return (
    <div className="page-shell">
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
            {/* Quick Actions */}
            {!editing && (
              <div className="flex items-center gap-2 mt-4">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                    <Phone size={13} /> Call
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors">
                    <Mail size={13} /> Email
                  </a>
                )}
                {contact.phone && (
                  <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors">
                    <svg width={13} height={13} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                )}
              </div>
            )}
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

      <div className="flex gap-6 mt-5">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Tab Selectors */}
          <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px mb-5">
            {[
              { id: "overview", label: "Overview" },
              { id: "rfqs", label: `RFQs (${contact.rfqs?.length || 0})` },
              { id: "quotations", label: `Quotations (${contact.quotations?.length || 0})` },
              { id: "tasks", label: `Tasks (${contact.Task?.length || 0})` },
              { id: "timeline", label: "Activity Timeline" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="crm-card p-6">
                <h3 className="text-sm font-bold text-slate-700 mb-4">Contact Information</h3>
                {!editing ? (
                  <FieldGrid
                    fields={[
                      { label: "Name", value: contact.name, truncate: true },
                      { label: "Email", value: contact.email || "-", truncate: true },
                      { label: "Phone", value: contact.phone || "-" },
                      { label: "Company", value: contact.company || "-", truncate: true },
                      { label: "Title", value: contact.title || "-" },
                      { label: "Designation", value: contact.designation || "-", truncate: true },
                      { label: "Contact Type", value: <StatusPill status={contact.contactType} /> },
                      { label: "Status", value: <StatusPill status={contact.status} /> },
                      { label: "Primary Contact", value: contact.isPrimary ? "Yes" : "No" },
                      { label: "Notes", value: contact.notes || "-", maxLines: 2 },
                    ]}
                  />
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

              {!editing && (
                <div className="crm-card p-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Contact Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-0.5">Preferred Channel</p>
                      <p className="text-sm font-semibold text-slate-700">{contact.preferredChannel || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-0.5">Best Time to Call</p>
                      <p className="text-sm font-semibold text-slate-700">{contact.bestTimeToCall || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-0.5">Language</p>
                      <p className="text-sm font-semibold text-slate-700">{contact.languagePreference || "—"}</p>
                    </div>
                  </div>
                  {contact.dateOfBirth && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 mb-0.5">Birthday</p>
                      <p className="text-sm font-semibold text-slate-700">{new Date(contact.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</p>
                    </div>
                  )}
                </div>
              )}

              {!editing && <NotePanel entityType="CONTACT" entityId={contact.id} />}
            </div>
          )}

          {/* RFQs Tab */}
          {activeTab === "rfqs" && (
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">RFQs</h3>
              {(!contact.rfqs || contact.rfqs.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-sm font-semibold text-slate-400">No RFQs linked</p>
                  <p className="text-xs text-slate-300 mt-1">RFQs associated with this contact will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="crm-table" style={{ minWidth: "500px" }}>
                    <colgroup>
                      <col style={{ width: "120px" }} />
                      <col style={{ width: "200px" }} />
                      <col style={{ width: "100px" }} />
                      <col style={{ width: "100px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="crm-th">RFQ #</th>
                        <th className="crm-th">Details</th>
                        <th className="crm-th">Date</th>
                        <th className="crm-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contact.rfqs.map((r: any) => (
                        <tr key={r.id} className="crm-tr">
                          <td className="crm-td font-mono text-xs text-slate-600">{r.rfqCode}</td>
                          <td className="crm-td font-semibold text-slate-700">{r.requirementDetails?.slice(0, 50) || "—"}</td>
                          <td className="crm-td text-slate-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="crm-td">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              r.status === "Closed"
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Quotations Tab */}
          {activeTab === "quotations" && (
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Quotations</h3>
              {(!contact.quotations || contact.quotations.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-sm font-semibold text-slate-400">No quotations linked</p>
                  <p className="text-xs text-slate-300 mt-1">Quotations associated with this contact will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="crm-table" style={{ minWidth: "500px" }}>
                    <colgroup>
                      <col style={{ width: "120px" }} />
                      <col style={{ width: "100px" }} />
                      <col style={{ width: "100px" }} />
                      <col style={{ width: "100px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="crm-th">Quote #</th>
                        <th className="crm-th">Amount</th>
                        <th className="crm-th">Date</th>
                        <th className="crm-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contact.quotations.map((q: any) => (
                        <tr key={q.id} className="crm-tr">
                          <td className="crm-td font-mono text-xs text-slate-600">{q.quotationCode}</td>
                          <td className="crm-td font-mono text-slate-600">₹{q.totalAmount?.toLocaleString("en-IN") || "—"}</td>
                          <td className="crm-td text-slate-600">{new Date(q.createdAt).toLocaleDateString()}</td>
                          <td className="crm-td">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              q.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : q.status === "Rejected" || q.status === "Expired"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {q.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Tasks</h3>
              {(!contact.Task || contact.Task.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-sm font-semibold text-slate-400">No tasks linked</p>
                  <p className="text-xs text-slate-300 mt-1">Tasks associated with this contact will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contact.Task.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          t.priority === "High" ? "bg-rose-500" : t.priority === "Medium" ? "bg-amber-500" : "bg-slate-300"
                        }`} />
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{t.title}</p>
                          <p className="text-xs text-slate-400">Assigned to {t.User?.name || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {t.dueDate && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar size={12} /> {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : t.status === "Overdue"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="crm-card p-6">
              <h3 className="text-sm font-bold text-slate-700 mb-5">Activity Timeline</h3>
              <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-6">
                {/* Contact created */}
                <div className="relative">
                  <span className="absolute -left-10 top-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 border border-white ring-4 ring-white">
                    <User size={13} />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Contact Created</h4>
                    <span className="text-xs text-slate-400">{formatDateTime(contact.createdAt)}</span>
                  </div>
                </div>

                {/* RFQs */}
                {contact.rfqs?.map((r: any) => (
                  <div key={r.id} className="relative">
                    <span className="absolute -left-10 top-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 border border-white ring-4 ring-white">
                      <Tag size={13} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">RFQ Created: {r.rfqCode}</h4>
                      <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{r.requirementDetails?.slice(0, 80) || ""}</p>
                    </div>
                  </div>
                ))}

                {/* Quotations */}
                {contact.quotations?.map((q: any) => (
                  <div key={q.id} className="relative">
                    <span className="absolute -left-10 top-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-purple-100 text-purple-600 border border-white ring-4 ring-white">
                      <Tag size={13} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">Quotation Created: {q.quotationCode}</h4>
                      <span className="text-xs text-slate-400">{formatDateTime(q.createdAt)}</span>
                      <p className="text-xs text-slate-500 mt-0.5">Amount: ₹{q.totalAmount?.toLocaleString("en-IN") || "—"}</p>
                    </div>
                  </div>
                ))}

                {/* Tasks */}
                {contact.Task?.map((t: any) => (
                  <div key={t.id} className="relative">
                    <span className="absolute -left-10 top-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 border border-white ring-4 ring-white">
                      <Calendar size={13} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">Task: {t.title}</h4>
                      <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
                      <p className="text-xs text-slate-500 mt-0.5">Priority: {t.priority} · Status: {t.status}</p>
                    </div>
                  </div>
                ))}

                {/* Contact updated */}
                {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
                  <div className="relative">
                    <span className="absolute -left-10 top-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 border border-white ring-4 ring-white">
                      <Pencil size={13} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">Contact Updated</h4>
                      <span className="text-xs text-slate-400">{formatDateTime(contact.updatedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Linked Account Card */}
        <div className="w-72 shrink-0 space-y-4 hidden lg:block">
          {contact.customer ? (
            <div className="crm-card p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Linked Account</h3>
              <div
                className="cursor-pointer"
                onClick={() => router.push(`/customer-master/${contact.customer.id}`)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 shrink-0">
                    {contact.customer.name?.charAt(0) || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate hover:text-[var(--primary)] transition-colors">{contact.customer.name}</p>
                    <p className="text-xs font-mono text-slate-500">{contact.customer.customerCode}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      contact.customer.status === "Active" || contact.customer.status === "ActiveCustomer"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {contact.customer.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Account Type</p>
                    <p className="text-sm font-medium text-slate-700">{contact.customer.accountType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Industry</p>
                    <p className="text-sm font-medium text-slate-700">{contact.customer.industryType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">City</p>
                    <p className="text-sm font-medium text-slate-700">{contact.customer.city || "—"}</p>
                  </div>
                  {contact.customer.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone size={11} /> {contact.customer.phone}
                    </div>
                  )}
                  {contact.customer.email && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <Mail size={11} /> {contact.customer.email}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[var(--primary)] hover:underline font-medium mt-3 text-center">View Account 360° →</p>
              </div>
            </div>
          ) : (
            <div className="crm-card p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Linked Account</h3>
              <div className="text-center py-6">
                <Building2 size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No account linked</p>
                <p className="text-xs text-slate-300 mt-1">Link this contact to an account</p>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="mt-3 text-xs text-[var(--primary)] hover:underline font-medium">
                    Edit to link →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats Card */}
          <div className="crm-card p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">RFQs</span>
                <span className="text-sm font-bold text-slate-700">{contact.rfqs?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Quotations</span>
                <span className="text-sm font-bold text-slate-700">{contact.quotations?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Tasks</span>
                <span className="text-sm font-bold text-slate-700">{contact.Task?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

