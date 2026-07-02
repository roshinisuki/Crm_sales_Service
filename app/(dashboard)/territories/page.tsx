"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, AnalyticsPageHeader,
  EmptyState, LoadingState, UserAvatar,
} from "@/components/shared/AnalyticsComponents";
import { Plus, Pencil, Trash2, Search, MapPin, Building2, Users, BarChart3 } from "lucide-react";

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

  // Summary metrics
  const summary = useMemo(() => {
    const totalAccounts = territories.reduce((s, t) => s + (t._count?.accounts ?? 0), 0);
    const regions = new Set(territories.map(t => t.region)).size;
    const assigned = territories.filter(t => t.assignedUserId).length;
    return { total: territories.length, totalAccounts, regions, assigned };
  }, [territories]);

  // Regions view
  if (view === "regions") {
    const regionsMap = new Map<string, any[]>();
    territories.forEach(t => {
      const arr = regionsMap.get(t.region) || [];
      arr.push(t);
      regionsMap.set(t.region, arr);
    });

    return (
      <PageContainer className="space-y-5 p-0">
        <AnalyticsPageHeader title="Regions Overview" subtitle="Territories grouped by region">
          <Link href="/territories" className="text-[13px] text-[var(--accent)] hover:underline">← List view</Link>
        </AnalyticsPageHeader>

        {loading ? (
          <LoadingState />
        ) : regionsMap.size === 0 ? (
          <EmptyState message="No territories found." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(regionsMap.entries()).map(([region, items]) => {
              const accountCount = items.reduce((s, t) => s + (t._count?.accounts ?? 0), 0);
              return (
                <div key={region} className="analytics-chart-card">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={18} className="text-[var(--accent)]" />
                    <h3 className="text-[15px] font-medium text-[var(--text-primary)]">{region}</h3>
                  </div>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Territories</span>
                      <span className="font-medium text-[var(--text-primary)]">{items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Accounts</span>
                      <span className="font-medium text-[var(--text-primary)]">{accountCount}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block mb-1">Assigned Users</span>
                      <div className="flex flex-wrap gap-1">
                        {items.map(t => t.assignedUser?.name).filter(Boolean).length ? (
                          items.map(t => t.assignedUser?.name).filter(Boolean).map((u, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">{u}</span>
                          ))
                        ) : <span className="text-[var(--text-muted)]">Unassigned</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
                    {items.map(t => (
                      <Link key={t.id} href={`/territories/${t.id}`} className="block text-[13px] text-[var(--accent)] hover:underline">{t.name}</Link>
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
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Sales Territories" subtitle="Manage sales territories and regional assignments">
        <div className="flex items-center gap-3">
          <Link href="/territories/performance" className="btn-secondary">
            <BarChart3 size={16} /> Performance
          </Link>
          <Link href="/territories/accounts" className="btn-secondary">
            <Building2 size={16} /> Accounts
          </Link>
          <Link href="/territories?view=regions" className="text-[13px] text-[var(--accent)] hover:underline">Regions view →</Link>
        </div>
      </AnalyticsPageHeader>

      {/* Search + add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search territories..."
            className="input-field pl-9"
          />
        </div>
        {canManage && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Add Territory
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : territories.length === 0 ? (
        <EmptyState
          message="No territories found."
          action={canManage ? <button onClick={openNew} className="btn-primary"><Plus size={16} /> Create your first territory</button> : undefined}
        />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Territories" value={summary.total} icon={<MapPin size={20} />} />
            <KPICard label="Regions" value={summary.regions} icon={<MapPin size={20} />} />
            <KPICard label="Total Accounts" value={summary.totalAccounts} icon={<Building2 size={20} />} />
            <KPICard label="Assigned" value={summary.assigned} sublabel={`of ${summary.total}`} icon={<Users size={20} />} />
          </div>

          {/* Table */}
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">Name</th>
                    <th className="crm-th">Region</th>
                    <th className="crm-th">States / Area</th>
                    <th className="crm-th">Assigned User</th>
                    <th className="crm-th text-right">Accounts</th>
                    {canManage && <th className="crm-th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {territories.map((t) => (
                    <tr key={t.id} className="crm-tr">
                      <td className="crm-td">
                        <Link href={`/territories/${t.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{t.name}</Link>
                      </td>
                      <td className="crm-td text-[var(--text-secondary)]">{t.region}</td>
                      <td className="crm-td text-[var(--text-secondary)] max-w-xs"><div className="line-clamp-1">{t.states || "—"}</div></td>
                      <td className="crm-td">
                        <UserAvatar name={t.assignedUser?.name} role={t.assignedUser?.role} size="sm" />
                      </td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{t._count?.accounts ?? 0}</td>
                      {canManage && (
                        <td className="crm-td text-right">
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => openEdit(t)} className="action-icon-btn" title="Edit"><Pencil size={16} /></button>
                            <button onClick={() => handleDelete(t)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="font-medium text-[var(--text-primary)]">{editing ? "Edit Territory" : "New Territory"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Region *</label>
                <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. South, North, West..." className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">States / Area (comma-separated)</label>
                <input value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} placeholder="e.g. Tamil Nadu, Karnataka, Kerala" className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Assigned User</label>
                <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="select-field">
                  <option value="">— Unassigned —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
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
