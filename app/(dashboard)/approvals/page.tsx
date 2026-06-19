"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  check: "M5 13l4 4L19 7",
  x: "M6 18L18 6M6 6l12 12",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
};

const tabs = [
  { value: "", label: "All", approvalType: "" },
  { value: "Quotation", label: "Quotation", approvalType: "Quotation" },
  { value: "Discount", label: "Discount", approvalType: "Discount" },
  { value: "Negotiation", label: "Negotiation", approvalType: "Negotiation" },
  { value: "PO", label: "Purchase Order", approvalType: "PO" },
];

const statusColors: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const entityLinkMap: Record<string, (id: string) => string> = {
  Deal: (id) => `/deals/${id}`,
  PurchaseOrder: (id) => `/purchase-orders/${id}`,
  Quotation: (id) => `/quotations/${id}`,
  Negotiation: (id) => `/negotiations/${id}`,
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(searchParams.get("type") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; approval: any; action: "approve" | "reject" } | null>(null);
  const [remarks, setRemarks] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeTab) params.approvalType = activeTab;
      if (statusFilter) params.status = statusFilter;
      const res = await fetch(`/api/approvals?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setApprovals(data.data);
    } catch {
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [activeTab, statusFilter]);

  const filtered = approvals.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.deal?.dealName?.toLowerCase().includes(q) || a.requestedBy?.name?.toLowerCase().includes(q) || a.approvalType?.toLowerCase().includes(q);
  });

  const canApprove = ["Admin", "SalesManager"].includes(user?.role ?? "");

  const handleAction = async () => {
    if (!actionModal) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/approvals/${actionModal.approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal.action, remarks }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Approval ${actionModal.action}d successfully`);
        setActionModal(null);
        setRemarks("");
        loadApprovals();
      } else {
        toast.error(data.message || "Failed to update approval");
      }
    } catch {
      toast.error("Failed to update approval");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and approve quotation, discount, negotiation, and purchase order requests</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {["", "Pending", "Approved", "Rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s || "All Status"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Ico d={icons.search} size={16} />
          </div>
          <input
            type="text"
            placeholder="Search approvals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Related Deal/Entity</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Requested By</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Discount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Requested On</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Resolved By</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading approvals...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No approvals found</td></tr>
              ) : (
                filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {a.approvalType || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.deal ? (
                        <Link href={`/deals/${a.deal.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                          {a.deal.dealName}
                        </Link>
                      ) : a.entityType && entityLinkMap[a.entityType] ? (
                        <Link href={entityLinkMap[a.entityType](a.entityId)} className="text-blue-600 hover:underline text-xs font-medium">
                          {a.entityType}
                        </Link>
                      ) : (
                        <span className="text-gray-500 text-xs">{a.entityType || "—"}</span>
                      )}
                      {a.deal?.customer && (
                        <div className="text-xs text-gray-500 mt-0.5">{a.deal.customer.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.requestedBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.discountPercent > 0 ? `${a.discountPercent}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || "bg-gray-100 text-gray-700"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.resolvedBy?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === "Pending" && canApprove ? (
                          <>
                            <button
                              onClick={() => { setActionModal({ isOpen: true, approval: a, action: "approve" }); setRemarks(""); }}
                              className="px-2.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setActionModal({ isOpen: true, approval: a, action: "reject" }); setRemarks(""); }}
                              className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {actionModal.action === "approve" ? "Approve Request" : "Reject Request"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {actionModal.action === "approve"
                ? "Are you sure you want to approve this approval request?"
                : "Are you sure you want to reject this approval request?"}
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Type:</span> <span className="font-medium">{actionModal.approval.approvalType}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium">{actionModal.approval.status}</span></div>
                {actionModal.approval.discountPercent > 0 && (
                  <div><span className="text-gray-500">Discount:</span> <span className="font-medium">{actionModal.approval.discountPercent}%</span></div>
                )}
                {actionModal.approval.deal && (
                  <div className="col-span-2"><span className="text-gray-500">Deal:</span> <span className="font-medium">{actionModal.approval.deal.dealName}</span></div>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks {actionModal.action === "reject" && "(required)"}</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add remarks for this decision..."
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setActionModal(null); setRemarks(""); }}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processing || (actionModal.action === "reject" && !remarks)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                  actionModal.action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processing ? "Processing..." : actionModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
