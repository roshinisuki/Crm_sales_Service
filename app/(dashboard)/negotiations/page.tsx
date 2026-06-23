"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
};

const statusColors: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  PriceRevision: "bg-amber-100 text-amber-700",
  CommercialDiscussion: "bg-purple-100 text-purple-700",
  PendingApproval: "bg-orange-100 text-orange-700",
  Won: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
};

const statusOptions = ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval", "Won", "Lost"];

export default function NegotiationListPage() {
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const statusFilter = searchParams.get("status") || "";

  const loadNegotiations = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      let allData: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await fetch(`/api/negotiations?${new URLSearchParams({ ...params, page: String(page) })}`);
        const data = await res.json();
        if (data.success) {
          allData = allData.concat(data.data || []);
          totalPages = data.totalPages || 1;
        } else break;
        page++;
      }
      setNegotiations(allData);
    } catch {
      toast.error("Failed to load negotiations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNegotiations();
  }, [statusFilter]);

  const filtered = negotiations.filter((n: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.negotiationCode?.toLowerCase().includes(q) || n.customer?.name?.toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Negotiation",
      message: "Are you sure you want to delete this negotiation?",
      action: async () => {
        try {
          const res = await fetch(`/api/negotiations/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Negotiation deleted");
            loadNegotiations();
          } else toast.error(data.message || "Failed to delete");
        } catch {
          toast.error("Failed to delete");
        }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Negotiation Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track price negotiations, revisions, and approvals</p>
        </div>
        <button
          onClick={() => router.push("/negotiations/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
        >
          <Ico d={icons.plus} size={16} /> New Negotiation
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => router.push("/negotiations")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!statusFilter ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
        >
          All
        </button>
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => router.push(`/negotiations?status=${s}`)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${statusFilter === s ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Ico d={icons.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by negotiation code or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Initial Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Revised</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Revisions</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned To</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No negotiations found</td></tr>
            ) : (
              filtered.map((n: any) => (
                <tr key={n.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{n.negotiationCode}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{n.customer?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{n.initialAmount ? formatCurrency(n.initialAmount) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{n.revisedAmount ? formatCurrency(n.revisedAmount) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[n.status] || "bg-gray-100 text-gray-600"}`}>{n.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{n._count?.revisions || 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{n.assignedUser?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => router.push(`/negotiations/${n.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer" title="View">
                        <Ico d={icons.eye} size={15} />
                      </button>
                      <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Delete">
                        <Ico d={icons.x} size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
      />
    </PageContainer>
  );
}
