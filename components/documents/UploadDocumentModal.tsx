"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DOCUMENT_TYPES = [
  "Drawing",
  "TechnicalSpec",
  "NDA",
  "Quotation",
  "PurchaseOrder",
  "Agreement",
  "Brochure",
  "Invoice",
  "Contract",
  "Other",
];

const ENTITY_TYPES = [
  { value: "Customer", label: "Customer", api: "/api/customer-master", codeField: "customerCode", nameField: "name" },
  { value: "Deal", label: "Opportunity/Deal", api: "/api/deals", codeField: "dealName", nameField: "dealName" },
  { value: "RFQ", label: "RFQ", api: "/api/rfq", codeField: "rfqCode", nameField: "title" },
  { value: "Quotation", label: "Quotation", api: "/api/quotations", codeField: "quotationCode", nameField: "quotationCode" },
  { value: "PurchaseOrder", label: "Purchase Order", api: "/api/purchase-orders", codeField: "poCode", nameField: "poCode" },
  { value: "SampleRequest", label: "Sample Request", api: "/api/samples", codeField: "sampleCode", nameField: "sampleCode" },
];

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (doc: any) => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultDocumentType?: string;
  allowedDocumentTypes?: string[];
  inline?: boolean;
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultEntityType,
  defaultEntityId,
  defaultDocumentType,
  allowedDocumentTypes,
  inline = false,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState(defaultDocumentType || "Drawing");
  const [entityType, setEntityType] = useState(defaultEntityType || "Customer");
  const [entityId, setEntityId] = useState(defaultEntityId || "");
  const [description, setDescription] = useState("");
  const [entities, setEntities] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docTypes = allowedDocumentTypes
    ? DOCUMENT_TYPES.filter(t => allowedDocumentTypes.includes(t))
    : DOCUMENT_TYPES;

  const resetForm = useCallback(() => {
    setFile(null);
    setName("");
    setDocumentType(defaultDocumentType || "Drawing");
    setEntityType(defaultEntityType || "Customer");
    setEntityId(defaultEntityId || "");
    setDescription("");
    setError("");
    setEntities([]);
  }, [defaultDocumentType, defaultEntityType, defaultEntityId]);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm]);

  // Load entities when entity type changes (skip if defaultEntityId is locked)
  useEffect(() => {
    if (!isOpen) return;
    if (defaultEntityType && defaultEntityId) return; // locked
    setEntities([]);
    setEntityId("");
    const et = ENTITY_TYPES.find(e => e.value === entityType);
    if (!et) return;
    setLoadingEntities(true);
    fetch(et.api)
      .then(res => res.json())
      .then(data => {
        if (data.success) setEntities(data.data || []);
      })
      .catch(() => setEntities([]))
      .finally(() => setLoadingEntities(false));
  }, [entityType, isOpen, defaultEntityType, defaultEntityId]);

  const handleFileSelect = (selected: File) => {
    if (selected.size > 20 * 1024 * 1024) {
      setError("File size exceeds 20MB limit");
      return;
    }
    setError("");
    setFile(selected);
    if (!name) {
      setName(selected.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
  };

  const handleSubmit = async () => {
    if (!file) { setError("Please select a file"); return; }
    if (!name) { setError("Document name is required"); return; }
    if (!entityType) { setError("Entity type is required"); return; }
    if (!entityId) { setError("Please select a related entity"); return; }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("documentType", documentType);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      if (description) formData.append("description", description);

      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
        onClose();
      } else {
        setError(data.message || "Upload failed");
      }
    } catch {
      setError("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const isEntityLocked = !!(defaultEntityType && defaultEntityId);
  const lockedEntityLabel = ENTITY_TYPES.find(e => e.value === defaultEntityType)?.label ?? defaultEntityType;

  const renderFormContent = () => (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800">Upload Document</h2>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xl leading-none">&times;</button>
      </div>

      <div className="p-6 space-y-5">
        {/* File Drop Zone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">File *</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragOver ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-slate-300 hover:border-[var(--primary)]/40 hover:bg-slate-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1">
                <div className="text-3xl mb-1">📄</div>
                <p className="text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB {file.type && `· ${file.type}`}
                </p>
                <p className="text-xs text-[var(--primary)] mt-1">Click to change file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="text-3xl mb-1 text-slate-300">📁</div>
                <p className="text-sm font-medium text-slate-700">Drag & drop or click to browse</p>
                <p className="text-xs text-slate-500 mt-0.5">PDF, DOC, XLS, images up to 20MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Document Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            placeholder="e.g. Customer NDA — Acme Corp"
          />
        </div>

        {/* Document Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Type *</label>
          <select
            value={documentType}
            onChange={e => setDocumentType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          >
            {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Entity Link */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Related To *</label>
          {isEntityLocked ? (
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)]">
                {lockedEntityLabel}
              </span>
              <span className="text-xs text-slate-400">(linked automatically)</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <select
                value={entityType}
                onChange={e => setEntityType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                {ENTITY_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="">— Select —</option>
                {loadingEntities && <option disabled>Loading…</option>}
                {entities.map((ent: any) => {
                  const et = ENTITY_TYPES.find(e => e.value === entityType);
                  const code = et?.codeField ? ent[et.codeField] : "";
                  const nm = et?.nameField ? ent[et.nameField] : "";
                  return (
                    <option key={ent.id} value={ent.id}>
                      {code ? `${code} — ${nm}` : nm || ent.id}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            placeholder="Optional notes about this document"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={onClose}
          className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
        >
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full overflow-hidden">
        {renderFormContent()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {renderFormContent()}
      </div>
    </div>
  );
}
