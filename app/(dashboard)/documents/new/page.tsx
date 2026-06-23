"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
};

const documentTypes = [
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

const entityTypes = [
  { value: "Customer", label: "Customer", api: "/api/customer-master", codeField: "customerCode", nameField: "name" },
  { value: "Deal", label: "Deal", api: "/api/deals", codeField: "dealName", nameField: "dealName" },
  { value: "RFQ", label: "RFQ", api: "/api/rfq", codeField: "rfqCode", nameField: "title" },
  { value: "PurchaseOrder", label: "Purchase Order", api: "/api/purchase-orders", codeField: "poCode", nameField: "poCode" },
  { value: "Negotiation", label: "Negotiation", api: "/api/negotiations", codeField: "negotiationCode", nameField: "negotiationCode" },
  { value: "Quotation", label: "Quotation", api: "/api/quotations", codeField: "quotationCode", nameField: "quotationCode" },
  { value: "SampleRequest", label: "Sample Request", api: "/api/samples", codeField: "sampleCode", nameField: "sampleCode" },
];

export default function NewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    documentType: searchParams.get("type") || "Drawing",
    entityType: searchParams.get("entityType") || "Customer",
    entityId: searchParams.get("entityId") || "",
    customerId: "",
    description: "",
    tags: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    fetch("/api/customer-master").then(res => res.json()).then(data => {
      if (data.success) setCustomers(data.data || []);
    });
  }, []);

  // Load entities when entity type changes
  useEffect(() => {
    setEntities([]);
    setForm(f => ({ ...f, entityId: "" }));
    const entityType = entityTypes.find(e => e.value === form.entityType);
    if (entityType) {
      fetch(entityType.api).then(res => res.json()).then(data => {
        if (data.success) setEntities(data.data || []);
      });
    }
  }, [form.entityType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    // Convert file to base64 data URL for storage
    const reader = new FileReader();
    reader.onload = () => {
      setFileUrl(reader.result as string);
    };
    reader.readAsDataURL(selected);
    if (!form.name) {
      setForm(f => ({ ...f, name: selected.name.replace(/\.[^/.]+$/, "") }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error("Name is required");
    if (!form.documentType) return toast.error("Document type is required");
    if (!form.entityType) return toast.error("Related entity type is required");
    if (!form.entityId) return toast.error("Please select a related entity");
    if (!fileUrl) return toast.error("Please upload a file");

    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          documentType: form.documentType,
          entityType: form.entityType,
          entityId: form.entityId,
          customerId: form.customerId || null,
          description: form.description || null,
          tags: form.tags || null,
          fileUrl,
          fileSize: file?.size,
          mimeType: file?.type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Document uploaded successfully");
        router.push("/documents");
      } else {
        toast.error(data.message || "Failed to upload document");
      }
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <Ico d={icons.back} size={16} /> Back
      </button>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload Document</h1>
        <p className="text-sm text-gray-500 mb-6">Upload a new document and link it to a record</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-xl p-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">File *</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[var(--primary)]/40 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <Ico d={icons.upload} size={20} />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Click to upload</p>
                      <p className="text-xs text-gray-500">PDF, DOC, XLS, images up to 10MB</p>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              placeholder="e.g. Customer NDA - Acme Corp"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Type *</label>
            <select
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              {documentTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Related To *</label>
            <select
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              {entityTypes.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          {/* Entity Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Record *</label>
            <select
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              <option value="">— Select —</option>
              {entities.map((ent: any) => {
                const et = entityTypes.find(e => e.value === form.entityType);
                const code = et?.codeField ? ent[et.codeField] : "";
                const name = et?.nameField ? ent[et.nameField] : "";
                return (
                  <option key={ent.id} value={ent.id}>
                    {code ? `${code} — ${name}` : name || ent.id}
                  </option>
                );
              })}
            </select>
            {entities.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No records found for this entity type</p>
            )}
          </div>

          {/* Customer (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Link to Customer (optional)</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              <option value="">— None —</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.customerCode} — {c.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              placeholder="Optional notes about this document"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              placeholder="e.g. confidential, signed, draft"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Uploading..." : "Upload Document"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
