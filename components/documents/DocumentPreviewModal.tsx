"use client";

import { useAuth } from "@/components/AuthProvider";

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  ppt: "📽", pptx: "📽", jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼",
  webp: "🖼", dwg: "📐", zip: "📦", rar: "📦", txt: "📃", csv: "📋",
};

function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "📎";
}

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
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

interface DocumentPreviewModalProps {
  document: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function DocumentPreviewModal({ document: doc, isOpen, onClose, onDelete }: DocumentPreviewModalProps) {
  const { user } = useAuth();
  if (!isOpen || !doc) return null;

  const ext = getFileExtension(doc.name || "");
  const canDelete = user?.role === "Admin" || user?.role === "SalesManager" || doc.uploadedById === user?.id;

  const renderPreview = () => {
    if (ext === "pdf") {
      return <iframe src={doc.fileUrl} className="w-full h-[520px] border-none rounded-lg" />;
    }
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
      return (
        <div className="flex items-center justify-center bg-slate-50 rounded-lg p-4" style={{ minHeight: 520 }}>
          <img src={doc.fileUrl} alt={doc.name} className="max-w-full max-h-[520px] object-contain rounded-lg" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg gap-4" style={{ minHeight: 400 }}>
        <div className="text-6xl">{getFileIcon(doc.name)}</div>
        <div className="font-medium text-sm text-slate-700">{doc.name}</div>
        <div className="text-xs text-slate-500">Preview not available for .{ext} files</div>
        <a
          href={doc.fileUrl}
          target="_blank"
          download={doc.name}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)]"
        >
          ⬇ Download to View
        </a>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 truncate">{doc.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — metadata */}
          <div className="w-1/3 border-r border-slate-100 p-5 overflow-y-auto space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">{getFileIcon(doc.name)}</div>
              <div className="font-semibold text-sm text-slate-800">{doc.documentCode}</div>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-xs font-medium text-slate-500">Type</span>
                <div className="mt-0.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[doc.documentType] ?? "bg-gray-100 text-gray-600"}`}>
                    {doc.documentType}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Version</span>
                <p className="text-sm text-slate-700">v{doc.version ?? 1}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">File Size</span>
                <p className="text-sm text-slate-700">{formatSize(doc.fileSize)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Uploaded By</span>
                <p className="text-sm text-slate-700">{doc.uploadedBy?.name ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Uploaded Date</span>
                <p className="text-sm text-slate-700">
                  {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              {doc.relatedEntityName && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Related To</span>
                  <p className="text-sm text-slate-700">{doc.relatedEntityName}</p>
                </div>
              )}
              {doc.description && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Description</span>
                  <p className="text-sm text-slate-600 mt-0.5">{doc.description}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={doc.fileUrl}
                target="_blank"
                download={doc.name}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium text-center hover:bg-[var(--primary-hover)]"
              >
                ⬇ Download
              </a>
              {canDelete && onDelete && (
                <button
                  onClick={() => { onDelete(doc.id); onClose(); }}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex-1 p-5 overflow-auto">
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
