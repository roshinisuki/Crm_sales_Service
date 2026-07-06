"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  replace: "M4 4v6h6M20 20v-6h-6M4 10a16 16 0 0114-6M20 14a16 16 0 01-14 6",
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

const ENTITY_LABELS: Record<string, string> = {
  Customer: "Account",
  Deal: "Deal",
  RFQ: "RFQ",
  Quotation: "Quotation",
  PurchaseOrder: "PO",
  Negotiation: "Negotiation",
  SampleRequest: "Sample",
  Product: "Product",
};

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

interface DocumentRowProps {
  doc: any;
  onPreview?: (doc: any) => void;
  onDelete?: (id: string) => void;
  onReplaced?: () => void;
  showEntityLabel?: boolean;
}

export default function DocumentRow({ doc, onPreview, onDelete, onReplaced, showEntityLabel }: DocumentRowProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const canDelete = user?.role === "Admin" || user?.role === "SalesManager" || doc.uploadedById === user?.id;
  const canRevise = user?.role !== "Customer";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-lg flex-shrink-0">
        {getFileIcon(doc.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-800 truncate">{doc.name}</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_BADGE_COLORS[doc.documentType] ?? "bg-gray-100 text-gray-600"}`}>
            {doc.documentType}
          </span>
          {showEntityLabel && doc.entityType && (
            <span className="inline-flex px-1.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 flex-shrink-0">
              {ENTITY_LABELS[doc.entityType] || doc.entityType}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 truncate mt-1">
          <span className="font-mono">{doc.documentCode}</span> · {formatSize(doc.fileSize)} · v{doc.version ?? 1} · {doc.uploadedBy?.name || "—"} · {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onPreview && (
          <button onClick={() => onPreview(doc)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Preview">
            <Ico d={icons.eye} size={15} />
          </button>
        )}
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
        {canDelete && onDelete && (
          <button onClick={() => onDelete(doc.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete">
            <Ico d={icons.trash} size={15} />
          </button>
        )}
        {canRevise && onReplaced && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  const fd = new FormData();
                  fd.append("file", f);
                  const res = await fetch(`/api/documents/${doc.id}/revision`, { method: "POST", body: fd });
                  const data = await res.json();
                  if (data.success) {
                    onReplaced();
                  } else {
                    alert(data.message || "Failed to upload new version");
                  }
                } catch {
                  alert("Failed to upload new version");
                } finally {
                  setUploading(false);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 disabled:opacity-50 transition-colors"
              title="Replace with new version"
            >
              <Ico d={icons.replace} size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
