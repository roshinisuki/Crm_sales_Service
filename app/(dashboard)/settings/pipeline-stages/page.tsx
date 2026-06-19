"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const icons = { plus: "M12 4v16m8-8H4", up: "M5 15l7-7 7 7", down: "M19 9l-7 7-7-7", x: "M6 18L18 6M6 6l12 12", edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6" };

export default function PipelineStagesSettingsPage() {
  const toast = useToast();
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editStage, setEditStage] = useState<any>(null);
  const [form, setForm] = useState({ name: "", color: "#378ADD" });

  const loadStages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/pipeline-stages");
      const data = await res.json();
      if (data.success) setStages(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStages(); }, []);

  const handleAdd = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    try {
      const res = await fetch("/api/settings/pipeline-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { toast.success("Stage added"); setShowAdd(false); setForm({ name: "", color: "#378ADD" }); loadStages(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleEdit = async () => {
    if (!editStage || !form.name) return;
    try {
      const res = await fetch(`/api/settings/pipeline-stages/${editStage.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, color: form.color }) });
      const data = await res.json();
      if (data.success) { toast.success("Updated"); setEditStage(null); setForm({ name: "", color: "#378ADD" }); loadStages(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleToggleActive = async (stage: any) => {
    try {
      const res = await fetch(`/api/settings/pipeline-stages/${stage.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !stage.isActive }) });
      const data = await res.json();
      if (data.success) { toast.success(`${stage.isActive ? "Deactivated" : "Activated"}`); loadStages(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const handleMove = async (stage: any, direction: "up" | "down") => {
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;
    const swapStage = stages[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/settings/pipeline-stages/${stage.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swapStage.order }) }),
        fetch(`/api/settings/pipeline-stages/${swapStage.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: stage.order }) }),
      ]);
      loadStages();
    } catch { toast.error("Failed to reorder"); }
  };

  const handleDelete = async (stage: any) => {
    if (!confirm(`Delete stage "${stage.name}"?`)) return;
    try {
      const res = await fetch(`/api/settings/pipeline-stages/${stage.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { toast.success("Deleted"); loadStages(); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
  };

  const openEdit = (stage: any) => {
    setEditStage(stage);
    setForm({ name: stage.name, color: stage.color });
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Pipeline Stages</h1><p className="text-sm text-slate-500 mt-0.5">Configure deal pipeline stages</p></div>
        <button onClick={() => { setShowAdd(true); setForm({ name: "", color: "#378ADD" }); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.plus} size={16} /> Add Stage</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Order</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Stage Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Color</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Active</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : stages.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">No stages configured</td></tr>
            : stages.map((stage, idx) => (
              <tr key={stage.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${!stage.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleMove(stage, "up")} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"><Ico d={icons.up} size={14} /></button>
                    <span className="text-sm text-slate-600 w-6">{stage.order}</span>
                    <button onClick={() => handleMove(stage, "down")} disabled={idx === stages.length - 1} className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"><Ico d={icons.down} size={14} /></button>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{stage.name}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full" style={{ backgroundColor: stage.color }} /><span className="text-xs text-slate-500">{stage.color}</span></div></td>
                <td className="px-4 py-3 text-center"><button onClick={() => handleToggleActive(stage)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${stage.isActive ? "bg-green-500" : "bg-slate-300"}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${stage.isActive ? "translate-x-5" : "translate-x-1"}`} /></button></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(stage)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.edit} size={15} /></button>
                    <button onClick={() => handleDelete(stage)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Ico d={icons.x} size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editStage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-slate-800">{editStage ? "Edit Stage" : "Add Stage"}</h3>
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" /></div>
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Color</label><div className="flex items-center gap-3"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" /><input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" /></div></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowAdd(false); setEditStage(null); }} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={editStage ? handleEdit : handleAdd} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer">{editStage ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
