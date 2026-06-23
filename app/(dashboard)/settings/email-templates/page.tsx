"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2 M8 8h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z",
};

const modules = ["Quotation", "PO", "Negotiation", "Sample", "FollowUp", "General"];

const moduleColors: Record<string, string> = {
  Quotation: "bg-blue-50 text-blue-700",
  PO: "bg-purple-50 text-purple-700",
  Negotiation: "bg-amber-50 text-amber-700",
  Sample: "bg-green-50 text-green-700",
  FollowUp: "bg-pink-50 text-pink-700",
  General: "bg-gray-100 text-gray-700",
};

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "", module: "Quotation", isActive: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (moduleFilter) params.module = moduleFilter;
      const res = await fetch(`/api/email-templates?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setTemplates(data.data);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [moduleFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", subject: "", body: "", module: "Quotation", isActive: true });
    setEditorOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body, module: t.module, isActive: t.isActive });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required");
    if (!form.subject) return toast.error("Subject is required");
    if (!form.body) return toast.error("Body is required");
    setSaving(true);
    try {
      const url = editing ? `/api/email-templates/${editing.id}` : "/api/email-templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? "Template updated" : "Template created");
        setEditorOpen(false);
        load();
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (t: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Template",
      message: `Are you sure you want to delete "${t.name}"?`,
      action: async () => {
        try {
          const res = await fetch(`/api/email-templates/${t.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Template deleted");
            load();
          } else toast.error(data.message || "Failed to delete");
        } catch { toast.error("Failed to delete"); }
      },
    });
  };

  const insertVariable = (variable: string) => {
    setForm(f => ({ ...f, body: `${f.body} {{${variable}}}` }));
  };

  const variables = ["customerName", "dealName", "quoteCode", "poCode", "amount", "date", "userName", "companyName"];

  return (
    <PageContainer>
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <Ico d={icons.back} size={16} /> Back to Settings
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage email templates for quotation, PO, negotiation, and follow-up communications</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)]">
          <Ico d={icons.plus} size={16} /> New Template
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setModuleFilter("")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!moduleFilter ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>All</button>
        {modules.map(m => (
          <button key={m} onClick={() => setModuleFilter(m)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${moduleFilter === m ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{m}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">No templates found. Click "New Template" to create one.</div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${moduleColors[t.module] || moduleColors.General}`}>
                    {t.module}
                  </span>
                </div>
                {!t.isActive && (
                  <span className="text-xs text-gray-400">Inactive</span>
                )}
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1 truncate">Subject: {t.subject}</p>
              <p className="text-xs text-gray-500 line-clamp-3 mb-3">{t.body.substring(0, 150)}...</p>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => openEdit(t)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Ico d={icons.edit} size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(t)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline ml-auto">
                  <Ico d={icons.trash} size={13} /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editing ? "Edit Template" : "New Email Template"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Template Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Quotation Sent Notification" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Module *</label>
                <select value={form.module} onChange={e => setForm({...form, module: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
                <input type="text" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email subject line" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Body *</label>
                  <div className="flex flex-wrap gap-1">
                    {variables.slice(0, 5).map(v => (
                      <button key={v} type="button" onClick={() => insertVariable(v)} className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 font-mono">{`{{${v}}}`}</button>
                    ))}
                  </div>
                </div>
                <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={8} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email body. Use {{variable}} for dynamic content." />
                <p className="text-xs text-gray-400 mt-1">Available: {`{{customerName}}, {{dealName}}, {{quoteCode}}, {{poCode}}, {{amount}}, {{date}}, {{userName}}, {{companyName}}`}</p>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setEditorOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50">{saving ? "Saving..." : "Save Template"}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState({...confirmState, isOpen: false})} isDestructive />
    </PageContainer>
  );
}
