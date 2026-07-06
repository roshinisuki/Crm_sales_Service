"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getDealsAction, createDealAction, updateDealAction, deleteDealAction, updateDealStatusAction } from "@/app/actions/deals";
import { getCustomersAction } from "@/app/actions/customers";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { DEALS_STATUS } from "@/lib/module-status-config";
import { getInitials, getAvatarColor, formatDate, cn } from "@/lib/ui-utils";
import { Plus, Search, Download, Eye, Pencil, Trash2, Briefcase, TrendingUp, CheckCircle, XCircle, PauseCircle } from "lucide-react";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
const STAGES = ["Active", "OnHold", "Won", "Lost"];
const emptyForm = {
  id: "", dealName: "", customerId: "", dealValue: "",
  expectedCloseDate: "", assignedUserId: "", notes: "", status: "Active",
  originalStatus: "Active",
};

function DealsPageContent() {
  const router = useRouter();
  const toast  = useToast();
  const { user: currentUser } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();
  const currencySymbol = CURRENCY_SYMBOLS[preferredCurrency as keyof typeof CURRENCY_SYMBOLS] || "₹";

  const [deals,     setDeals]     = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [execs,     setExecs]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const { startLoading, stopLoading } = useGlobalLoading();

  const [search,      setSearch]      = useState("");
  const statusFilter = useStatusFromUrl("status");

  const [form, setForm] = useState(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────

  const loadDeals = async () => {
    setLoading(true);
    startLoading("Loading deals...");
    const res = await getDealsAction();
    if (res.success && res.data) setDeals(res.data);
    else toast.error("Failed to load deals.");
    setLoading(false);
    stopLoading();
  };

  const loadDeps = async () => {
    const [custRes, execRes] = await Promise.all([getCustomersAction(), getUsersAction()]);
    if (custRes.success && custRes.data) setCustomers(custRes.data);
    if (execRes.success && execRes.data) {
      setExecs((execRes.data as any[]).filter(u => u.role === "SalesExecutive" || u.role === "SalesManager"));
    }
  };

  useEffect(() => { loadDeals(); loadDeps(); }, []);

  // ── KPI ───────────────────────────────────────────────────────────────────

  const kpiTotal  = deals.length;
  const kpiOpen   = deals.filter(d => !["Won", "Lost", "OnHold"].includes(d.status)).length;
  const kpiOnHold = deals.filter(d => d.status === "OnHold").length;
  const kpiWon    = deals.filter(d => d.status === "Won").length;
  const kpiLost   = deals.filter(d => d.status === "Lost").length;
  const kpiValue  = deals.filter(d => d.status === "Won").reduce((s, d) => s + d.dealValue, 0);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return deals.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.dealName.toLowerCase().includes(q) || d.customer?.name?.toLowerCase().includes(q);
      let matchStatus = !statusFilter || d.status === statusFilter;
      if (statusFilter === "risk") {
        const isOpen = !["Won", "Lost", "OnHold"].includes(d.status);
        const isOverdue = d.expectedCloseDate && new Date(d.expectedCloseDate) < new Date();
        const isStale = new Date(d.updatedAt) < sevenDaysAgo;
        matchStatus = isOpen && (isOverdue || isStale);
      }
      return matchSearch && matchStatus;
    });
  }, [deals, search, statusFilter]);

  const { page, setPage, totalPages, paged, total } = usePagination(filtered, 10);

  // ── Modal ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ ...emptyForm, assignedUserId: currentUser?.id || "" });
    setIsModalOpen(true);
  };

  const openEdit = (d: any) => {
    setForm({
      id: d.id, dealName: d.dealName, customerId: d.customerId,
      dealValue: String(d.dealValue), expectedCloseDate: d.expectedCloseDate?.substring(0, 10) || "",
      assignedUserId: d.assignedUserId || "", notes: d.notes || "", status: d.status,
      originalStatus: d.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dealName || !form.customerId || !form.expectedCloseDate || !form.dealValue) {
      toast.error("Fill in all required fields."); return;
    }
    const val = parseFloat(form.dealValue);
    if (isNaN(val) || val <= 0) { toast.error("Deal value must be positive."); return; }
    setSaving(true);
    const payload = {
      dealName: form.dealName, customerId: form.customerId, dealValue: val,
      expectedCloseDate: new Date(form.expectedCloseDate).toISOString(),
      assignedUserId: form.assignedUserId || undefined,
      notes: form.notes, status: form.status,
    };
    const res = form.id
      ? await updateDealAction({ id: form.id, ...payload })
      : await createDealAction(payload);
    if (res.success) {
      // Stage changes are ignored by updateDealAction by design — route them
      // through updateDealStatusAction so the edit-modal Stage select is not a no-op.
      if (form.id && form.status !== form.originalStatus) {
        const statusRes = await updateDealStatusAction(form.id, form.status);
        if (!statusRes.success) {
          toast.error(statusRes.message || "Deal saved, but stage change failed.");
          setIsModalOpen(false); loadDeals(); setSaving(false); return;
        }
      }
      toast.success(form.id ? "Deal updated." : "Deal created."); setIsModalOpen(false); loadDeals();
    } else {
      toast.error(res.message || "Failed to save deal.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete deal "${name}"?`)) return;
    const res = await deleteDealAction(id);
    if (res.success) { toast.success("Deal deleted."); loadDeals(); }
    else toast.error(res.message || "Failed.");
  };

  const handleToggleHold = async (d: any) => {
    const nextStatus = d.status === "OnHold" ? "Active" : "OnHold";
    const res = await updateDealStatusAction(d.id, nextStatus);
    if (res.success) {
      toast.success(nextStatus === "OnHold" ? "Deal put on hold." : "Deal resumed.");
      loadDeals();
    } else {
      toast.error(res.message || "Failed to update status.");
    }
  };

  const exportCSV = () => {
    const headers = ["Deal Name", "Customer", "Value", "Stage", "Assigned To", "Expected Close", "Status"];
    const rows = filtered.map(d => [
      d.dealName, d.customer?.name || "", d.dealValue,
      d.status, d.assignedUser?.name || "—",
      formatDate(d.expectedCloseDate), d.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `Deals_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exported.");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Deals"
      subtitle="Track and manage your sales deals"
      action={
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          {currentUser?.role !== "Customer" && (
            <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-2">
              <Plus size={14} /> Create Deal
            </button>
          )}
        </div>
      }
    >
      <PageContainer className="space-y-4 p-0">
      {/* Status Filter Bar */}
      <StatusFilterBar
        statuses={DEALS_STATUS}
        paramKey="status"
        basePath="/deals"
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard label="Total Deals" value={kpiTotal.toString()} icon={<Briefcase size={20} />} variant="orange" />
        <SummaryCard label="Active" value={kpiOpen.toString()} icon={<TrendingUp size={20} />} variant="dark" />
        <SummaryCard label="On Hold" value={kpiOnHold.toString()} icon={<PauseCircle size={20} />} variant="amber" />
        <SummaryCard label="Won" value={kpiWon.toString()} icon={<CheckCircle size={20} />} variant="light" />
        <SummaryCard label="Total Value" value={formatCurrency(kpiValue)} icon={<TrendingUp size={20} />} variant="light" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Deal Name</th>
                <th className="crm-th">Customer</th>
                <th className="crm-th text-right">Value</th>
                <th className="crm-th text-center">Stage</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th">Expected Close</th>
                <th className="crm-th">Status</th>
                {currentUser?.role !== "Customer" && <th className="crm-th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex justify-center">
                      <CRMSpinner size={36} label="Loading deals..." />
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className="crm-td text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><Briefcase size={28} className="text-slate-300" /></div>
                    <p className="text-sm font-semibold text-slate-500">No deals found</p>
                    {currentUser?.role !== "Customer" && <button onClick={openCreate} className="btn-primary text-xs mt-1"><Plus size={13} /> Create Deal</button>}
                  </div>
                </td></tr>
              ) : paged.map((d: any) => (
                <tr
                  key={d.id}
                  className="crm-tr cursor-pointer"
                  onClick={() => router.push(`/deals/${d.id}?status=${d.status}`)}
                >
                  <td className="crm-td">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", getAvatarColor(d.dealName))}>
                        {getInitials(d.dealName)}
                      </div>
                      <span className="font-semibold text-slate-800 text-sm">{d.dealName}</span>
                    </div>
                  </td>
                  <td className="crm-td">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{d.customer?.name}</p>
                      <p className="text-[10px] text-slate-400">{d.customer?.customerCode}</p>
                    </div>
                  </td>
                  <td className="crm-td">
                    <span className="font-bold text-[var(--primary)]">{formatCurrency(d.dealValue)}</span>
                  </td>
                  <td className="crm-td"><StatusBadge status={d.status} /></td>
                  <td className="crm-td text-slate-500 text-sm">{d.assignedUser?.name || "—"}</td>
                  <td className="crm-td text-slate-500 text-xs whitespace-nowrap">{formatDate(d.expectedCloseDate)}</td>
                  <td className="crm-td"><StatusBadge status={d.status} /></td>
                  {currentUser?.role !== "Customer" && (
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => router.push(`/deals/${d.id}`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Eye size={14} /></button>
                        <button onClick={() => openEdit(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={13} /></button>
                        {["Admin", "SalesManager"].includes(currentUser?.role || "") && !["Won", "Lost"].includes(d.status) && (
                          <button
                            onClick={() => handleToggleHold(d)}
                            title={d.status === "OnHold" ? "Resume Deal" : "Put On Hold"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${d.status === "OnHold" ? "text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                          >
                            <PauseCircle size={14} />
                          </button>
                        )}
                        {["Admin", "SalesManager"].includes(currentUser?.role || "") && (
                          <button onClick={() => handleDelete(d.id, d.dealName)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Showing {Math.min((page - 1) * 10 + 1, total)}–{Math.min(page * 10, total)} of {total} deals
            </p>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
      </PageContainer>

      {/* ── Create / Edit Deal Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={form.id ? "Edit Deal" : "Create Deal"}
        subtitle="Fill in the deal details"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="deal-form" disabled={saving} className="btn-primary text-sm">
              {saving ? <><span className="spinner-brand" /> Saving...</> : form.id ? "Update" : "Save Deal"}
            </button>
          </>
        }
      >
        <form id="deal-form" onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Deal Name" required>
              <Input value={form.dealName} onChange={e => setForm(p => ({ ...p, dealName: e.target.value }))} placeholder="e.g. Annual Subscription" required />
            </FormField>
            <FormField label="Company Name" required>
              <Select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))} disabled={!!form.id} required>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
              </Select>
            </FormField>
            <FormField label="Deal Value" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{currencySymbol}</span>
                <Input
                  type="number" step="0.01" min="1"
                  value={form.dealValue} onChange={e => setForm(p => ({ ...p, dealValue: e.target.value }))}
                  placeholder="0" className="pl-7" required
                />
              </div>
            </FormField>
            <FormField label="Stage" required>
              <Select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STAGES.map(s => <option key={s} value={s}>{s === "OnHold" ? "On Hold" : s}</option>)}
              </Select>
            </FormField>
            <FormField label="Assigned To" required>
              <Select value={form.assignedUserId} onChange={e => setForm(p => ({ ...p, assignedUserId: e.target.value }))}>
                <option value="">Unassigned</option>
                {execs.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Expected Close Date" required>
              <Input type="date" value={form.expectedCloseDate} onChange={e => setForm(p => ({ ...p, expectedCloseDate: e.target.value }))} required />
            </FormField>
            <FormField label="Remarks" className="md:col-span-2">
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes about this deal..." rows={3} />
            </FormField>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <DealsPageContent />
    </Suspense>
  );
}
