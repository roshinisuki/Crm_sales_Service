"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProposalsAction, deleteProposalAction } from "@/app/actions/proposals";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatDate, cn } from "@/lib/ui-utils";
import { Plus, Search, Eye, Trash2, FileText } from "lucide-react";

const formatStatus = (status: string) => status.replace(/([A-Z])/g, ' $1').trim();

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Sent: "bg-blue-100 text-blue-700",
  CustomerReviewing: "bg-indigo-100 text-indigo-700",
  RevisionRequested: "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Expired: "bg-gray-100 text-gray-500",
};

const statusOptions = ["Draft", "Sent", "CustomerReviewing", "RevisionRequested", "Accepted", "Rejected", "Expired"];

export default function ProposalsListPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProposalsAction({ search: search || undefined, status: statusFilter || undefined });
      if (res.success) setProposals(res.data);
    } catch {
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id: string, title: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Proposal",
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      action: async () => {
        const res = await deleteProposalAction(id);
        if (res.success) {
          toast.success("Proposal deleted");
          load();
        } else {
          toast.error(res.message || "Failed to delete");
        }
      },
    });
  };

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500 mt-1">Manage customer proposals and track their status</p>
        </div>
        <button
          onClick={() => router.push("/proposals/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
        >
          <Plus size={18} /> New Proposal
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No proposals found. Create your first proposal to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Proposal #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Valid Until</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.proposalNumber}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.customer?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{formatCurrency(p.value)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-xs font-medium", statusColors[p.status] || "bg-gray-100 text-gray-600")}>
                      {formatStatus(p.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(p.validUntil)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => router.push(`/proposals/${p.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleDelete(p.id, p.title)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageContainer>
  );
}