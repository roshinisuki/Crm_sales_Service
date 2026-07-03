"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { CRMSpinner } from "@/components/CRMSpinner";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { QUOTES_STATUS } from "@/lib/module-status-config";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
};

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Sent: "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-gray-100 text-gray-500",
};

function QuotationListContent() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const statusFilter = useStatusFromUrl("status");

  const [error, setError] = useState("");

  const loadQuotations = async () => {
    setLoading(true);
    setError("");
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await fetch(`/api/quotations?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.data ?? []);
      } else {
        setError(data.message || "Failed to load quotations");
      }
    } catch {
      setError("Failed to load quotations. Check your connection and try again.");
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [statusFilter]);

  const filtered = quotations.filter((q: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return q.quotationCode?.toLowerCase().includes(s) || q.customer?.name?.toLowerCase().includes(s);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Quotation",
      message: "Are you sure you want to delete this quotation?",
      action: async () => {
        try {
          const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Quotation deleted"); loadQuotations(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Quotation duplicated"); loadQuotations(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer quotations</p>
        </div>
        <button onClick={() => router.push("/quotations/new")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
          <Ico d={icons.plus} size={16} /> New Quotation
        </button>
      </div>

      <StatusFilterBar
        statuses={QUOTES_STATUS}
        paramKey="status"
        basePath="/quotations"
      />

      <div className="relative">
        <Ico d={icons.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by QUO code or customer name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-sm pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
      </div>

      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">QUO Code</th>
                <th className="crm-th">Customer</th>
                <th className="crm-th text-right">Total</th>
                <th className="crm-th text-right">Discount %</th>
                <th className="crm-th text-right">Final Amount</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">Valid Until</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="crm-td text-center py-12">
                    <div className="flex justify-center">
                      <CRMSpinner size={36} label="Loading quotations..." />
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan={8} className="crm-td text-center py-8 text-red-500">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="crm-td text-center py-12 text-muted-foreground">
                  <div className="text-3xl mb-3">📄</div>
                  <p className="font-medium mb-1">No quotations found</p>
                  <p className="text-xs mb-4">
                    {statusFilter
                      ? `No quotations with status "${statusFilter}".`
                      : "No quotations have been created yet."}
                  </p>
                  <button
                    onClick={() => router.push("/quotations/new")}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors"
                  >
                    + Create First Quotation
                  </button>
                </td></tr>
              ) : (
                filtered.map((q: any) => (
                  <tr
                    key={q.id}
                    className="crm-tr table-row-clickable"
                    onClick={() => router.push(`/quotations/${q.id}`)}
                  >
                    <td className="crm-td font-medium text-foreground">{q.quotationCode}</td>
                    <td className="crm-td">
                      <span className="row-primary-link">{q.customer?.name || "—"}</span>
                    </td>
                    <td className="crm-td text-right text-foreground">{formatCurrency(q.totalAmount)}</td>
                    <td className="crm-td text-right text-foreground">{q.discountPercent}%</td>
                    <td className="crm-td text-right font-medium text-foreground">{formatCurrency(q.finalAmount)}</td>
                    <td className="crm-td"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status] || "bg-gray-100 text-gray-600"}`}>{q.status}</span></td>
                    <td className="crm-td text-foreground">{new Date(q.validUntil).toLocaleDateString()}</td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleDuplicate(q.id)} className="row-action-btn" title="Duplicate"><Ico d={icons.copy} size={15} /></button>
                        <button onClick={() => handleDelete(q.id)} className="row-action-btn row-action-btn-danger" title="Delete"><Ico d={icons.x} size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })} isDestructive={true} />
    </PageContainer>
  );
}

export default function QuotationListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <QuotationListContent />
    </Suspense>
  );
}
