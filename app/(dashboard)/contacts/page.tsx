"use client";

import { useState, useEffect, Suspense } from "react";
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
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { DIRECTORY_STATUS } from "@/lib/module-status-config";
import { Search, Filter, Plus, BookUser, Pencil, Trash2, Mail, Phone, User, Tag, Users, CheckCircle2, ArchiveX } from "lucide-react";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { getInitials, getAvatarColor, cn } from "@/lib/ui-utils";

const CONTACT_TYPES = ["Technical", "Purchase", "Finance", "Management"];

function ContactsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { startLoading, stopLoading } = useGlobalLoading();
  const [search, setSearch] = useState("");
  const statusFilter = useStatusFromUrl("status");
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
      title="Contacts Overview"
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

        {/* Status Filter Bar */}
        <StatusFilterBar
          statuses={DIRECTORY_STATUS}
          paramKey="status"
          basePath="/contacts"
        />

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
            <div className="flex items-center gap-2 text-xs text-slate-500"><Filter size={14} /> Type:</div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTypeFilter("")}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded-xl border transition-colors",
                  typeFilter === "" ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                All
              </button>
              {CONTACT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-xl border transition-colors",
                    typeFilter === t ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contacts table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th">Code</th>
                  <th className="crm-th">Name</th>
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Type</th>
                  <th className="crm-th">Phone</th>
                  <th className="crm-th">Email</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? null : paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="crm-td text-center py-16">
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><BookUser size={20} className="text-muted-foreground" /></div>
                      <p className="text-sm font-medium text-foreground">No contacts found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="crm-tr table-row-clickable"
                      onClick={() => router.push(`/contacts/${contact.id}?type=${contact.type || ""}`)}
                    >
                      <td className="crm-td font-mono text-xs font-medium text-[var(--primary)]">{contact.contactCode}</td>
                      <td className="crm-td">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm", getAvatarColor(contact.name))}>
                            {getInitials(contact.name)}
                          </div>
                          <div>
                            <div className="row-primary-link">{contact.name}</div>
                            {contact.isPrimary && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Primary</span>}
                          </div>
                        </div>
                      </td>
                      <td className="crm-td text-xs">
                        {contact.customer ? (
                          <div className="flex items-center gap-1.5"><User size={12} className="text-muted-foreground" />{contact.customer.name}</div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="crm-td">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground"><Tag size={10} />{contact.contactType}</span>
                      </td>
                      <td className="crm-td">
                        {contact.phone ? <div className="flex items-center gap-1.5 text-xs"><Phone size={12} className="text-muted-foreground" />{contact.phone}</div> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="crm-td">
                        {contact.email ? <div className="flex items-center gap-1.5 text-xs"><Mail size={12} className="text-muted-foreground" />{contact.email}</div> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="crm-td"><StatusBadge status={contact.status} size="sm" /></td>
                      <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => router.push(`/contacts/${contact.id}?type=${contact.type || ""}`)} className="row-action-btn" title="Edit"><Pencil size={15} /></button>
                          <button onClick={() => confirmDelete(contact)} className="row-action-btn row-action-btn-danger" title="Delete"><Trash2 size={15} /></button>
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

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
