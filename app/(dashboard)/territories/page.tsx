"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  search: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z",
  map: "M9 20l-5.45-2.73a1 1 0 01-.55-.9V4.62a1 1 0 011.45-.9L9 6 M9 20l6-3 M9 20V6 M15 17l5.45-2.73a1 1 0 00.55-.9V4.62a1 1 0 00-1.45-.9L15 6 M15 17V6 M15 6L9 3",
};

export default function TerritoriesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const [territories, setTerritories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", region: "", states: "", assignedUserId: "", isActive: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      const res = await fetch(`/api/territories?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setTerritories(data.data);
    } catch {
      toast.error("Failed to load territories");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setUsers(data.data ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); loadUsers(); }, [q]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", region: "", states: "", assignedUserId: "", isActive: true });
    setEditorOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, region: t.region, states: t.states || "", assignedUserId: t.assignedUserId || "", isActive: t.isActive });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required");
    if (!form.region) return toast.error("Region is required");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/territories/${editing.id}` : "/api/territories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? "Territory updated" : "Territory created");
        setEditorOpen(false);
        load();
      } else {
        toast.error(data.message || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (t: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete territory",
      message: `Delete "${t.name}"? This will also remove its account assignments.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/territories/${t.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Territory deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  // Regions view
  if (view === "regions") {
    const regionsMap = new Map<string, any[]>();
    territories.forEach(t => {
      const arr = regionsMap.get(t.region) || [];
      arr.push(t);
      regionsMap.set(t.region, arr);
    });

    return (
      <PageContainer className="space-y-4 p-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Regions Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">Territories grouped by region</p>
          </div>
          <Link href="/territories" className="text-sm text-blue-600 hover:underline">← List view</Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
        ) : regionsMap.size === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No territories found.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(regionsMap.entries()).map(([region, items]) => {
              const accountCount = items.reduce((s, t) => s + (t._count?.accounts ?? 0), 0);
              const usersList = items.map(t => t.assignedUser?.name).filter(Boolean);
              return (
                <div key={region} className="rounded-lg border bg-white p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Ico d={icons.map} size={18} className="text-blue-600" />
                    <h3 className="font-semibold text-slate-800">{region}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Territories</span><span className="font-medium">{items.length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Accounts</span><span className="font-medium">{accountCount}</span></div>
                    <div>
                      <span className="text-gray-500 block mb-1">Assigned Users</span>
                      <div className="flex flex-wrap gap-1">
                        {usersList.length ? usersList.map((u, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{u}</span>
                        )) : <span className="text-gray-400">Unassigned</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    {items.map(t => (
                      <Link key={t.id} href={`/territories/${t.id}`} className="block text-sm text-blue-600 hover:underline">{t.name}</Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Territories</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage sales territories and regional assignments</p>
        </div>
        <Link href="/territories?view=regions" className="text-sm text-blue-600 hover:underline">Regions view →</Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Ico d={icons.search} size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search territories..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
            <Ico d={icons.plus} size={16} /> Add Territory
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
      ) : territories.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No territories found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">States / Area</th>
                <th className="px-4 py-3 font-semibold">Assigned User</th>
                <th className="px-4 py-3 font-semibold">Accounts</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {territories.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/territories/${t.id}`} className="font-medium text-blue-600 hover:underline">{t.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.region}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs"><div className="line-clamp-1">{t.states || "—"}</div></td>
                  <td className="px-4 py-3 text-gray-600">{t.assignedUser?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{t._count?.accounts ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></button>
                          <button onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Ico d={icons.trash} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">{editing ? "Edit Territory" : "New Territory"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Region *</label>
                <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. South, North, West..." className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">States / Area (comma-separated)</label>
                <input value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} placeholder="e.g. Tamil Nadu, Karnataka, Kerala" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned User</label>
                <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Unassigned —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
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
