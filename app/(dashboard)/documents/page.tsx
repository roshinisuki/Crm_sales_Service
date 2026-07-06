"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import UploadDocumentModal from "@/components/documents/UploadDocumentModal";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";
import CompanyGrid from "@/components/documents/CompanyGrid";

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
  { value: "", label: "All Documents", icon: "📂" },
  { value: "Drawing", label: "Drawings", icon: "📐" },
  { value: "TechnicalSpec", label: "Technical Specs", icon: "📋" },
  { value: "NDA", label: "NDAs", icon: "🤝" },
  { value: "Quotation", label: "Quotations", icon: "💰" },
  { value: "PurchaseOrder", label: "Purchase Orders", icon: "📋" },
  { value: "Agreement", label: "Agreements", icon: "📜" },
  { value: "Brochure", label: "Brochures", icon: "📖" },
];

const entityTypeLabels: Record<string, string> = {
  Customer: "Customer",
  Deal: "Opportunity",
  RFQ: "RFQ",
  PurchaseOrder: "PO",
  Negotiation: "Negotiation",
  Quotation: "Quotation",
  SampleRequest: "Sample",
  Product: "Product",
};

const entityIcons: Record<string, string> = {
  Customer: "🏢", Deal: "📈", RFQ: "📄", Quotation: "💰",
  PurchaseOrder: "📋", SampleRequest: "🧪", Negotiation: "🤝", Product: "📦",
};

const entityLinkMap: Record<string, (id: string) => string> = {
  Customer: (id) => `/customer-master/${id}`,
  Deal: (id) => `/sales-pipeline/${id}`,
  RFQ: (id) => `/rfq/${id}`,
  PurchaseOrder: (id) => `/purchase-orders/${id}`,
  Negotiation: (id) => `/negotiations/${id}`,
  Quotation: (id) => `/quotations/${id}`,
  SampleRequest: (id) => `/samples/${id}`,
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  Drawing: "bg-blue-100 text-blue-700",
  TechnicalSpec: "bg-purple-100 text-purple-700",
  NDA: "bg-amber-100 text-amber-700",
  Quotation: "bg-emerald-100 text-emerald-700",
  PurchaseOrder: "bg-indigo-100 text-indigo-700",
  Agreement: "bg-rose-100 text-rose-700",
  Brochure: "bg-cyan-100 text-cyan-700",
  Invoice: "bg-orange-100 text-orange-700",
  Contract: "bg-slate-100 text-slate-700",
  Other: "bg-gray-100 text-gray-600",
};

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"all" | "company">("all");
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const typeFilter = searchParams.get("type") || "";

  const loadDocuments = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.documentType = typeFilter;
      if (search) params.search = search;
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
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const timer = setTimeout(() => loadDocuments(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
            setDocuments(prev => prev.filter(d => d.id !== id));
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete document");
        }
      },
    });
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const stats = {
    total: documents.length,
    drawings: documents.filter(d => d.documentType === "Drawing").length,
    ndas: documents.filter(d => d.documentType === "NDA").length,
    thisMonth: documents.filter(d => new Date(d.createdAt) > thirtyDaysAgo).length,
  };

  const currentTabLabel = docTypeFilters.find(f => f.value === typeFilter)?.label ?? "Documents";
  const currentTabIcon = docTypeFilters.find(f => f.value === typeFilter)?.icon ?? "📂";

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary)]/5 flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-[var(--primary)]">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M9 13h6 M9 17h6 M9 9h2" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Document Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage all your business documents in one place</p>
          </div>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md"
        >
          <Ico d={icons.plus} size={16} /> Upload Document
        </button>
      </div>

      {/* View Toggle — segmented control */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl mb-5">
        <button
          onClick={() => setViewMode("all")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === "all" ? "bg-white text-[var(--primary)] shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All Documents
        </button>
        <button
          onClick={() => setViewMode("company")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === "company" ? "bg-white text-[var(--primary)] shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          By Company
        </button>
      </div>

      {/* KPI Cards */}
      {viewMode === "all" && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Documents", value: stats.total, icon: "📂", color: "text-slate-700", bg: "bg-slate-50", ring: "ring-slate-200/60" },
          { label: "Drawings", value: stats.drawings, icon: "📐", color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200/60" },
          { label: "NDAs", value: stats.ndas, icon: "🤝", color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200/60" },
          { label: "Uploaded This Month", value: stats.thisMonth, icon: "📤", color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200/60" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center text-xl ring-1 ${card.ring}`}>
                {card.icon}
              </div>
              <span className={`text-3xl font-bold ${card.color} tracking-tight`}>{card.value}</span>
            </div>
            <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">{card.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* Tab Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {docTypeFilters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/documents?type=${f.value}` : "/documents"}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              typeFilter === f.value
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
          </Link>
        ))}
      </div>

      {/* Search — only in flat list view */}
      {viewMode === "all" && (
      <div className="relative mb-4">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Ico d={icons.search} size={16} />
        </div>
        <input
          type="text"
          placeholder="Search by name, code, or description…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]/30 transition-all"
        />
      </div>
      )}

      {/* Company Grid or Table */}
      {viewMode === "company" ? (
        <CompanyGrid documentType={typeFilter} />
      ) : (
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-[var(--primary)] rounded-full animate-spin mb-3" />
            <div>Loading documents…</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mx-auto mb-4">{currentTabIcon}</div>
            <div className="font-medium text-sm text-slate-700 mb-1">No {currentTabLabel} found</div>
            <div className="text-xs text-slate-400 mb-5">
              {searchQuery ? `No results for "${searchQuery}"` : "Upload your first document to get started"}
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md"
            >
              <Ico d={icons.plus} size={16} /> Upload Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Code</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Name</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Type</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Related To</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Ver</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Size</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Uploaded By</th>
                  <th className="text-left px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-right px-5 py-3.5 font-medium text-xs uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc: any) => {
                  const linkBuilder = entityLinkMap[doc.entityType];
                  const entityLabel = entityTypeLabels[doc.entityType] || doc.entityType;
                  const entityIcon = entityIcons[doc.entityType] ?? "📎";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{doc.documentCode}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{doc.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[doc.documentType] ?? "bg-gray-100 text-gray-600"}`}>
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {doc.entityType && doc.relatedEntityName ? (
                          linkBuilder ? (
                            <Link
                              href={linkBuilder(doc.entityId)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20"
                            >
                              {entityIcon} {doc.relatedEntityName}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              {entityIcon} {doc.relatedEntityName}
                            </span>
                          )
                        ) : doc.entityType ? (
                          <span className="text-xs text-slate-400">{entityIcon} {entityLabel}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">v{doc.version ?? 1}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{formatSize(doc.fileSize)}</td>
                      <td className="px-5 py-3.5 text-slate-600">{doc.uploadedBy?.name || "—"}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                            title="Preview"
                          >
                            <Ico d={icons.eye} size={15} />
                          </button>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={doc.name}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                            title="Download"
                          >
                            <Ico d={icons.download} size={15} />
                          </a>
                          {(user?.role === "Admin" || user?.role === "SalesManager" || doc.uploadedById === user?.id) && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Ico d={icons.trash} size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <UploadDocumentModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={(doc) => {
          setDocuments(prev => [doc, ...prev]);
          setUploadOpen(false);
          toast.success("Document uploaded successfully");
        }}
      />

      <DocumentPreviewModal
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDelete={handleDelete}
      />

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
