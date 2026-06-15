"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProposalsAction, createProposalAction, deleteProposalAction } from "@/app/actions/proposals";
import { getCustomersAction } from "@/app/actions/customers";
import { getDealsAction } from "@/app/actions/deals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { formatDate, formatCurrency, cn } from "@/lib/ui-utils";
import { Plus, Search, Eye, Trash2, FileText, FileCheck, DollarSign, ExternalLink } from "lucide-react";

const STAGES = ["Draft", "Sent", "CustomerReviewing", "RevisionRequested", "Accepted", "Rejected", "Expired"];

const formatStatus = (status: string) => {
  return status.replace(/([A-Z])/g, ' $1').trim();
};

export default function ProposalsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();

  const [proposals, setProposals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", customerId: "", dealId: "", value: "", validUntil: "", proposalPdfUrl: ""
  });

  const statusParam = searchParams ? searchParams.get("status") : null;

  useEffect(() => {
    setStatusFilter(statusParam || "");
  }, [statusParam]);

  const loadData = async () => {
    setLoading(true);
    const [propRes, custRes, dealRes] = await Promise.all([
      getProposalsAction(),
      getCustomersAction(),
      getDealsAction()
    ]);
    if (propRes.success && propRes.data) setProposals(propRes.data);
    else toast.error("Failed to load proposals.");
    
    if (custRes.success && custRes.data) setCustomers(custRes.data);
    if (dealRes.success && dealRes.data) setDeals(dealRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpiActive = proposals.filter(p => !["Accepted", "Rejected", "Expired"].includes(p.status)).length;
  const kpiValueSent = proposals.filter(p => ["Sent", "CustomerReviewing", "RevisionRequested"].includes(p.status)).reduce((sum, p) => sum + p.value, 0);
  const kpiAccepted = proposals.filter(p => p.status === "Accepted").length;
  const acceptedRate = proposals.length > 0 ? Math.round((kpiAccepted / proposals.length) * 100) : 0;

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return proposals.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.title.toLowerCase().includes(q) || p.proposalNumber.toLowerCase().includes(q) || p.customer?.name?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [proposals, search, statusFilter]);

  const { page, setPage, totalPages, paged, total } = usePagination(filtered, 10);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ title: "", description: "", customerId: "", dealId: "", value: "", validUntil: "", proposalPdfUrl: "" });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.customerId || !form.validUntil || !form.value) {
      toast.error("Fill in all required fields."); return;
    }
    const val = parseFloat(form.value);
    if (isNaN(val) || val < 0) { toast.error("Value must be a valid number."); return; }
    
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      customerId: form.customerId,
      dealId: form.dealId || undefined,
      value: val,
      validUntil: new Date(form.validUntil).toISOString(),
      proposalPdfUrl: form.proposalPdfUrl || undefined,
    };
    
    const res = await createProposalAction(payload);
    if (res.success) {
      toast.success("Proposal created.");
      setIsModalOpen(false);
      loadData();
    } else {
      toast.error(res.message || "Failed to create proposal.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to delete proposal ${number}?`)) return;
    const res = await deleteProposalAction(id);
    if (res.success) {
      toast.success("Proposal deleted.");
      loadData();
    } else {
      toast.error(res.message || "Failed to delete proposal.");
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case "Draft": return "bg-slate-100 text-slate-700 border-slate-200";
      case "Sent": return "bg-blue-50 text-blue-700 border-blue-200";
      case "CustomerReviewing": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "RevisionRequested": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Accepted": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Rejected": return "bg-rose-50 text-rose-700 border-rose-200";
      case "Expired": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <PageShell
      title="Proposals"
      subtitle="Manage quotes, contracts, and proposals sent to customers."
      action={
        currentUser?.role !== "Customer" && (
          <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-2">
            <Plus size={14} /> Create Proposal
          </button>
        )
      }
    >
      <PageContainer className="space-y-4 p-0">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard label="Active Proposals" value={kpiActive.toString()} icon={<FileText size={20} />} variant="dark" />
          <SummaryCard label="Pipeline Value (Sent)" value={formatCurrency(kpiValueSent)} icon={<DollarSign size={20} />} variant="orange" />
          <SummaryCard label="Acceptance Rate" value={`${acceptedRate}%`} icon={<FileCheck size={20} />} variant="light" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input placeholder="Search proposals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-48">
              <option value="">All Statuses</option>
              {STAGES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Proposal ID</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3">Valid Until</th>
                  {currentUser?.role !== "Customer" && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="crm-td text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-slate-400"><div className="spinner-brand" /><span className="text-xs font-medium">Loading...</span></div>
                  </td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} className="crm-td text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><FileText size={28} className="text-slate-300" /></div>
                      <p className="text-sm font-semibold text-slate-500">No proposals found</p>
                      {currentUser?.role !== "Customer" && <button onClick={openCreate} className="btn-primary text-xs mt-1"><Plus size={13} /> Create Proposal</button>}
                    </div>
                  </td></tr>
                ) : paged.map((p: any) => (
                  <tr key={p.id} className="crm-tr cursor-pointer" onClick={() => router.push(`/proposals/${p.id}`)}>
                    <td className="crm-td">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{p.proposalNumber}</span>
                    </td>
                    <td className="crm-td font-semibold text-slate-800">{p.title}</td>
                    <td className="crm-td">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{p.customer?.name}</span>
                        {p.deal?.dealName && <span className="text-[10px] text-slate-400 font-medium line-clamp-1">Deal: {p.deal.dealName}</span>}
                      </div>
                    </td>
                    <td className="crm-td text-right">
                      <span className="font-bold text-[var(--primary)]">{formatCurrency(p.value)}</span>
                    </td>
                    <td className="crm-td text-center">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide", getStatusStyle(p.status))}>
                        {formatStatus(p.status)}
                      </span>
                    </td>
                    <td className="crm-td text-slate-500 text-xs">
                      {formatDate(p.validUntil)}
                    </td>
                    {currentUser?.role !== "Customer" && (
                      <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {p.proposalPdfUrl && (
                            <a href={p.proposalPdfUrl} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button onClick={() => router.push(`/proposals/${p.id}`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <Eye size={14} />
                          </button>
                          {["Admin", "SalesManager", "SuperAdmin"].includes(currentUser?.role || "") && (
                            <button onClick={() => handleDelete(p.id, p.proposalNumber)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
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
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
              <p className="text-xs text-slate-400 font-medium">
                Showing {Math.min((page - 1) * 10 + 1, total)}–{Math.min(page * 10, total)} of {total} proposals
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </PageContainer>

      {/* ── Create Proposal Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Proposal"
        subtitle="Draft a new proposal for a customer."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="create-proposal-form" disabled={saving} className="btn-primary text-sm">
              {saving ? <><span className="spinner-brand" /> Saving...</> : "Create Draft"}
            </button>
          </>
        }
      >
        <form id="create-proposal-form" onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Proposal Title" required className="md:col-span-2">
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Annual Cloud Subscription - 2026" required />
            </FormField>
            
            <FormField label="Customer" required>
              <Select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))} required>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
              </Select>
            </FormField>

            <FormField label="Associated Deal (Optional)">
              <Select value={form.dealId} onChange={e => setForm(p => ({ ...p, dealId: e.target.value }))}>
                <option value="">None</option>
                {deals.filter(d => d.customerId === form.customerId).map(d => (
                  <option key={d.id} value={d.id}>{d.dealName}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Proposal Value" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="0" className="pl-7" required
                />
              </div>
            </FormField>

            <FormField label="Valid Until" required>
              <Input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} required />
            </FormField>

            <FormField label="PDF Link (Optional)" className="md:col-span-2">
              <Input type="url" value={form.proposalPdfUrl} onChange={e => setForm(p => ({ ...p, proposalPdfUrl: e.target.value }))} placeholder="https://..." />
            </FormField>

            <FormField label="Description / Terms" className="md:col-span-2">
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief summary or key terms..." rows={3} />
            </FormField>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
