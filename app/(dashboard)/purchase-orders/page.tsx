"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import PageContainer from "@/components/PageContainer";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { ORDERS_STATUS } from "@/lib/module-status-config";

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
  sync: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
};

const statusColors: Record<string, string> = {
  New: "bg-slate-100 text-slate-700",
  UnderValidation: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Rejected: "bg-red-100 text-red-700",
  Closed: "bg-green-100 text-green-700",
};

const erpStatusColors: Record<string, string> = {
  Synced: "bg-green-100 text-green-700",
  Pending: "bg-amber-100 text-amber-700",
  Failed: "bg-red-100 text-red-700",
};

const statusOptions = ["New", "UnderValidation", "Approved", "Rejected", "Closed"];

function PurchaseOrderListContent() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const statusFilter = useStatusFromUrl("status");

  const loadPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      let allData: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await fetch(`/api/purchase-orders?${new URLSearchParams({ ...params, page: String(page) })}`);
        const data = await res.json();
        if (data.success) {
          allData = allData.concat(data.data || []);
          totalPages = data.totalPages || 1;
        } else break;
        page++;
      }
      setPurchaseOrders(allData);
    } catch {
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchaseOrders();
  }, [statusFilter]);

  const filtered = purchaseOrders.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.poCode?.toLowerCase().includes(q) || p.customer?.name?.toLowerCase().includes(q) || p.poNumber?.toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Purchase Order",
      message: "Are you sure you want to delete this purchase order?",
      action: async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Purchase order deleted");
            loadPurchaseOrders();
          } else toast.error(data.message || "Failed to delete");
        } catch {
          toast.error("Failed to delete");
        }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const handleSyncErp = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/sync-erp`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Synced to ERP");
        loadPurchaseOrders();
      } else {
        toast.error(data.message || "ERP sync failed");
      }
    } catch {
      toast.error("ERP sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create POs, validate, approve, and sync to ERP</p>
        </div>
        <button
          onClick={() => router.push("/purchase-orders/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
        >
          <Ico d={icons.plus} size={16} /> New Purchase Order
        </button>
      </div>

      <StatusFilterBar
        statuses={ORDERS_STATUS}
        paramKey="status"
        basePath="/purchase-orders"
      />

      <div className="relative">
        <Ico d={icons.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by PO code, PO number, or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
        />
      </div>

      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">PO Code</th>
                <th className="crm-th">Customer</th>
                <th className="crm-th">Final Amount</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">ERP</th>
                <th className="crm-th">Items</th>
                <th className="crm-th">Expected Delivery</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="crm-td text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" />
                    <p className="text-sm text-slate-400">Loading orders...</p>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="crm-td text-center py-16">
                  <p className="text-sm font-semibold text-slate-500">No purchase orders found</p>
                </td></tr>
              ) : (
                filtered.map((p: any) => (
                  <tr key={p.id} className="crm-tr">
                    <td className="crm-td font-medium text-foreground">
                      {p.poCode}
                      {p.poNumber && <div className="text-xs text-muted-foreground">{p.poNumber}</div>}
                    </td>
                    <td className="crm-td text-foreground">{p.customer?.name || "—"}</td>
                    <td className="crm-td text-foreground">{p.finalAmount ? formatCurrency(p.finalAmount) : "—"}</td>
                    <td className="crm-td">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    </td>
                    <td className="crm-td">
                      {p.erpSyncStatus ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${erpStatusColors[p.erpSyncStatus] || "bg-gray-100 text-gray-600"}`}>{p.erpSyncStatus}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="crm-td text-foreground">{p._count?.items || 0}</td>
                    <td className="crm-td text-muted-foreground">{p.expectedDelivery ? new Date(p.expectedDelivery).toLocaleDateString() : "—"}</td>
                    <td className="crm-td text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === "Approved" && p.erpSyncStatus !== "Synced" && (
                          <button
                            onClick={() => handleSyncErp(p.id)}
                            disabled={syncingId === p.id}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 cursor-pointer disabled:opacity-40"
                            title="Sync to ERP"
                          >
                            <Ico d={icons.sync} size={15} className={syncingId === p.id ? "animate-spin" : ""} />
                          </button>
                        )}
                        <button onClick={() => router.push(`/purchase-orders/${p.id}?status=${p.status}`)} className="p-1.5 rounded-lg hover:bg-muted text-slate-600 cursor-pointer" title="View">
                          <Ico d={icons.eye} size={15} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Delete">
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

export default function PurchaseOrderListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <PurchaseOrderListContent />
    </Suspense>
  );
}
