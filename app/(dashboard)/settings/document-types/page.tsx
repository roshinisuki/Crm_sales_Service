"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import PageContainer from "@/components/PageContainer";
import { Plus, Trash2, Save, FileText } from "lucide-react";

interface DocType {
  id: string;
  label: string;
  value: string;
  entityType: string;
}

const entityTypes = ["SampleRequest", "Negotiation", "PurchaseOrder", "Quotation", "RFQ", "Customer", "Product", "Deal", "General"];

const defaultDocTypes: DocType[] = [
  { id: "dt_1", label: "Sample", value: "Sample", entityType: "SampleRequest" },
  { id: "dt_2", label: "Negotiation", value: "Negotiation", entityType: "Negotiation" },
  { id: "dt_3", label: "Purchase Order", value: "PurchaseOrder", entityType: "PurchaseOrder" },
  { id: "dt_4", label: "Quotation", value: "Quotation", entityType: "Quotation" },
  { id: "dt_5", label: "RFQ", value: "RFQ", entityType: "RFQ" },
  { id: "dt_6", label: "Customer Document", value: "Customer", entityType: "Customer" },
  { id: "dt_7", label: "Product Document", value: "Product", entityType: "Product" },
  { id: "dt_8", label: "Contract", value: "Contract", entityType: "Deal" },
  { id: "dt_9", label: "Invoice", value: "Invoice", entityType: "General" },
  { id: "dt_10", label: "Agreement", value: "Agreement", entityType: "General" },
  { id: "dt_11", label: "Brochure", value: "Brochure", entityType: "Product" },
  { id: "dt_12", label: "Other", value: "Other", entityType: "General" },
];

export default function DocumentTypesSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-configs");
      const data = await res.json();
      if (data.success) {
        const config = data.data.find((c: any) => c.key === "documentTypes");
        if (config) {
          setDocTypes(JSON.parse(config.value));
        } else {
          setDocTypes(defaultDocTypes);
        }
      }
    } catch {
      toast.error("Failed to load document types");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ key: "documentTypes", value: JSON.stringify(docTypes) }],
        }),
      });
      const data = await res.json();
      if (data.success) toast.success("Document types saved");
      else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addType = () => {
    setDocTypes([...docTypes, {
      id: `dt_${Date.now()}`,
      label: "",
      value: "",
      entityType: "General",
    }]);
  };

  const updateType = (id: string, key: keyof DocType, value: string) => {
    setDocTypes(docTypes.map((d) => (d.id === id ? { ...d, [key]: value } : d)));
  };

  const removeType = (id: string) => {
    setDocTypes(docTypes.filter((d) => d.id !== id));
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={24} className="text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Document Types</h1>
        </div>
        <p className="text-slate-500">Manage document type categories used when uploading documents across the CRM.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="space-y-3 mb-6">
          {docTypes.map((dt) => (
            <div key={dt.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Display Label</label>
                <input
                  type="text"
                  value={dt.label}
                  onChange={(e) => updateType(dt.id, "label", e.target.value)}
                  placeholder="e.g. Warranty Card"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Internal Value</label>
                <input
                  type="text"
                  value={dt.value}
                  onChange={(e) => updateType(dt.id, "value", e.target.value)}
                  placeholder="e.g. Warranty"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Associated Entity</label>
                <select
                  value={dt.entityType}
                  onChange={(e) => updateType(dt.id, "entityType", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex justify-end">
                <button onClick={() => removeType(dt.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addType} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <Plus size={16} /> Add Document Type
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
            <Save size={16} /> {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
