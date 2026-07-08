"use client";

import React, { useEffect, useState } from "react";
import { 
  getServiceSettingsAction, 
  createServiceSettingsAction, 
  updateServiceSettingsAction, 
  deleteServiceSettingsAction 
} from "@/app/actions/serviceSettings";
import { DataTable, type ColumnDef } from "./DataTable";
import { Plus, Edit, Trash2, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface SettingsField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "color" | "date";
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface ServiceSettingsCRUDProps {
  modelName: string;
  title: string;
  fields: SettingsField[];
}

export default function ServiceSettingsCRUD({ modelName, title, fields }: ServiceSettingsCRUDProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    const res = await getServiceSettingsAction(modelName);
    if (res.success) {
      setData(res.data || []);
    } else {
      toast.error(res.message || "Failed to load data");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelName]);

  const handleOpenCreate = () => {
    const initialForm: Record<string, any> = {};
    fields.forEach(f => {
      initialForm[f.id] = f.type === "boolean" ? true : f.type === "number" ? 0 : "";
    });
    setFormData(initialForm);
    setCurrentEditId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    const editForm: Record<string, any> = {};
    fields.forEach(f => {
      editForm[f.id] = row[f.id] ?? (f.type === "boolean" ? true : f.type === "number" ? 0 : "");
    });
    setFormData(editForm);
    setCurrentEditId(row.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this setting?")) return;
    const res = await deleteServiceSettingsAction(modelName, id);
    if (res.success) {
      toast.success(res.message || "Setting deleted successfully");
      loadData();
    } else {
      toast.error(res.message || "Failed to delete setting");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let res;
    if (currentEditId) {
      res = await updateServiceSettingsAction(modelName, currentEditId, formData);
    } else {
      res = await createServiceSettingsAction(modelName, formData);
    }

    if (res.success) {
      toast.success(res.message || "Setting saved successfully");
      setIsModalOpen(false);
      loadData();
    } else {
      toast.error(res.message || "Failed to save setting");
    }
  };

  const handleToggleActive = async (row: any) => {
    const res = await updateServiceSettingsAction(modelName, row.id, { isActive: !row.isActive });
    if (res.success) {
      toast.success("Status updated");
      loadData();
    } else {
      toast.error(res.message || "Failed to update status");
    }
  };

  const columns: ColumnDef<any>[] = [
    ...fields.map(f => ({
      header: f.label,
      accessorKey: f.id,
      cell: (row: any) => {
        const val = row[f.id];
        if (f.type === "boolean") {
          return val ? (
            <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold"><Check size={14}/> Yes</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold"><X size={14}/> No</span>
          );
        }
        if (f.type === "color") {
          return (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-[var(--border)]" style={{ backgroundColor: val }} />
              <span className="font-mono text-xs">{val}</span>
            </div>
          );
        }
        return <span className="text-xs">{val?.toString() || "-"}</span>;
      }
    })),
    {
      header: "Active",
      accessorKey: "isActive",
      cell: (row: any) => (
        <button 
          onClick={() => handleToggleActive(row)}
          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
            row.isActive 
              ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" 
              : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
          }`}
        >
          {row.isActive ? "Active" : "Inactive"}
        </button>
      )
    },
    {
      header: "Actions",
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-all"
            title="Edit"
          >
            <Edit size={14} />
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            className="p-1.5 rounded-lg border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">{title} Settings</h2>
          <p className="text-xs text-[var(--text-muted)]">Manage default metadata options and behaviors for service modules.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors"
        >
          <Plus size={14} /> Add {title}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-md">
          <DataTable data={data} columns={columns} />
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121214] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">{currentEditId ? "Edit" : "Add"} {title}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {fields.map(f => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea 
                      required={f.required}
                      value={formData[f.id] || ""}
                      onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                      rows={3}
                      className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  ) : f.type === "select" ? (
                    <select
                      required={f.required}
                      value={formData[f.id] || ""}
                      onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">Select option...</option>
                      {f.options?.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id={`bool-${f.id}`}
                        checked={!!formData[f.id]}
                        onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.checked }))}
                        className="rounded border-white/10 bg-white/5 text-blue-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <label htmlFor={`bool-${f.id}`} className="text-xs text-white/80">Enabled</label>
                    </div>
                  ) : (
                    <input 
                      type={f.type === "number" ? "number" : "text"}
                      required={f.required}
                      value={formData[f.id] || ""}
                      onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
