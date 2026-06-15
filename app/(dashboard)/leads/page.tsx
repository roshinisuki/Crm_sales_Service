"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLeadsAction, createLeadAction, updateLeadAction, deleteLeadAction } from "@/app/actions/leads";
import { getUsersAction } from "@/app/actions/users";
import { Lead, User } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { getInitials, getAvatarColor, formatDate, cn } from "@/lib/ui-utils";
import {
  Plus, Search, Download, Eye, Pencil, Trash2, Filter,
  Users, Phone, CheckCircle, XCircle, ShieldAlert,
} from "lucide-react";

const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const LEAD_SOURCES  = ["Website", "Facebook", "Instagram", "LinkedIn", "Referral", "WalkIn", "ColdCall", "Partner"];
const SLA_STATUSES  = ["Pending", "Warning", "Breached", "Met"];

const SLA_DOT: Record<string, string> = {
  Pending: "bg-amber-400",
  Warning: "bg-orange-500",
  Breached: "bg-red-600",
  Met: "bg-green-500",
};

const emptyForm = {
  id: "", leadCode: "", name: "", email: "",
  phone: "", city: "", status: "New" as any,
  assignedUserId: "", leadSource: "",
};

export default function LeadsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const toast    = useToast();
  const searchParams = useSearchParams();

  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [executives, setExecutives] = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [slaFilter,   setSlaFilter]   = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData,    setFormData]    = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState("");

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });

  const statusParam = searchParams ? searchParams.get("status") : null;
  const slaParam = searchParams ? searchParams.get("slaStatus") : null;
  const followUpParam = searchParams ? searchParams.get("followUp") : null;

  useEffect(() => {
    setStatusFilter(statusParam || "");
    setSlaFilter(slaParam || "");
  }, [statusParam, slaParam]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (slaFilter) params.slaStatus = slaFilter;
      const res = await getLeadsAction(params);
      if (res.success && res.data) setLeads(res.data as any);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutives = async () => {
    if (!user || (user.role !== "Admin" && user.role !== "SalesManager")) return;
    const res = await getUsersAction();
    if (res.success && res.data) {
      setExecutives((res.data as any[]).filter(u => u.role === "SalesExecutive"));
    }
  };

  useEffect(() => { loadLeads(); }, [search, statusFilter, slaFilter]);
  useEffect(() => { loadExecutives(); }, [user]);

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (dateFrom && l.createdAt && new Date(l.createdAt) < new Date(dateFrom)) return false;
      if (dateTo   && l.createdAt && new Date(l.createdAt) > new Date(dateTo + "T23:59:59")) return false;
      
      if (followUpParam === "due") {
        const hasDueFollowUp = (l as any).followUps?.some((f: any) => {
          const isPending = f.status === "Pending";
          const isOverdue = new Date(f.nextMeetingDate) <= new Date();
          return isPending && isOverdue;
        });
        if (!hasDueFollowUp) return false;
      }
      return true;
    });
  }, [leads, dateFrom, dateTo, followUpParam]);

  const { page, setPage, totalPages, paged, total } = usePagination(filtered, 10);

  // ── KPI counts ────────────────────────────────────────────────────────────

  const kpiTotal     = leads.length;
  const kpiContacted = leads.filter(l => l.status === "Contacted").length;
  const kpiQualified = leads.filter(l => l.status === "Qualified").length;
  const kpiBreached  = leads.filter(l => (l as any).slaStatus === "Breached").length;

  // ── Form handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setFormData(emptyForm);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (l: any) => {
    setFormData({
      id: l.id, leadCode: l.leadCode, name: l.name,
      email: l.email || "", phone: l.phone || "", city: l.city || "",
      status: l.status, assignedUserId: l.assignedUserId || "", leadSource: l.leadSource || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Lead Name is required"); return; }
    setFormLoading(true);
    setFormError("");

    let res;
    if (formData.id) {
      res = await updateLeadAction(formData.id, {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        city: formData.city || undefined,
        status: formData.status,
        assignedUserId: formData.assignedUserId || undefined,
        leadSource: formData.leadSource as any,
      });
    } else {
      res = await createLeadAction({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        city: formData.city || undefined,
        assignedUserId: formData.assignedUserId || undefined,
        leadSource: formData.leadSource as any,
      });
    }

    if (res.success) {
      setIsModalOpen(false);
      toast.success(formData.id ? "Lead updated successfully." : "Lead created successfully.");
      loadLeads();
    } else {
      setFormError(res.message || "Operation failed");
    }
    setFormLoading(false);
  };

  const handleDelete = (l: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Lead",
      message: `Delete "${l.name}"? This will erase all their visits, followups, and communications. This cannot be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteLeadAction(l.id);
        setIsDeleting(false);
        if (res.success) { toast.success("Lead deleted."); loadLeads(); }
        else toast.error(res.message || "Delete failed.");
      },
    });
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("No data to export."); return; }
    const headers = ["S.No", "Lead Name", "Phone", "Email", "City", "Status", "Lead Source", "Created On"];
    const rows = filtered.map((l, i) => [
      i + 1, l.name, l.phone || "", l.email || "", l.city || "",
      l.status, (l as any).leadSource || "", formatDate(l.createdAt),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `Leads_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Leads"
      subtitle="Manage and track your sales pipeline"
      action={
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== "Customer" && (
            <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-2">
              <Plus size={14} /> Add Lead
            </button>
          )}
        </div>
      }
    >
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Leads"
          value={kpiTotal}
          subtitle="All pipeline leads"
          icon={<Users size={20} />}
          variant="orange"
        />
        <SummaryCard
          label="Contacted"
          value={kpiContacted}
          subtitle="Reached out"
          icon={<Phone size={20} />}
          variant="dark"
        />
        <SummaryCard
          label="Qualified"
          value={kpiQualified}
          subtitle="Ready to convert"
          icon={<CheckCircle size={20} />}
          variant="light"
        />
        <SummaryCard
          label="SLA Breached"
          value={kpiBreached}
          subtitle="Needs immediate action"
          icon={<ShieldAlert size={20} />}
          variant="orange"
        />
      </div>

      {/* ── Table Card ── */}
      <div className="crm-card overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-theme flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-theme-primary">Leads List</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 pr-3 py-2 text-sm rounded-xl bg-surface-2 border border-theme text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all w-52"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
            >
              <option value="">All Status</option>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* SLA filter */}
            <select
              value={slaFilter}
              onChange={e => { setSlaFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
            >
              <option value="">All SLA</option>
              {SLA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Date from */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] [color-scheme:dark]"
            />
            <span className="text-slate-400 text-xs font-medium hidden sm:block">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl bg-surface-2 border border-theme text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] [color-scheme:dark]"
            />

            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="px-2.5 py-2 text-xs font-medium text-theme-secondary hover:text-theme-primary bg-surface-2 border border-theme hover:bg-surface-offset rounded-lg transition-colors cursor-pointer"
              >
                Clear dates
              </button>
            )}

            <button className="w-9 h-9 rounded-xl bg-surface-2 border border-theme flex items-center justify-center text-theme-secondary hover:bg-surface-offset transition-colors cursor-pointer">
              <Filter size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">S.No</th>
                <th className="crm-th">Lead Name</th>
                <th className="crm-th">Company Name</th>
                <th className="crm-th">Phone No</th>
                <th className="crm-th">Email ID</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">SLA</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th">Created On</th>
                <th className="crm-th text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="crm-td text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="spinner-brand" />
                      <span className="text-xs font-medium">Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="crm-td text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Users size={28} className="text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">No leads found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or add a new lead</p>
                      </div>
                      {user?.role !== "Customer" && (
                        <button onClick={openCreate} className="btn-primary text-xs mt-1">
                          <Plus size={13} /> Add First Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((l: any, idx) => (
                  <tr
                    key={l.id}
                    className="crm-tr cursor-pointer"
                    onClick={() => router.push(`/leads/${l.id}`)}
                  >
                    <td className="crm-td text-theme-muted text-xs font-semibold w-12">
                      {(page - 1) * 10 + idx + 1}
                    </td>
                    <td className="crm-td">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", getAvatarColor(l.name))}>
                          {getInitials(l.name)}
                        </div>
                        <span className="font-semibold text-theme-primary text-sm leading-tight">{l.name}</span>
                      </div>
                    </td>
                    <td className="crm-td text-theme-secondary text-sm">{l.city || "—"}</td>
                    <td className="crm-td text-theme-secondary text-sm font-mono text-xs">{l.phone || "—"}</td>
                    <td className="crm-td text-theme-muted text-xs">{l.email || "—"}</td>
                    <td className="crm-td">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="crm-td">
                      {(l as any).slaStatus ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", SLA_DOT[(l as any).slaStatus] || "bg-slate-300")} />
                          <span className={cn(
                            "text-xs font-semibold",
                            (l as any).slaStatus === "Breached" ? "text-red-500" :
                            (l as any).slaStatus === "Warning"  ? "text-orange-500" :
                            (l as any).slaStatus === "Met"      ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {(l as any).slaStatus}
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="crm-td text-theme-secondary text-sm">{l.assignedUser?.name || "Unassigned"}</td>
                    <td className="crm-td text-theme-muted text-xs whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => router.push(`/leads/${l.id}`)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 transition-colors cursor-pointer"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(l)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        {(user?.role === "Admin" || user?.role === "SalesManager") && (
                          <button
                            onClick={() => handleDelete(l)}
                            disabled={isDeleting}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-secondary hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-2 transition-colors disabled:opacity-40 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {total > 0 && (
          <div className="px-5 py-3 border-t border-theme flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Showing {Math.min((page - 1) * 10 + 1, total)}–{Math.min(page * 10, total)} of {total} leads
            </p>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? "Edit Lead" : "Add New Lead"}
        subtitle="Fill in the lead details below"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => { setFormData(emptyForm); setFormError(""); }} className="btn-ghost text-sm">
              Clear
            </button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              type="submit"
              form="lead-form"
              disabled={formLoading}
              className="btn-primary text-sm"
            >
              {formLoading ? (
                <><span className="spinner-brand" /> Saving...</>
              ) : (
                formData.id ? "Update Lead" : "Save Lead"
              )}
            </button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 text-center">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Lead Name" required>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Enter lead name"
                required
              />
            </FormField>

            <FormField label="Phone No" required>
              <Input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </FormField>

            <FormField label="Email ID" required>
              <Input
                type="email"
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </FormField>

            <FormField label="Company Name">
              <Input
                value={formData.city}
                onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                placeholder="Company / City"
              />
            </FormField>

            <FormField label="Lead Source">
              <Select
                value={formData.leadSource}
                onChange={e => setFormData(p => ({ ...p, leadSource: e.target.value }))}
              >
                <option value="">Select source...</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            <FormField label="Status">
              <Select
                value={formData.status}
                onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
              >
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            {(user?.role === "Admin" || user?.role === "SalesManager") && (
              <FormField label="Assigned To">
                <Select
                  value={formData.assignedUserId}
                  onChange={e => setFormData(p => ({ ...p, assignedUserId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </Select>
              </FormField>
            )}
          </div>

          <FormField label="Remarks">
            <Textarea
              placeholder="Any additional notes..."
              rows={3}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))}
        isDestructive
      />
    </PageShell>
  );
}
