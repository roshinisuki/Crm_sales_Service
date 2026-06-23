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
  search: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z",
};

export default function LostAnalysisPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [lostDeals, setLostDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompetitor, setFilterCompetitor] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ dealId: "", competitorId: "", lossReasonId: "", lostReason: "", competitorWonPrice: "", ourFinalPrice: "", lessonsLearned: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterCompetitor) params.competitorId = filterCompetitor;
      if (filterReason) params.lossReasonId = filterReason;
      const [aRes, cRes, rRes, dRes] = await Promise.all([
        fetch(`/api/competitors/lost-analysis?${new URLSearchParams(params)}`),
        fetch("/api/competitors"),
        fetch("/api/loss-reasons"),
        fetch("/api/deals?status=Lost"),
      ]);
      const [a, c, r, d] = await Promise.all([aRes.json(), cRes.json(), rRes.json(), dRes.json()]);
      if (a.success) setAnalyses(a.data);
      if (c.success) setCompetitors(c.data);
      if (r.success) setLossReasons(r.data);
      if (d.success) setLostDeals(d.data);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterCompetitor, filterReason]);

  const openNew = () => {
    setEditing(null);
    setForm({ dealId: "", competitorId: "", lossReasonId: "", lostReason: "", competitorWonPrice: "", ourFinalPrice: "", lessonsLearned: "" });
    setEditorOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      dealId: a.dealId,
      competitorId: a.competitorId || "",
      lossReasonId: a.lossReasonId || "",
      lostReason: a.lostReason,
      competitorWonPrice: a.competitorWonPrice?.toString() || "",
      ourFinalPrice: a.ourFinalPrice?.toString() || "",
      lessonsLearned: a.lessonsLearned || "",
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.dealId) return toast.error("Select a lost deal");
    if (!form.lostReason) return toast.error("Lost reason is required");
    setSaving(true);
    try {
      const payload = {
        dealId: form.dealId,
        competitorId: form.competitorId || null,
        lossReasonId: form.lossReasonId || null,
        lostReason: form.lostReason,
        competitorWonPrice: form.competitorWonPrice ? parseFloat(form.competitorWonPrice) : null,
        ourFinalPrice: form.ourFinalPrice ? parseFloat(form.ourFinalPrice) : null,
        lessonsLearned: form.lessonsLearned || null,
      };
      const res = await fetch(editing ? `/api/competitors/lost-analysis/${editing.id}` : "/api/competitors/lost-analysis", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? "Analysis updated" : "Analysis recorded");
        setEditorOpen(false);
        load();
      } else toast.error(data.message || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (a: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete analysis",
      message: "Delete this lost-deal analysis record?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/competitors/lost-analysis/${a.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager", "SalesRep"].includes(user?.role ?? "");

  return (
    <PageContainer className="space-y-4 p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lost Deals Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Record and review why deals were lost</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterCompetitor} onChange={(e) => setFilterCompetitor(e.target.value)} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All competitors</option>
          {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All loss reasons</option>
          {lossReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] ml-auto">
            <Ico d={icons.plus} size={16} /> Record Lost Deal
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
      ) : analyses.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No lost-deal analyses recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => (
            <div key={a.id} className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{a.deal?.dealName || "Untitled deal"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.deal?.customer?.name || "—"} · {a.competitor?.name ? `Lost to ${a.competitor.name}` : "No competitor"} · {a.lossReason?.name || "No reason category"}
                  </div>
                </div>
                {canManage && (
                  <div className="inline-flex gap-1.5">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></button>
                    <button onClick={() => handleDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Ico d={icons.trash} /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.lostReason}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                <div><span className="text-gray-500">Their price:</span> <span className="font-medium">{a.competitorWonPrice != null ? `$${a.competitorWonPrice.toLocaleString()}` : "—"}</span></div>
                <div><span className="text-gray-500">Our price:</span> <span className="font-medium">{a.ourFinalPrice != null ? `$${a.ourFinalPrice.toLocaleString()}` : "—"}</span></div>
                <div><span className="text-gray-500">Recorded by:</span> <span className="font-medium">{a.recordedBy?.name || "—"}</span></div>
              </div>
              {a.lessonsLearned && (
                <div className="mt-2 text-xs text-gray-600 bg-amber-50 rounded p-2">
                  <span className="font-semibold">Lessons: </span>{a.lessonsLearned}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">{editing ? "Edit Analysis" : "Record Lost Deal"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lost Deal *</label>
                <select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })} disabled={!!editing} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                  <option value="">Select a lost deal...</option>
                  {lostDeals.map((d) => <option key={d.id} value={d.id}>{d.dealName} — {d.customer?.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Competitor</label>
                  <select value={form.competitorId} onChange={(e) => setForm({ ...form, competitorId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Loss Reason Category</label>
                  <select value={form.lossReasonId} onChange={(e) => setForm({ ...form, lossReasonId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {lossReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lost Reason (detail) *</label>
                <textarea value={form.lostReason} onChange={(e) => setForm({ ...form, lostReason: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Competitor Won Price</label>
                  <input type="number" value={form.competitorWonPrice} onChange={(e) => setForm({ ...form, competitorWonPrice: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Our Final Price</label>
                  <input type="number" value={form.ourFinalPrice} onChange={(e) => setForm({ ...form, ourFinalPrice: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lessons Learned</label>
                <textarea value={form.lessonsLearned} onChange={(e) => setForm({ ...form, lessonsLearned: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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
