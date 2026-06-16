"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getContactsAction, deleteContactAction } from "@/app/actions/contacts";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Search, Filter, Plus, BookUser, Eye, Pencil, Trash2, Mail, Phone, User, Tag, Users, CheckCircle2, ArchiveX } from "lucide-react";
import { getInitials, getAvatarColor, cn } from "@/lib/ui-utils";

const CONTACT_TYPES = ["Technical", "Purchase", "Finance", "Management"];

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "");

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await getContactsAction({
        search,
        status: statusFilter || undefined,
        contactType: typeFilter || undefined,
      });
      if (res.success && res.data) {
        setContacts(res.data);
      } else {
        toast.error(res.message || "Failed to load contacts");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while loading contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, statusFilter, typeFilter]);

  const itemsPerPage = 20;
  const { page, setPage, totalPages, paged: paginatedContacts } = usePagination(contacts, itemsPerPage);

  const kpiTotal = contacts.length;
  const kpiActive = contacts.filter((c) => c.status === "Active").length;
  const kpiInactive = contacts.filter((c) => c.status === "Inactive").length;

  const confirmDelete = (contact: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Contact",
      message: `Are you sure you want to delete "${contact.name}"? This cannot be undone.`,
      action: async () => {
        const res = await deleteContactAction(contact.id);
        if (res.success) {
          toast.success("Contact deleted");
          fetchContacts();
        } else {
          toast.error(res.message || "Delete failed");
        }
        setConfirmState((s) => ({ ...s, isOpen: false }));
      },
    });
  };

  return (
    <PageShell
      title="Contacts"
      subtitle="Manage contacts linked to customers and leads."
      action={
        <Link href="/contacts/new" className="btn-primary text-xs flex items-center gap-2">
          <Plus size={14} /> Add Contact
        </Link>
      }
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Contacts" value={kpiTotal} subtitle="All contacts" icon={<Users size={20} />} variant="blue" />
          <SummaryCard label="Active" value={kpiActive} subtitle="Active contacts" icon={<CheckCircle2 size={20} />} variant="green" />
          <SummaryCard label="Inactive" value={kpiInactive} subtitle="Inactive contacts" icon={<ArchiveX size={20} />} variant="red" />
        </div>

        {/* Filter bar */}
        <div className="crm-card bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Filter size={14} /> Filter:</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--primary)]">
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--primary)]">
              <option value="">All Types</option>
              {CONTACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
        </div>

        {/* Contacts table */}
        <div className="crm-card overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-4">Code</th>
                  <th className="px-4 py-4">Name</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Phone</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Loading contacts...</td></tr>
                ) : paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><BookUser size={20} className="text-slate-400" /></div>
                      <p className="text-sm font-semibold text-slate-700">No contacts found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-slate-600 text-sm">
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-[var(--primary)]">{contact.contactCode}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm", getAvatarColor(contact.name))}>
                            {getInitials(contact.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{contact.name}</div>
                            {contact.isPrimary && <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded font-bold">Primary</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {contact.customer ? (
                          <div className="flex items-center gap-1.5"><User size={12} className="text-slate-400" />{contact.customer.name}</div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600"><Tag size={10} />{contact.contactType}</span>
                      </td>
                      <td className="px-4 py-4">
                        {contact.phone ? <div className="flex items-center gap-1.5 text-xs"><Phone size={12} className="text-slate-400" />{contact.phone}</div> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {contact.email ? <div className="flex items-center gap-1.5 text-xs"><Mail size={12} className="text-slate-400" />{contact.email}</div> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={contact.status} size="sm" /></td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => router.push(`/contacts/${contact.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[var(--primary)] transition-colors" title="View"><Eye size={15} /></button>
                          <button onClick={() => router.push(`/contacts/${contact.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors" title="Edit"><Pencil size={15} /></button>
                          <button onClick={() => confirmDelete(contact)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && contacts.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-100">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState((s) => ({ ...s, isOpen: false }))} />
    </PageShell>
  );
}
