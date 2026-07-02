"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, ChartCard, CompetitorPageHeader, FilterSelect,
  EmptyState, LoadingState, getChartColor,
} from "@/components/competitors/CompetitorAnalytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Pencil, Trash2, TrendingDown, DollarSign, Percent, AlertCircle } from "lucide-react";

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

  // ── Computed summary metrics from real records ────────────────────────────
  const summary = useMemo(() => {
    const totalLost = analyses.length;
    const totalValueLost = analyses.reduce((sum, a) => sum + (a.deal?.dealValue || 0), 0);

    // Avg loss margin %
    const marginAnalyses = analyses.filter((a) => a.competitorWonPrice != null && a.ourFinalPrice != null && a.ourFinalPrice > 0);
    const avgLossMargin = marginAnalyses.length > 0
      ? Math.round((marginAnalyses.reduce((sum, a) => {
          const margin = ((a.ourFinalPrice - a.competitorWonPrice) / a.ourFinalPrice) * 100;
          return sum + margin;
        }, 0) / marginAnalyses.length) * 10) / 10
      : 0;

    // Top loss reason
    const reasonCounts = new Map<string, number>();
    for (const a of analyses) {
      const key = a.lossReason?.name || a.lostReason || "Uncategorized";
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    let topLossReason = "—";
    let maxCount = 0;
    for (const [reason, count] of reasonCounts) {
      if (count > maxCount) { maxCount = count; topLossReason = reason; }
    }

    return { totalLost, totalValueLost, avgLossMargin, topLossReason };
  }, [analyses]);

  // ── Chart 1: loss reason breakdown ────────────────────────────────────────
  const lossReasonChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of analyses) {
      const name = a.lossReason?.name || a.lostReason || "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, color: getChartColor(name) }))
      .sort((a, b) => b.count - a.count);
  }, [analyses]);

  // ── Chart 2: value lost per competitor ────────────────────────────────────
  const valueByCompetitor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of analyses) {
      const name = a.competitor?.name || "No competitor";
      map.set(name, (map.get(name) ?? 0) + (a.deal?.dealValue || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: getChartColor(name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [analyses]);

  const canManage = ["Admin", "SalesManager", "SalesRep"].includes(user?.role ?? "");

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
      lostReason: a.lostReason || "",
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

  // Price comparison badge computation
  const priceBadge = (a: any) => {
    if (a.competitorWonPrice == null || a.ourFinalPrice == null) return null;
    const diff = a.ourFinalPrice - a.competitorWonPrice;
    const pct = a.ourFinalPrice > 0 ? Math.round((Math.abs(diff) / a.ourFinalPrice) * 1000) / 10 : 0;
    const isOverpriced = diff > 0;
    return {
      text: `Lost by ${pct}% ($${Math.abs(diff).toLocaleString()})`,
      isOverpriced,
    };
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <CompetitorPageHeader title="Lost Deals Analysis" subtitle="Record and review why deals were lost">
        {canManage && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Record Lost Deal
          </button>
        )}
      </CompetitorPageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={filterCompetitor}
          onChange={setFilterCompetitor}
          options={competitors.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="All competitors"
        />
        <FilterSelect
          value={filterReason}
          onChange={setFilterReason}
          options={lossReasons.map((r) => ({ value: r.id, label: r.name }))}
          placeholder="All loss reasons"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : analyses.length === 0 ? (
        <EmptyState message="No lost-deal analyses recorded yet." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Lost Deals" value={summary.totalLost} icon={<TrendingDown size={20} />} />
            <KPICard label="Total Value Lost" value={`$${summary.totalValueLost.toLocaleString()}`} icon={<DollarSign size={20} />} iconColor="var(--status-danger-text)" />
            <KPICard label="Avg Loss Margin" value={`${summary.avgLossMargin}%`} icon={<Percent size={20} />} />
            <KPICard label="Top Loss Reason" value={summary.topLossReason} icon={<AlertCircle size={20} />} />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Chart 1: loss reason breakdown */}
            <ChartCard title="Loss Reason Breakdown" subtitle="Count of lost deals per reason">
              {lossReasonChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={lossReasonChart} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                      cursor={{ fill: "var(--surface-2)" }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Lost Deals">
                      {lossReasonChart.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState message="No data for chart." />}
            </ChartCard>

            {/* Chart 2: value lost per competitor */}
            <ChartCard title="Value Lost per Competitor" subtitle="Total deal value lost by competitor">
              {valueByCompetitor.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={valueByCompetitor} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                      cursor={{ fill: "var(--surface-2)" }}
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Value Lost"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Value Lost">
                      {valueByCompetitor.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState message="No data for chart." />}
            </ChartCard>
          </div>

          {/* Deal cards */}
          <div className="space-y-3">
            {analyses.map((a) => {
              const badge = priceBadge(a);
              const maxPrice = Math.max(a.competitorWonPrice ?? 0, a.ourFinalPrice ?? 0);
              return (
                <div key={a.id} className="analytics-chart-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/deals/${a.deal?.id}`} className="text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">
                        {a.deal?.dealName || "Untitled deal"}
                      </Link>
                      <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
                        {a.deal?.customer?.name || "—"}
                        {a.competitor?.name && (
                          <span>
                            {" · "}
                            <Link href={`/competitors/${a.competitor.id}`} className="text-[var(--accent)] hover:underline">
                              Lost to {a.competitor.name}
                            </Link>
                          </span>
                        )}
                        {a.lossReason?.name && ` · ${a.lossReason.name}`}
                      </div>
                    </div>
                    {canManage && (
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => openEdit(a)} className="action-icon-btn" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(a)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>

                  {/* Lost reason detail */}
                  {a.lostReason && (
                    <p className="text-[13px] text-[var(--text-secondary)] mt-2 whitespace-pre-wrap">{a.lostReason}</p>
                  )}

                  {/* Price comparison: single badge + secondary bars */}
                  {a.competitorWonPrice != null && a.ourFinalPrice != null && (
                    <div className="mt-3">
                      {badge && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium mb-2 ${
                          badge.isOverpriced
                            ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                            : "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]"
                        }`}>
                          {badge.text}
                        </span>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--text-muted)] w-20">Their price</span>
                          <div className="flex-1 price-range-track">
                            <div className="bg-[var(--status-warning)] rounded-full h-full" style={{ width: `${maxPrice > 0 ? (a.competitorWonPrice / maxPrice) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[12px] text-[var(--text-secondary)] w-24 text-right">${a.competitorWonPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--text-muted)] w-20">Our price</span>
                          <div className="flex-1 price-range-track">
                            <div className="bg-[var(--accent)] rounded-full h-full" style={{ width: `${maxPrice > 0 ? (a.ourFinalPrice / maxPrice) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[12px] text-[var(--text-secondary)] w-24 text-right">${a.ourFinalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-3 text-[12px] text-[var(--text-muted)]">
                    <span>Recorded by: <span className="font-medium text-[var(--text-secondary)]">{a.recordedBy?.name || "—"}</span></span>
                    {a.createdAt && <span>{new Date(a.createdAt).toLocaleDateString()}</span>}
                  </div>

                  {/* Lessons learned — real per-record field */}
                  {a.lessonsLearned && (
                    <div className="mt-2 text-[12px] text-[var(--text-secondary)] bg-[var(--status-warning-bg)] rounded-lg p-2.5 border border-[var(--status-warning-border)]">
                      <span className="font-medium">Lessons: </span>{a.lessonsLearned}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="font-medium text-[var(--text-primary)]">{editing ? "Edit Analysis" : "Record Lost Deal"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Lost Deal *</label>
                <select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })} disabled={!!editing} className="select-field disabled:opacity-60">
                  <option value="">Select a lost deal...</option>
                  {lostDeals.map((d) => <option key={d.id} value={d.id}>{d.dealName} — {d.customer?.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Competitor</label>
                  <select value={form.competitorId} onChange={(e) => setForm({ ...form, competitorId: e.target.value })} className="select-field">
                    <option value="">—</option>
                    {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Loss Reason Category</label>
                  <select value={form.lossReasonId} onChange={(e) => setForm({ ...form, lossReasonId: e.target.value })} className="select-field">
                    <option value="">—</option>
                    {lossReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Lost Reason (detail) *</label>
                <textarea value={form.lostReason} onChange={(e) => setForm({ ...form, lostReason: e.target.value })} rows={3} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Competitor Won Price</label>
                  <input type="number" value={form.competitorWonPrice} onChange={(e) => setForm({ ...form, competitorWonPrice: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Our Final Price</label>
                  <input type="number" value={form.ourFinalPrice} onChange={(e) => setForm({ ...form, ourFinalPrice: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Lessons Learned</label>
                <textarea value={form.lessonsLearned} onChange={(e) => setForm({ ...form, lessonsLearned: e.target.value })} rows={2} className="input-field" />
              </div>
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
