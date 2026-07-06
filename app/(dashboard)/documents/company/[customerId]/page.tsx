"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import DocumentRow from "@/components/documents/DocumentRow";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";

const STAGE_COLORS: Record<string, string> = {
  Qualified: "bg-blue-50 text-blue-700",
  SalesOpportunity: "bg-blue-50 text-blue-700",
  RequirementGathering: "bg-purple-50 text-purple-700",
  MeetingScheduled: "bg-amber-50 text-amber-700",
  ProposalSent: "bg-emerald-50 text-emerald-700",
  Negotiation: "bg-orange-50 text-orange-700",
  Active: "bg-teal-50 text-teal-700",
  Won: "bg-green-50 text-green-700",
  Lost: "bg-red-50 text-red-700",
};

const KPI_ICONS: Record<string, string> = {
  total: "📂",
  drawings: "📐",
  ndas: "🤝",
  quotations: "💰",
  purchaseOrders: "📋",
  thisMonth: "📤",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

type KpiKey = "total" | "drawings" | "ndas" | "quotations" | "purchaseOrders" | "thisMonth";

const KPI_LABELS: Record<KpiKey, string> = {
  total: "Total Documents",
  drawings: "Drawings",
  ndas: "NDAs",
  quotations: "Quotations",
  purchaseOrders: "Purchase Orders",
  thisMonth: "Uploaded This Month",
};

export default function CompanyDocumentDetailPage() {
  const params = useParams<{ customerId: string }>();
  const searchParams = useSearchParams();
  const customerId = params.customerId;
  const initialType = searchParams.get("type") || "";

  const { user } = useAuth();
  const toast = useToast();

  const [company, setCompany] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiKey>("total");
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const fetchData = useCallback(async (kpi: KpiKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (kpi === "thisMonth") {
        params.set("thisMonth", "true");
      } else if (kpi !== "total") {
        const typeMap: Record<string, string> = {
          drawings: "Drawing",
          ndas: "NDA",
          quotations: "Quotation",
          purchaseOrders: "PurchaseOrder",
        };
        if (typeMap[kpi]) params.set("documentType", typeMap[kpi]);
      }
      const res = await fetch(`/api/documents/company/${customerId}?${params}`);
      const data = await res.json();
      if (data.success) {
        setCompany(data.company);
        setDocuments(data.data || []);
        setKpis(data.kpis);
      } else {
        toast.error(data.message || "Failed to load company documents");
      }
    } catch {
      toast.error("Failed to load company documents");
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    fetchData(activeKpi);
  }, [fetchData, activeKpi]);

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
            setKpis((prev: any) => prev ? { ...prev, total: prev.total - 1 } : prev);
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete document");
        }
      },
    });
  };

  if (loading && !company) {
    return (
      <PageContainer>
        <div className="text-center py-16 text-slate-400 text-sm">
          <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-[var(--primary)] rounded-full animate-spin mb-3" />
          <div>Loading company documents…</div>
        </div>
      </PageContainer>
    );
  }

  if (!company) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mx-auto mb-4">🔍</div>
          <div className="font-medium text-sm text-slate-700 mb-1">Company not found</div>
          <Link href="/documents" className="text-sm text-[var(--primary)] hover:underline">← Back to documents</Link>
        </div>
      </PageContainer>
    );
  }

  const kpiCards: Array<{ key: KpiKey; value: number }> = kpis
    ? [
        { key: "total", value: kpis.total },
        { key: "drawings", value: kpis.drawings },
        { key: "ndas", value: kpis.ndas },
        { key: "quotations", value: kpis.quotations },
        { key: "purchaseOrders", value: kpis.purchaseOrders },
        { key: "thisMonth", value: kpis.thisMonth },
      ]
    : [];

  const activeLabel = KPI_LABELS[activeKpi];
  const docCount = documents.length;

  return (
    <PageContainer>
      {/* Back button */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to companies
      </Link>

      {/* Company header */}
      <div className="flex items-center gap-4 mb-6 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/5 flex items-center justify-center font-medium text-base text-[var(--primary)] flex-shrink-0 ring-1 ring-[var(--primary)]/10">
          {getInitials(company.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-lg text-slate-900 tracking-tight">{company.name}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {company.industryType || "—"} · {company.assignedUserName ? `Lead: ${company.assignedUserName}` : "Unassigned"}
            {company.dealStage && ` · ${company.dealStage}`}
          </p>
        </div>
        {company.dealStage && (
          <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full text-xs font-medium ${STAGE_COLORS[company.dealStage] ?? "bg-slate-100 text-slate-600"}`}>
            {company.dealStage}
          </span>
        )}
      </div>

      {/* KPI Cards — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpiCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setActiveKpi(card.key)}
            className={`bg-white rounded-2xl border p-4 text-left transition-all ${
              activeKpi === card.key
                ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/15 shadow-sm"
                : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{KPI_ICONS[card.key]}</span>
              <span className="text-2xl font-bold text-slate-800 tracking-tight">{card.value}</span>
            </div>
            <p className="text-xs font-medium text-slate-500 tracking-wide">{KPI_LABELS[card.key]}</p>
          </button>
        ))}
      </div>

      {/* Scope label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-slate-500">{activeLabel}</span>
        <span className="text-xs text-slate-300">·</span>
        <span className="text-xs text-slate-400">{docCount} document{docCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-[var(--primary)] rounded-full animate-spin mb-3" />
          <div>Loading documents…</div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mx-auto mb-4">📂</div>
          <div className="font-medium text-sm text-slate-700 mb-1">No documents in this category</div>
          <div className="text-xs text-slate-400">This company has no documents matching the selected filter</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => {
            const revisions = doc.revisions || [];
            const hasRevisions = revisions.length > 0;
            return (
              <div key={doc.id}>
                <DocumentRow
                  doc={doc}
                  onPreview={setPreviewDoc}
                  onDelete={handleDelete}
                  onReplaced={() => fetchData(activeKpi)}
                  showEntityLabel
                />
                {hasRevisions && (
                  <div className="flex gap-1.5 flex-wrap mt-2 ml-1">
                    {revisions.map((rev: any) => (
                      <a
                        key={rev.id}
                        href={rev.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${formatSize(rev.fileSize)} · ${new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                          rev.isCurrent
                            ? "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 font-medium"
                            : "bg-slate-50 text-slate-400 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      >
                        R{rev.revisionNumber}{rev.isCurrent ? " · current" : ""}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
