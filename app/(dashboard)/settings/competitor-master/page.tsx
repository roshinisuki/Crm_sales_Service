"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  x: "M6 18L18 6M6 6l12 12",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  save: "M5 13l4 4L19 7",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
};

export default function CompetitorMasterSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", website: "", strengths: "", weaknesses: "", isActive: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/competitors");
      const data = await res.json();
      if (data.success) setCompetitors(data.data);
    } catch {
      toast.error("Failed to load competitors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = competitors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.website?.toLowerCase().includes(q);
  });

  const activeCount = competitors.filter((c) => c.isActive).length;
  const inactiveCount = competitors.length - activeCount;

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Competitor updated");
        setEditingId(null);
        load();
      } else {
        toast.error(data.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, website: c.website || "", strengths: c.strengths || "", weaknesses: c.weaknesses || "", isActive: c.isActive });
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Competitor Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage competitor master data and configuration</p>
        </div>
        <button
          onClick={() => router.push("/competitors")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
        >
          <Ico d={icons.external} size={16} /> Full Competitors Module
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-sm text-slate-500">Total Competitors</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{competitors.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{inactiveCount}</p>
        </div>
      </div>

      <div className="relative">
        <Ico d={icons.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search competitors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Website</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Strengths</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No competitors found</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {editingId === c.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editForm.strengths} onChange={(e) => setEditForm({ ...editForm, strengths: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={editForm.isActive ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })} className="px-2 py-1 rounded border border-slate-200 text-sm">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleSave(c.id)} disabled={saving} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 cursor-pointer mr-1" title="Save">
                          <Ico d={icons.save} size={15} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Cancel">
                          <Ico d={icons.x} size={15} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{c.website}</a> : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{c.strengths || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer" title="Edit">
                          <Ico d={icons.edit} size={15} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
