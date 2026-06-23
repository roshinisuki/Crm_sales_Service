"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
};

const docTypeFilters = [
  { value: "", label: "All Documents" },
  { value: "Drawing", label: "Drawings" },
  { value: "TechnicalSpec", label: "Technical Specs" },
  { value: "NDA", label: "NDAs" },
  { value: "Quotation", label: "Quotations" },
  { value: "PurchaseOrder", label: "Purchase Orders" },
  { value: "Agreement", label: "Agreements" },
  { value: "Brochure", label: "Brochures" },
];

const entityTypeLabels: Record<string, string> = {
  Customer: "Customer",
  Deal: "Deal",
  RFQ: "RFQ",
  PurchaseOrder: "PO",
  Negotiation: "Negotiation",
  Quotation: "Quotation",
  SampleRequest: "Sample",
  Product: "Product",
};

const entityLinkMap: Record<string, (id: string, code?: string) => string> = {
  Customer: (id) => `/customer-master/${id}`,
  Deal: (id) => `/deals/${id}`,
  RFQ: (id) => `/rfq/${id}`,
  PurchaseOrder: (id) => `/purchase-orders/${id}`,
  Negotiation: (id) => `/negotiations/${id}`,
  Quotation: (id) => `/quotations/${id}`,
  SampleRequest: (id) => `/samples/${id}`,
};

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  const typeFilter = searchParams.get("type") || "";

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (typeFilter) params.documentType = typeFilter;
      let allData: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await fetch(`/api/documents?${new URLSearchParams({ ...params, page: String(page) })}`);
        const data = await res.json();
        if (data.success) {
          allData = allData.concat(data.data || []);
          totalPages = data.totalPages || 1;
        } else break;
        page++;
      }
      setDocuments(allData);
    } catch (err) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [typeFilter]);

  const filtered = documents.filter((d: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.documentCode?.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q) || d.documentType?.toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Document",
      message: "Are you sure you want to delete this document? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Document deleted");
            loadDocuments();
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete document");
        }
      },
    });
  };

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all your business documents in one place</p>
        </div>
        <button
          onClick={() => router.push("/documents/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
        >
          <Ico d={icons.plus} size={16} /> Upload Document
        </button>
      </div>

      {/* Sidebar sub-filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {docTypeFilters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/documents?type=${f.value}` : "/documents"}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              typeFilter === f.value
                ? "bg-[var(--primary)] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Ico d={icons.search} size={16} />
        </div>
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Related To</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Uploaded By</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Uploaded Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading documents...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No documents found</td></tr>
              ) : (
                filtered.map((doc: any) => {
                  const linkBuilder = entityLinkMap[doc.entityType];
                  const relatedLabel = `${entityTypeLabels[doc.entityType] || doc.entityType}`;
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{doc.documentCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{doc.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)]">
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {linkBuilder ? (
                          <Link href={linkBuilder(doc.entityId)} className="text-[var(--primary)] hover:underline text-xs">
                            {relatedLabel}
                          </Link>
                        ) : (
                          <span className="text-gray-500 text-xs">{relatedLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.uploadedBy?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                            title="View/Download"
                          >
                            <Ico d={icons.eye} size={15} />
                          </a>
                          {(user?.role === "Admin" || user?.role === "SalesManager" || doc.uploadedById === user?.id) && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                              title="Delete"
                            >
                              <Ico d={icons.trash} size={15} />
                            </button>
                          )}
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
        onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
        isDestructive
      />
    </PageContainer>
  );
}
