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

const statusStyles: Record<string, { badge: string; dot: string }> = {
  Draft: { badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  Sent: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  UnderReview: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  Accepted: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Rejected: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  Expired: { badge: "bg-gray-50 text-gray-500 border-gray-200", dot: "bg-gray-400" },
  PendingApproval: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  Approved: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

function QuotationListContent() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
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
      const params: any = { page: String(page) };
      if (statusFilter) params.status = statusFilter;
      const res = await fetch(`/api/quotations?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.data ?? []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
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
    setPage(1);
    loadQuotations();
  }, [statusFilter]);

  useEffect(() => {
    loadQuotations();
  }, [page]);

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



  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quotations Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer quotations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`/api/quotations/export${statusFilter ? `?status=${statusFilter}` : ""}`, "_blank")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
            Export CSV
          </button>
          <button onClick={() => router.push("/quotations/new")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
            <Ico d={icons.plus} size={16} /> New Quotation
          </button>
        </div>
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
                <th className="crm-th text-center">Margin</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">Valid Until</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="crm-td text-center py-12">
                    <div className="flex justify-center">
                      <CRMSpinner size={36} label="Loading quotations..." />
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan={9} className="crm-td text-center py-8 text-red-500">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="crm-td text-center py-12 text-muted-foreground">
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
                    onClick={() => router.push(`/quotations/${q.id}?status=${q.status}`)}
                  >
                    <td className="crm-td font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {q.quotationCode}
                        {q.revisionNumber > 1 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{q.revisionNumber}</span>
                        )}
                        {q.negotiationId && (
                          <a href={`/negotiations/${q.negotiationId}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline" title="Linked negotiation">NEG</a>
                        )}
                      </div>
                    </td>
                    <td className="crm-td">
                      <span className="row-primary-link">{q.customer?.name || "—"}</span>
                    </td>
                    <td className="crm-td text-right text-foreground">{formatCurrency(q.totalAmount)}</td>
                    <td className="crm-td text-right text-foreground">{q.discountPercent}%</td>
                    <td className="crm-td text-right font-medium text-foreground">{formatCurrency(q.finalAmount)}</td>
                    <td className="crm-td text-center">{q.overallMarginPercent != null ? <span className={`text-xs font-semibold ${Number(q.overallMarginPercent) >= 20 ? "text-emerald-600" : Number(q.overallMarginPercent) >= 15 ? "text-amber-600" : "text-rose-600"}`}>{Number(q.overallMarginPercent).toFixed(1)}%</span> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="crm-td"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${(statusStyles[q.status] || statusStyles.Draft).badge}`}><span className={`w-1.5 h-1.5 rounded-full ${(statusStyles[q.status] || statusStyles.Draft).dot}`} />{q.status}</span></td>
                    <td className="crm-td text-foreground">{new Date(q.validUntil).toLocaleDateString()}</td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            Showing <strong>{quotations.length}</strong> of <strong>{total}</strong> quotations
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-slate-600 px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}

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
