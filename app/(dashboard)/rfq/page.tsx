"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { CRMSpinner } from "@/components/CRMSpinner";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { REQUESTS_STATUS } from "@/lib/module-status-config";
import { AlertTriangle, Clock, FileText, TrendingUp, AlertCircle, Trash2, Download, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";

const statusStyles: Record<string, { badge: string; dot: string }> = {
  New: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  UnderReview: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  CostingPending: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  QuotationCreated: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Closed: { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const statusOptions = ["New", "UnderReview", "CostingPending", "QuotationCreated", "Closed"];

function RFQListContent() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkAssignUser, setBulkAssignUser] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const statusFilter = useStatusFromUrl("status");

  const loadRFQs = async (pageNum = page) => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (pageNum > 1) params.page = pageNum;
      const res = await fetch(`/api/rfq?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) {
        setRfqs(data.data);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      }
    } catch (err) {
      toast.error("Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/rfq/stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {}
  };

  useEffect(() => {
    loadRFQs(1);
    loadStats();
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, [statusFilter]);

  const filtered = rfqs.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.rfqCode?.toLowerCase().includes(q) || r.customer?.name?.toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete RFQ",
      message: "Are you sure you want to delete this RFQ? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/rfq/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("RFQ deleted");
            loadRFQs(page);
            loadStats();
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

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r: any) => r.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      let value: string | undefined;
      if (bulkAction === "assign") value = bulkAssignUser;
      if (bulkAction === "status") value = bulkStatus;

      const res = await fetch("/api/rfq/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bulkAction, rfq_ids: Array.from(selectedIds), value }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Bulk ${bulkAction}: ${data.data.affectedCount} RFQ(s) updated`);
        setSelectedIds(new Set());
        setBulkAction("");
        setBulkAssignUser("");
        setBulkStatus("");
        loadRFQs(page);
        loadStats();
      } else {
        toast.error(data.message || "Bulk action failed");
      }
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    window.open(`/api/rfq/export?${params.toString()}`, "_blank");
  };

  const now = new Date();

  const getAgingRowClass = (rfq: any) => {
    if (rfq.status !== "CostingPending") return "";
    const days = Math.floor((now.getTime() - new Date(rfq.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 5) return "bg-red-50";
    if (days >= 3) return "bg-orange-50";
    return "";
  };

  const getDaysPending = (rfq: any) => {
    if (rfq.status !== "CostingPending") return "—";
    const days = Math.floor((now.getTime() - new Date(rfq.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  const isOverdue = (rfq: any) => {
    if (!rfq.customerDueDate) return false;
    return new Date(rfq.customerDueDate) < now && !["QuotationCreated", "Closed"].includes(rfq.status);
  };

  return (
    <PageShell
      title="Requests"
      subtitle="Manage Request for Quotations"
      action={
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => router.push("/rfq/new")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
          >
            + New RFQ
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <SummaryCard label="Pending Costing" value={stats.pending_costing} icon={<Clock size={18} />} variant="amber" />
            <SummaryCard label="Aging 0-2d" value={stats.aging_0_2} icon={<Clock size={18} />} variant="green" />
            <SummaryCard label="Aging 3-5d" value={stats.aging_3_5} icon={<AlertTriangle size={18} />} variant="amber" />
            <SummaryCard label="Aging 5+d" value={stats.aging_5_plus} icon={<AlertTriangle size={18} />} variant="red" />
            <SummaryCard label="Overdue Due Date" value={stats.overdue_customer_due} icon={<AlertCircle size={18} />} variant="red" />
            <SummaryCard label="RFQ→Quote Rate" value={`${stats.rfq_to_quotation_rate}%`} icon={<TrendingUp size={18} />} variant="blue" />
          </div>
        )}

        {/* Status Filter Bar */}
        <StatusFilterBar
          statuses={REQUESTS_STATUS}
          paramKey="status"
          basePath="/rfq"
        />

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search RFQ code or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
          />
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm cursor-pointer">
              <option value="">-- Select Action --</option>
              <option value="assign">Assign To</option>
              <option value="status">Change Status</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === "assign" && (
              <select value={bulkAssignUser} onChange={(e) => setBulkAssignUser(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm cursor-pointer">
                <option value="">-- Select User --</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            )}
            {bulkAction === "status" && (
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm cursor-pointer">
                <option value="">-- Select Status --</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/([A-Z])/g, " $1").trim()}</option>)}
              </select>
            )}
            {bulkAction && (
              <button onClick={handleBulkAction} disabled={bulkLoading} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
                {bulkLoading ? "Processing..." : "Apply"}
              </button>
            )}
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-sm text-slate-500 hover:text-slate-700 cursor-pointer">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th" style={{ width: "36px" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer rounded border-slate-300"
                    />
                  </th>
                  <th className="crm-th">RFQ Code</th>
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Priority</th>
                  <th className="crm-th">Due Date</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th">Assigned</th>
                  <th className="crm-th">Costing Owner</th>
                  <th className="crm-th">Aging</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="crm-td text-center py-12">
                      <div className="flex justify-center">
                        <CRMSpinner size={36} label="Loading RFQs..." />
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="crm-td text-center py-16">
                    <p className="text-sm font-semibold text-slate-500">No RFQs found</p>
                  </td></tr>
                ) : (
                  filtered.map((rfq: any) => {
                    const overdue = isOverdue(rfq);
                    const rowClass = getAgingRowClass(rfq);
                    return (
                      <tr
                        key={rfq.id}
                        className={`crm-tr table-row-clickable ${rowClass}`}
                        onClick={() => router.push(`/rfq/${rfq.id}?status=${rfq.status}`)}
                      >
                        <td className="crm-td" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(rfq.id)}
                            onChange={() => toggleSelect(rfq.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="crm-td">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-[13px]">{rfq.rfqCode}</span>
                            {rfq.revisedAt && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200" title={`Revised: ${new Date(rfq.revisedAt).toLocaleDateString()}`}>REV</span>
                            )}
                          </div>
                        </td>
                        <td className="crm-td">
                          <span className="row-primary-link font-medium">{rfq.customer?.name || "—"}</span>
                        </td>
                        <td className="crm-td">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${rfq.priority === "Urgent" ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-50 text-slate-600 border border-slate-200"}`}>
                            {rfq.priority || "Normal"}
                          </span>
                        </td>
                        <td className="crm-td">
                          {rfq.customerDueDate ? (
                            <span className={`text-[13px] ${overdue ? "text-red-600 font-semibold" : "text-foreground"}`}>
                              {new Date(rfq.customerDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              {overdue && <span className="ml-1 text-xs text-red-500">⚠</span>}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="crm-td">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${(statusStyles[rfq.status] || statusStyles.Closed).badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${(statusStyles[rfq.status] || statusStyles.Closed).dot}`} />
                            {rfq.status.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </td>
                        <td className="crm-td text-foreground text-[13px]">{rfq.assignedUser?.name || <span className="text-slate-400">—</span>}</td>
                        <td className="crm-td text-foreground text-[13px]">{rfq.costingOwner?.name || <span className="text-slate-400">—</span>}</td>
                        <td className="crm-td">
                          {getDaysPending(rfq) !== "—" ? (
                            <span className={`text-[13px] font-medium ${parseInt(getDaysPending(rfq)) > 5 ? "text-red-600" : parseInt(getDaysPending(rfq)) >= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                              {getDaysPending(rfq)}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => router.push(`/rfq/${rfq.id}?status=${rfq.status}`)} className="row-action-btn" title="View Details">
                              <Eye size={15} />
                            </button>
                            <button onClick={() => handleDelete(rfq.id)} className="row-action-btn row-action-btn-danger" title="Delete">
                              <Trash2 size={15} />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{rfqs.length}</span> of <span className="font-semibold text-slate-700">{total}</span> RFQ{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadRFQs(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">{page} / {totalPages}</span>
              <button
                onClick={() => loadRFQs(page + 1)}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageShell>
  );
}

export default function RFQListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <RFQListContent />
    </Suspense>
  );
}
