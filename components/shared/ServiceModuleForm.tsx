"use client";

import React, { useState } from "react";
import { ServiceModuleConfig } from "@/lib/config/serviceModuleConfig";
import { X } from "lucide-react";

interface ServiceModuleFormProps {
  config: ServiceModuleConfig;
  initialData?: any;
  onSubmit: (formData: Record<string, any>) => void;
  onCancel: () => void;
  relationsData?: Record<string, { value: string; label: string }[]>; // Holds data for selector inputs e.g. Customer lists
}

export default function ServiceModuleForm({
  config,
  initialData,
  onSubmit,
  onCancel,
  relationsData = {},
}: ServiceModuleFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    config.formFields.forEach(f => {
      initial[f.id] = initialData?.[f.id] ?? (f.type === "boolean" ? false : "");
    });
    return initial;
  });

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h3 className="text-sm font-black text-[var(--text-primary)]">
          {initialData ? "Edit" : "Create"} {config.entityLabel}
        </h3>
        <button onClick={onCancel} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {config.formFields.map(f => {
            const isRelation = f.type === "relation";
            const options = isRelation ? (relationsData[f.relationModel || ""] || []) : (f.options || []);

            return (
              <div key={f.id} className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>

                {f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    value={formData[f.id] || ""}
                    onChange={e => handleChange(f.id, e.target.value)}
                    rows={3}
                    placeholder={`Enter ${f.label.toLowerCase()}...`}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                  />
                ) : f.type === "select" || isRelation ? (
                  <select
                    required={f.required}
                    value={formData[f.id] || ""}
                    onChange={e => handleChange(f.id, e.target.value)}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select {f.label}...</option>
                    {options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`bool-${f.id}`}
                      checked={!!formData[f.id]}
                      onChange={e => handleChange(f.id, e.target.checked)}
                      className="rounded border-[var(--border)] bg-[var(--surface-2)] text-blue-600 focus:ring-0"
                    />
                    <label htmlFor={`bool-${f.id}`} className="text-xs text-[var(--text-secondary)]">
                      Enabled
                    </label>
                  </div>
                ) : f.type === "date" ? (
                  <input
                    type="date"
                    required={f.required}
                    value={formData[f.id] || ""}
                    onChange={e => handleChange(f.id, e.target.value)}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    required={f.required}
                    value={formData[f.id] || ""}
                    onChange={e => handleChange(f.id, e.target.value)}
                    placeholder={`Enter ${f.label.toLowerCase()}...`}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
          >
            Save {config.entityLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
