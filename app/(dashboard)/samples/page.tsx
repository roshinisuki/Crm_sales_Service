"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { CATALOG_STATUS } from "@/lib/module-status-config";
import { Plus, Search, Trash2, Package, Clock, CheckCircle2, XCircle, AlertCircle, Send, RotateCw } from "lucide-react";

const statusConfig: Record<string, { color: string; icon: any; dot: string }> = {
  New:           { color: "bg-blue-50 text-blue-700 border-blue-200",     icon: Package,      dot: "bg-blue-500" },
  UnderReview:   { color: "bg-amber-50 text-amber-700 border-amber-200",   icon: Clock,        dot: "bg-amber-500" },
  SentToCustomer:{ color: "bg-purple-50 text-purple-700 border-purple-200", icon: Send,         dot: "bg-purple-500" },
  Approved:      { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, dot: "bg-emerald-500" },
  Rejected:      { color: "bg-red-50 text-red-700 border-red-200",         icon: XCircle,      dot: "bg-red-500" },
  Revision:      { color: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCw,     dot: "bg-orange-500" },
};

function SampleListContent() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const statusFilter = useStatusFromUrl("status");

  const loadSamples = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      let allData: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await fetch(`/api/samples?${new URLSearchParams({ ...params, page: String(page) })}`);
        const data = await res.json();
        if (data.success) {
          allData = allData.concat(data.data || []);
          totalPages = data.totalPages || 1;
        } else break;
        page++;
      }
      setSamples(allData);
    } catch (err) {
      toast.error("Failed to load samples");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, [statusFilter]);

  // Auto-refresh when returning to the list page (e.g. after editing a sample)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) loadSamples();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [statusFilter]);

  const filtered = samples.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.sampleCode?.toLowerCase().includes(q) || s.customer?.name?.toLowerCase().includes(q) || s.product?.name?.toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Sample Request",
      message: "Are you sure you want to delete this sample request? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/samples/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Sample deleted");
            loadSamples();
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete");
        }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  return (
    <PageContainer className="space-y-4 p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Package size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Samples Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track product sample requests from customers</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/samples/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer shadow-sm"
        >
          <Plus size={16} /> New Sample Request
        </button>
      </div>

      {/* Status Filter */}
      <StatusFilterBar
        statuses={CATALOG_STATUS}
        paramKey="status"
        basePath="/samples"
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by code, customer or product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
        />
      </div>

      {/* Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Sample Code</th>
                <th className="crm-th">Customer</th>
                <th className="crm-th">Product</th>
                <th className="crm-th text-left">Qty</th>
                <th className="crm-th text-left">Status</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th text-left">Request Date</th>
                <th className="crm-th text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="crm-td text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                    <p className="text-sm text-slate-400">Loading samples...</p>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="crm-td text-center py-16">
                  <Package size={36} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400">No sample requests found</p>
                  <p className="text-xs text-slate-300 mt-1">Create a new sample request to get started</p>
                </td></tr>
              ) : (
                filtered.map((sample: any) => {
                  const cfg = statusConfig[sample.status] || statusConfig.New;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr 
                      key={sample.id} 
                      onClick={() => router.push(`/samples/${sample.id}?status=${sample.status}`)}
                      className="crm-tr hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <td className="crm-td">
                        <span className="font-mono text-xs font-bold text-slate-700">{sample.sampleCode}</span>
                      </td>
                      <td className="crm-td text-foreground font-medium">{sample.customer?.name || "—"}</td>
                      <td className="crm-td text-foreground">{sample.product ? `${sample.product.productCode} - ${sample.product.name}` : "—"}</td>
                      <td className="crm-td text-left">{sample.quantity}</td>
                      <td className="crm-td text-left">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.color}`}>
                          <StatusIcon size={12} /> {sample.status}
                        </span>
                      </td>
                      <td className="crm-td text-foreground">{sample.assignedUser?.name || "—"}</td>
                      <td className="crm-td text-left text-xs">{new Date(sample.requestDate).toLocaleDateString()}</td>
                      <td className="crm-td text-left">
                        <div className="flex items-center justify-start gap-2">
                          {sample.status === "New" && (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/samples/${sample.id}?status=${sample.status}&action=review`); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors border border-transparent shadow-sm whitespace-nowrap cursor-pointer">Start Review</button>
                          )}
                          {sample.status === "UnderReview" && (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/samples/${sample.id}?status=${sample.status}&action=dispatch`); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors border border-transparent shadow-sm whitespace-nowrap cursor-pointer">Send to Customer</button>
                          )}
                          {sample.status === "SentToCustomer" && (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/samples/${sample.id}?status=${sample.status}&action=outcome`); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors border border-transparent shadow-sm whitespace-nowrap cursor-pointer">Review Outcome</button>
                          )}
                          {sample.status === "Revision" && (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/samples/${sample.id}?status=${sample.status}&action=revision`); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors border border-transparent shadow-sm whitespace-nowrap cursor-pointer">Review Revision</button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(sample.id); }} 
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 cursor-pointer transition-colors" 
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

export default function SampleListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <SampleListContent />
    </Suspense>
  );
}
