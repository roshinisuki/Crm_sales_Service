"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import UploadDocumentModal from "./UploadDocumentModal";
import DocumentPreviewModal from "./DocumentPreviewModal";

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  ppt: "📽", pptx: "📽", jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼",
  webp: "🖼", dwg: "📐", zip: "📦", rar: "📦", txt: "📃", csv: "📋",
};

function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "📎";
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

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

interface EntityDocumentTabProps {
  entityType: string;
  entityId: string;
  allowedDocumentTypes?: string[];
  defaultDocumentType?: string;
}

export default function EntityDocumentTab({
  entityType,
  entityId,
  allowedDocumentTypes,
  defaultDocumentType,
}: EntityDocumentTabProps) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });
  const { user } = useAuth();
  const toast = useToast();
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?entityType=${entityType}&entityId=${entityId}&limit=100`);
      const data = await res.json();
      if (data.success) setDocs(data.data ?? []);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, toast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

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
            setDocs(prev => prev.filter(d => d.id !== id));
          } else {
            toast.error(data.message || "Failed to delete");
          }
        } catch {
          toast.error("Failed to delete document");
        }
      },
    });
  };

  const canDelete = (doc: any) => user?.role === "Admin" || user?.role === "SalesManager" || doc.uploadedById === user?.id;

  const handleReplaceFile = async (file: File) => {
    if (!replacingDocId) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/documents/${replacingDocId}/revision`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        toast.success("New version uploaded");
        fetchDocs();
      } else {
        toast.error(data.message || "Failed to upload new version");
      }
    } catch {
      toast.error("Failed to upload new version");
    } finally {
      setReplacingDocId(null);
      if (replaceFileRef.current) replaceFileRef.current.value = "";
    }
  };

  if (uploadOpen) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left column: file list / sidebar */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <span className="font-bold text-sm text-slate-700">Documents</span>
              <span className="ml-2 text-xs text-slate-400">
                {docs.length} file{docs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-slate-400">Loading documents…</div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="text-2xl mb-1">📂</div>
              <div className="font-medium text-xs text-slate-600">No documents attached</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs"
                >
                  <span className="text-lg flex-shrink-0">{getFileIcon(doc.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate" title={doc.name}>{doc.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {formatSize(doc.fileSize)} · v{doc.version ?? 1}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500" title="Preview">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {canDelete(doc) && (
                      <button onClick={() => handleDelete(doc.id)} className="p-1 rounded-md hover:bg-red-50 text-red-500" title="Delete">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: upload form */}
        <div>
          <UploadDocumentModal
            isOpen={uploadOpen}
            onClose={() => setUploadOpen(false)}
            onSuccess={(doc) => { setDocs(prev => [doc, ...prev]); setUploadOpen(false); }}
            defaultEntityType={entityType}
            defaultEntityId={entityId}
            defaultDocumentType={defaultDocumentType}
            allowedDocumentTypes={allowedDocumentTypes}
            inline={true}
          />
        </div>

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
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-medium text-sm text-slate-700">Documents</span>
          <span className="ml-2 text-xs text-slate-400">
            {docs.length} file{docs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-medium hover:bg-[var(--primary-hover)]"
        >
          + Upload
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-slate-400">Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">📂</div>
          <div className="font-medium text-sm text-slate-600 mb-1">No documents attached</div>
          <div className="text-xs text-slate-400">
            Click <span className="font-medium text-[var(--primary)]">+ Upload</span> above to add files related to this {entityType === "SampleRequest" ? "sample" : entityType.toLowerCase()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              <span className="text-xl flex-shrink-0">{getFileIcon(doc.name)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-800 truncate">{doc.name}</div>
                <div className="text-xs text-slate-400 truncate">
                  {doc.documentCode} · {formatSize(doc.fileSize)} · v{doc.version ?? 1} · {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                </div>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_BADGE_COLORS[doc.documentType] ?? "bg-gray-100 text-gray-600"}`}>
                {doc.documentType}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setPreviewDoc(doc)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Preview">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <a href={doc.fileUrl} target="_blank" download={doc.name} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Download">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
                  </svg>
                </a>
                {canDelete(doc) && (
                  <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete">
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6" />
                    </svg>
                  </button>
                )}
                {user?.role !== "Customer" && (
                  <button
                    onClick={() => { setReplacingDocId(doc.id); replaceFileRef.current?.click(); }}
                    className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500"
                    title="Replace with new version"
                  >
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4v6h6M20 20v-6h-6M4 10a16 16 0 0114-6M20 14a16 16 0 01-14 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDocumentModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={(doc) => { setDocs(prev => [doc, ...prev]); setUploadOpen(false); }}
        defaultEntityType={entityType}
        defaultEntityId={entityId}
        defaultDocumentType={defaultDocumentType}
        allowedDocumentTypes={allowedDocumentTypes}
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

      <input
        ref={replaceFileRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceFile(f); }}
      />
    </div>
  );
}
