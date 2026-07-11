"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getActivitiesAction, deleteActivityAction, getNotesAction, deleteNoteAction } from "@/app/actions/activities";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CRMSpinner } from "@/components/CRMSpinner";
import { Search, Filter, Plus, Phone, Video, StickyNote, Trash2, Clock, Calendar, User, MessageSquare, List } from "lucide-react";
import { formatDate, cn } from "@/lib/ui-utils";

type TabType = "calls" | "meetings" | "notes" | "emails" | "whatsapp";

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ReactNode; channel: string }> = {
  calls: { label: "Calls", icon: <Phone size={16} />, channel: "Call" },
  meetings: { label: "Meetings", icon: <Video size={16} />, channel: "Meeting" },
  notes: { label: "Notes", icon: <StickyNote size={16} />, channel: "Note" },
  emails: { label: "Emails", icon: <MessageSquare size={16} />, channel: "Email" },
  whatsapp: { label: "WhatsApp", icon: <MessageSquare size={16} />, channel: "WhatsApp" },
};

function normalizeTab(val: string | null): TabType {
  const map: Record<string, TabType> = {
    calls: "calls", meetings: "meetings", notes: "notes", emails: "emails", whatsapp: "whatsapp",
    Call: "calls", Meeting: "meetings", Note: "notes", Email: "emails", WhatsApp: "whatsapp",
  };
  return map[val || ""] || "calls";
}

export default function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>(normalizeTab(searchParams.get("type")));
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "notes") {
        const res = await getNotesAction({ search });
        if (res.success && res.data) {
          setItems(res.data.map((n: any) => ({ ...n, _type: "note" })));
        }
      } else {
        const res = await getActivitiesAction({
          channel: TAB_CONFIG[activeTab].channel,
          search,
        });
        if (res.success && res.data) {
          setItems(res.data.map((l: any) => ({ ...l, _type: "log" })));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const type = searchParams.get("type");
    const normalized = normalizeTab(type);
    if (normalized !== activeTab) {
      setActiveTab(normalized);
      setPage(1);
      setStatusFilter("");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [activeTab, search]);

  const filteredItems = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((item) => (item.status || "").toLowerCase() === statusFilter.toLowerCase());
  }, [items, statusFilter]);

  const itemsPerPage = 20;
  const { page, setPage, totalPages, paged: paginatedItems } = usePagination(filteredItems, itemsPerPage);

  const confirmDelete = (item: any) => {
    setConfirmState({
      isOpen: true,
      title: `Delete ${activeTab === "notes" ? "Note" : "Activity"}`,
      message: "Are you sure? This cannot be undone.",
      action: async () => {
        const res = item._type === "note"
          ? await deleteNoteAction(item.id)
          : await deleteActivityAction(item.id);
        if (res.success) {
          toast.success("Deleted");
          fetchData();
        } else {
          toast.error(res.message || "Delete failed");
        }
        setConfirmState((s) => ({ ...s, isOpen: false }));
      },
    });
  };

  const typeParam = searchParams.get("type");
  const tabs = [
    { label: "Overview", href: "/activities", active: pathname === "/activities" && !typeParam, icon: <List size={16} /> },
    { label: "Calls", href: "/activities?type=Call", active: pathname === "/activities" && (typeParam === "Call" || typeParam === "calls"), icon: <Phone size={16} /> },
    { label: "Meetings", href: "/activities?type=Meeting", active: pathname === "/activities" && (typeParam === "Meeting" || typeParam === "meetings"), icon: <Video size={16} /> },
    { label: "Emails", href: "/activities?type=Email", active: pathname === "/activities" && (typeParam === "Email" || typeParam === "emails"), icon: <MessageSquare size={16} /> },
    { label: "WhatsApp", href: "/activities?type=WhatsApp", active: pathname === "/activities" && (typeParam === "WhatsApp" || typeParam === "whatsapp"), icon: <MessageSquare size={16} /> },
    { label: "Notes", href: "/activities?type=Note", active: pathname === "/activities" && (typeParam === "Note" || typeParam === "notes"), icon: <StickyNote size={16} /> },
    { label: "Timeline", href: "/timeline", active: pathname === "/timeline", icon: <Clock size={16} /> },
  ];

  return (
    <PageShell
      title="Activities Overview"
      subtitle="Calls, meetings, and notes across your pipeline."
      action={
        <Link href="/activities/new" className="btn-primary text-xs flex items-center gap-2">
          <Plus size={14} /> Log Activity
        </Link>
      }
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                tab.active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Filters */}
        <div className="crm-card bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Filter size={14} /> Filter:</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
              <option value="">All Statuses</option>
              {activeTab === "calls" && <><option value="Completed">Completed</option><option value="NoAnswer">No Answer</option><option value="Scheduled">Scheduled</option></>}
              {activeTab === "meetings" && <><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></>}
              {activeTab === "notes" && <><option value="LEAD">Lead</option><option value="CUSTOMER">Customer</option><option value="DEAL">Deal</option></>}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  {activeTab === "calls" && <><th className="crm-th">Date</th><th className="crm-th">Linked To</th><th className="crm-th">Direction</th><th className="crm-th">Duration</th><th className="crm-th">Status</th><th className="crm-th">Notes</th><th className="crm-th text-right">Actions</th></>}
                  {activeTab === "meetings" && <><th className="crm-th">Date</th><th className="crm-th">Linked To</th><th className="crm-th">Mode</th><th className="crm-th">Location</th><th className="crm-th">Status</th><th className="crm-th">Agenda</th><th className="crm-th text-right">Actions</th></>}
                  {activeTab === "notes" && <><th className="crm-th">Date</th><th className="crm-th">Type</th><th className="crm-th">Entity</th><th className="crm-th">Content</th><th className="crm-th">Created By</th><th className="crm-th text-right">Actions</th></>}
                  {activeTab === "emails" && <><th className="crm-th">Date</th><th className="crm-th">Linked To</th><th className="crm-th">Direction</th><th className="crm-th">Status</th><th className="crm-th">Content</th><th className="crm-th text-right">Actions</th></>}
                  {activeTab === "whatsapp" && <><th className="crm-th">Date</th><th className="crm-th">Linked To</th><th className="crm-th">Direction</th><th className="crm-th">Status</th><th className="crm-th">Content</th><th className="crm-th text-right">Actions</th></>}
                </tr>
              </thead>
              <tbody>
                {loading ? null : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="crm-td text-center py-16">
                      <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3"><MessageSquare size={20} className="text-muted-foreground" /></div>
                      <p className="text-sm font-semibold text-foreground">No {activeTab} found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="crm-tr table-row-clickable"
                      onClick={() => router.push(`/activities/${item.id}`)}
                    >
                      {activeTab === "calls" && (
                        <>
                          <td className="crm-td text-xs">{formatDate(item.sentAt)}</td>
                          <td className="crm-td text-xs">
                            <span className="row-primary-link">{item.customer?.name || item.lead?.name || "—"}</span>
                            {item.followUpId && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">FU</span>}
                          </td>
                          <td className="crm-td"><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.direction}</span></td>
                          <td className="crm-td text-xs">{item.duration ? `${item.duration} min` : "—"}</td>
                          <td className="crm-td"><StatusBadge status={item.status} size="sm" /></td>
                          <td className="crm-td text-xs max-w-xs truncate">{item.content}</td>
                        </>
                      )}
                      {activeTab === "meetings" && (
                        <>
                          <td className="crm-td text-xs">{item.meetingDate ? formatDate(item.meetingDate) : formatDate(item.sentAt)}</td>
                          <td className="crm-td text-xs">
                            <span className="row-primary-link">{item.customer?.name || item.lead?.name || "—"}</span>
                            {item.followUpId && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">FU</span>}
                          </td>
                          <td className="crm-td"><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.mode || "—"}</span></td>
                          <td className="crm-td text-xs">{item.location || "—"}</td>
                          <td className="crm-td"><StatusBadge status={item.status} size="sm" /></td>
                          <td className="crm-td text-xs max-w-xs truncate">{item.agenda || item.content}</td>
                        </>
                      )}
                      {activeTab === "notes" && (
                        <>
                          <td className="crm-td text-xs">{formatDate(item.createdAt)}</td>
                          <td className="crm-td"><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.entityType}</span></td>
                          <td className="crm-td text-xs font-mono text-muted-foreground">{(item.entityId || "").slice(0, 8)}...</td>
                          <td className="crm-td text-xs max-w-sm truncate">{item.content}</td>
                          <td className="crm-td text-xs">{item.createdBy?.name || "—"}</td>
                        </>
                      )}
                      {activeTab === "emails" && (
                        <>
                          <td className="crm-td text-xs">{formatDate(item.sentAt)}</td>
                          <td className="crm-td text-xs"><span className="row-primary-link">{item.customer?.name || item.lead?.name || "—"}</span></td>
                          <td className="crm-td"><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.direction}</span></td>
                          <td className="crm-td"><StatusBadge status={item.status} size="sm" /></td>
                          <td className="crm-td text-xs max-w-xs truncate">{item.content}</td>
                        </>
                      )}
                      {activeTab === "whatsapp" && (
                        <>
                          <td className="crm-td text-xs">{formatDate(item.sentAt)}</td>
                          <td className="crm-td text-xs"><span className="row-primary-link">{item.customer?.name || item.lead?.name || "—"}</span></td>
                          <td className="crm-td"><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.direction}</span></td>
                          <td className="crm-td"><StatusBadge status={item.status} size="sm" /></td>
                          <td className="crm-td text-xs max-w-xs truncate">{item.content}</td>
                        </>
                      )}
                      <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => confirmDelete(item)} className="row-action-btn row-action-btn-danger" title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredItems.length > itemsPerPage && (
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
