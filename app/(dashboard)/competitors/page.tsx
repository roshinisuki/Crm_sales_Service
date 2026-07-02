"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, ThreatBadge, CompetitorPageHeader,
  ViewToggle, EmptyState, LoadingState, getChartColor, ColorDot,
} from "@/components/competitors/CompetitorAnalytics";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Pencil, Trash2, Search, ExternalLink, Swords, Trophy, AlertTriangle, Eye } from "lucide-react";

export default function CompetitorsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", website: "", description: "", strengths: "", weaknesses: "", isActive: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      const res = await fetch(`/api/competitors?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setCompetitors(data.data);
    } catch {
      toast.error("Failed to load competitors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [q]);

  // ── Computed summary metrics ──────────────────────────────────────────────
  const summary = useMemo(() => {
    const total = competitors.length;
    const winRates = competitors.map((c) => c.stats?.winRate).filter((w: number | null) => w != null) as number[];
    const avgWinRate = winRates.length > 0 ? Math.round((winRates.reduce((a, b) => a + b, 0) / winRates.length) * 10) / 10 : 0;

    // Most-encountered: most total involvements
    let mostEncountered = "—";
    let maxInvolvements = 0;
    for (const c of competitors) {
      const count = c.stats?.totalInvolvements ?? 0;
      if (count > maxInvolvements) { maxInvolvements = count; mostEncountered = c.name; }
    }

    // Highest-threat competitor
    let highestThreat = "—";
    for (const c of competitors) {
      if (c.stats?.threatLevel === "High") { highestThreat = c.name; break; }
      if (c.stats?.threatLevel === "Medium" && highestThreat === "—") highestThreat = c.name;
    }

    return { total, avgWinRate, mostEncountered, highestThreat };
  }, [competitors]);

  // ── Chart data: deals by competitor ───────────────────────────────────────
  const chartData = useMemo(() => {
    return competitors
      .map((c) => ({
        name: c.name,
        count: c.stats?.totalInvolvements ?? 0,
        color: getChartColor(c.name),
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [competitors]);

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", website: "", description: "", strengths: "", weaknesses: "", isActive: true });
    setEditorOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, website: c.website || "", description: c.description || "", strengths: c.strengths || "", weaknesses: c.weaknesses || "", isActive: c.isActive });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/competitors/${editing.id}` : "/api/competitors", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? "Competitor updated" : "Competitor created");
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

  const handleDelete = (c: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete competitor",
      message: `Delete "${c.name}"? This will also remove its products and linked lost-deal analyses.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/competitors/${c.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Competitor deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <PageContainer className="space-y-5 p-0">
      <CompetitorPageHeader title="Competitors" subtitle="Track competitors, their products and win/loss insights">
        {canManage && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> New Competitor
          </button>
        )}
      </CompetitorPageHeader>

      {/* Search + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search competitors..."
            className="input-field pl-9"
          />
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {loading ? (
        <LoadingState />
      ) : competitors.length === 0 ? (
        <EmptyState message="No competitors found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Competitors" value={summary.total} icon={<Swords size={20} />} />
            <KPICard label="Avg Win Rate" value={`${summary.avgWinRate}%`} sublabel="against all competitors" icon={<Trophy size={20} />} />
            <KPICard label="Most Encountered" value={summary.mostEncountered} sublabel="by involvement count" icon={<Eye size={20} />} />
            <KPICard label="Highest Threat" value={summary.highestThreat} icon={<AlertTriangle size={20} />} iconColor="var(--status-danger-text)" />
          </div>

          {/* Chart row */}
          {chartData.length > 0 && (
            <ChartCard title="Deals by Competitor" subtitle="Count of competitor involvement records per competitor">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                    cursor={{ fill: "var(--surface-2)" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Deals">
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Data row: grid or table */}
          {view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {competitors.map((c) => (
                <Link key={c.id} href={`/competitors/${c.id}`} className="competitor-card block">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] font-medium text-white"
                        style={{ backgroundColor: getChartColor(c.name) }}
                      >
                        {initials(c.name)}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">{c.name}</div>
                        {c.website && (
                          <a href={c.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[12px] text-[var(--accent)] hover:underline inline-flex items-center gap-0.5">
                            {c.website} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                    <ThreatBadge level={c.stats?.threatLevel ?? "Low"} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[18px] font-bold text-[var(--text-primary)]">{c.stats?.winRate != null ? `${c.stats.winRate}%` : "—"}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-[var(--text-primary)]">{c.stats?.activeDeals ?? 0}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Active Deals</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-[var(--text-primary)]">{c._count?.products ?? 0}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Products</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <StatusPill status={c.isActive ? "Active" : "Inactive"} />
                    {c.stats?.lastActivity && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {new Date(c.stats.lastActivity).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="crm-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th className="crm-th">Name</th>
                      <th className="crm-th">Threat</th>
                      <th className="crm-th">Win Rate</th>
                      <th className="crm-th">Active Deals</th>
                      <th className="crm-th">Products</th>
                      <th className="crm-th">Status</th>
                      <th className="crm-th">Last Activity</th>
                      {canManage && <th className="crm-th text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c) => (
                      <tr key={c.id} className="crm-tr">
                        <td className="crm-td">
                          <Link href={`/competitors/${c.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{c.name}</Link>
                        </td>
                        <td className="crm-td"><ThreatBadge level={c.stats?.threatLevel ?? "Low"} /></td>
                        <td className="crm-td">{c.stats?.winRate != null ? `${c.stats.winRate}%` : "—"}</td>
                        <td className="crm-td">{c.stats?.activeDeals ?? 0}</td>
                        <td className="crm-td">{c._count?.products ?? 0}</td>
                        <td className="crm-td">
                          <StatusPill status={c.isActive ? "Active" : "Inactive"} />
                        </td>
                        <td className="crm-td text-[var(--text-secondary)]">
                          {c.stats?.lastActivity ? new Date(c.stats.lastActivity).toLocaleDateString() : "—"}
                        </td>
                        {canManage && (
                          <td className="crm-td text-right">
                            <div className="inline-flex gap-1.5">
                              <button onClick={() => openEdit(c)} className="action-icon-btn" title="Edit"><Pencil size={16} /></button>
                              <button onClick={() => handleDelete(c)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Editor modal — preserved from original */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="font-medium text-[var(--text-primary)]">{editing ? "Edit Competitor" : "New Competitor"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Website</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Strengths</label>
                  <textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} rows={3} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Weaknesses</label>
                  <textarea value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} rows={3} className="input-field" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button onClick={() => setEditorOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
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
