"use client";

import { useState, useEffect } from "react";
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
};

export default function LossReasonMasterPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [reasons, setReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loss-reasons");
      const data = await res.json();
      if (data.success) setReasons(data.data);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", isActive: true }); setEditorOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name, isActive: r.isActive }); setEditorOpen(true); };

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/loss-reasons/${editing.id}` : "/api/loss-reasons", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { toast.success(editing ? "Updated" : "Created"); setEditorOpen(false); load(); }
      else toast.error(data.message || "Save failed");
    } catch { toast.error("Save failed"); } finally { setSaving(false); }
  };

  const handleDelete = (r: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete loss reason",
      message: `Delete "${r.name}"? Linked lost-deal analyses will keep their text but lose the category link.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/loss-reasons/${r.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  return (
    <PageContainer className="space-y-4 p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Loss Reason Master</h1>
        <p className="text-sm text-slate-500 mt-0.5">Standardized reasons for categorizing lost deals</p>
      </div>
      <div className="flex justify-end mb-4">
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
            <Ico d={icons.plus} size={16} /> New Reason
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
      ) : reasons.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No loss reasons defined yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Used in analyses</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {reasons.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r._count?.lostDealAnalyses ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Ico d={icons.trash} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">{editing ? "Edit Reason" : "New Reason"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setEditorOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}
