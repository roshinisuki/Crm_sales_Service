"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import PageContainer from "@/components/PageContainer";
import { Plus, Trash2, Save, Settings } from "lucide-react";

interface CustomField {
  id: string;
  label: string;
  entityType: string;
  fieldType: string;
  options?: string;
  required: boolean;
}

const entityTypes = ["Customer", "Deal", "Lead", "Contact", "Product", "RFQ", "Quotation"];
const fieldTypes = ["text", "number", "date", "select", "textarea", "checkbox"];

export default function CustomFieldsSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-configs");
      const data = await res.json();
      if (data.success) {
        const config = data.data.find((c: any) => c.key === "customFields");
        if (config) {
          setFields(JSON.parse(config.value));
        }
      }
    } catch {
      toast.error("Failed to load custom fields");
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
          updates: [{ key: "customFields", value: JSON.stringify(fields) }],
        }),
      });
      const data = await res.json();
      if (data.success) toast.success("Custom fields saved");
      else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    setFields([...fields, {
      id: `field_${Date.now()}`,
      label: "",
      entityType: "Customer",
      fieldType: "text",
      required: false,
    }]);
  };

  const updateField = (id: string, key: keyof CustomField, value: any) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
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
          <Settings size={24} className="text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Custom Fields</h1>
        </div>
        <p className="text-slate-500">Configure custom fields for CRM entities. Fields will appear on create/edit forms.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        {fields.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">No custom fields configured yet.</p>
            <button onClick={addField} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer">
              <Plus size={16} /> Add First Field
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {fields.map((field) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Field Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, "label", e.target.value)}
                      placeholder="e.g. Industry Type"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Entity</label>
                    <select
                      value={field.entityType}
                      onChange={(e) => updateField(field.id, "entityType", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    >
                      {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Field Type</label>
                    <select
                      value={field.fieldType}
                      onChange={(e) => updateField(field.id, "fieldType", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    >
                      {fieldTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Options (comma-separated)</label>
                    <input
                      type="text"
                      value={field.options || ""}
                      onChange={(e) => updateField(field.id, "options", e.target.value)}
                      placeholder="Only for select type"
                      disabled={field.fieldType !== "select"}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, "required", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      Required
                    </label>
                    <button onClick={() => removeField(field.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={addField} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                <Plus size={16} /> Add Field
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer">
                <Save size={16} /> {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
