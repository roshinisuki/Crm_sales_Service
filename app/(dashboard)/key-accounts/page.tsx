"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { StatusPill, normalizeRelationshipStatus } from "@/components/shared/StatusPill";
import {
  KPICard, ChartCard, AnalyticsPageHeader, FilterPills,
  EmptyState, LoadingState, getChartColor, MiniBar,
} from "@/components/shared/AnalyticsComponents";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Pencil, Trash2, Search, DollarSign, AlertTriangle, Building2, CalendarClock } from "lucide-react";

type SortField = "customer" | "revenue" | "importance" | "nextReview";
type SortDir = "asc" | "desc";

export default function KeyAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [keyAccounts, setKeyAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importanceFilter, setImportanceFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ customerId: "", accountManagerId: "", revenuePotential: "", strategicImportance: "High", relationshipStatus: "Strong", nextReviewDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (importanceFilter !== "All") params.set("importance", importanceFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/key-accounts?${params}`);
      const data = await res.json();
      if (data.success) setKeyAccounts(data.data);
    } catch {
      toast.error("Failed to load key accounts");
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

  useEffect(() => { load(); loadUsers(); }, [importanceFilter, search]);

  // ── Computed summary metrics (from real records in current filter) ─────────
  const summary = useMemo(() => {
    const total = keyAccounts.length;
    const totalRevenue = keyAccounts.reduce((s, ka) => s + (ka.revenuePotential ?? 0), 0);
    const criticalCount = keyAccounts.filter((ka) => ka.strategicImportance === "Critical").length;

    // Avg next review timeframe
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reviewAccounts = keyAccounts.filter((ka) => ka.nextReviewDate);
    let avgDays = 0;
    if (reviewAccounts.length > 0) {
      const totalDays = reviewAccounts.reduce((s, ka) => {
        const diff = Math.ceil((new Date(ka.nextReviewDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return s + diff;
      }, 0);
      avgDays = Math.round(totalDays / reviewAccounts.length);
    }

    return { total, totalRevenue, criticalCount, avgDays };
  }, [keyAccounts]);

  // ── Chart: revenue potential by strategic importance tier ──────────────────
  const chartData = useMemo(() => {
    const tiers = ["Critical", "High", "Medium"];
    return tiers.map((tier) => {
      const accounts = keyAccounts.filter((ka) => ka.strategicImportance === tier);
      return {
        name: tier,
        revenue: accounts.reduce((s, ka) => s + (ka.revenuePotential ?? 0), 0),
        count: accounts.length,
        color: tier === "Critical" ? "#EF4444" : tier === "High" ? "#F59E0B" : "#2090FF",
      };
    }).filter((d) => d.count > 0);
  }, [keyAccounts]);

  // ── Max revenue for inline mini bar ────────────────────────────────────────
  const maxRevenue = useMemo(() => {
    return Math.max(...keyAccounts.map((ka) => ka.revenuePotential ?? 0), 1);
  }, [keyAccounts]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sortedAccounts = useMemo(() => {
    const arr = [...keyAccounts];
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "customer") { av = a.customer?.name ?? ""; bv = b.customer?.name ?? ""; }
      else if (sortField === "revenue") { av = a.revenuePotential ?? 0; bv = b.revenuePotential ?? 0; }
      else if (sortField === "importance") {
        const order = { Critical: 0, High: 1, Medium: 2 };
        av = order[a.strategicImportance as keyof typeof order] ?? 3;
        bv = order[b.strategicImportance as keyof typeof order] ?? 3;
      } else { av = a.nextReviewDate ? new Date(a.nextReviewDate).getTime() : Infinity; bv = b.nextReviewDate ? new Date(b.nextReviewDate).getTime() : Infinity; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [keyAccounts, sortField, sortDir]);

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1 text-[9px] leading-none">
      <span className={sortField === field && sortDir === "asc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▲</span>
      <span className={sortField === field && sortDir === "desc" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>▼</span>
    </span>
  );

  const openNew = () => {
    setEditing(null);
    setForm({ customerId: "", accountManagerId: "", revenuePotential: "", strategicImportance: "High", relationshipStatus: "Strong", nextReviewDate: "", notes: "" });
    setCustomerSearch("");
    setCustomerResults([]);
    setEditorOpen(true);
  };

  const openEdit = (ka: any) => {
    setEditing(ka);
    setForm({
      customerId: ka.customerId,
      accountManagerId: ka.accountManagerId,
      revenuePotential: ka.revenuePotential?.toString() || "",
      strategicImportance: ka.strategicImportance,
      relationshipStatus: ka.relationshipStatus || "Strong",
      nextReviewDate: ka.nextReviewDate ? new Date(ka.nextReviewDate).toISOString().split("T")[0] : "",
      notes: ka.notes || "",
    });
    setCustomerSearch(ka.customer?.name || "");
    setEditorOpen(true);
  };

  const searchCustomers = async (val: string) => {
    setCustomerSearch(val);
    if (val.length < 2) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.success) {
        const existingIds = new Set(keyAccounts.map(ka => ka.customerId));
        setCustomerResults((data.data?.customers ?? []).filter((c: any) => !existingIds.has(c.id)));
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!editing && !form.customerId) return toast.error("Select a customer");
    if (!form.accountManagerId) return toast.error("Account Manager is required");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/key-accounts/${editing.id}` : "/api/key-accounts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? "Key Account updated" : "Key Account created");
        setEditorOpen(false);
        load();
      } else toast.error(data.message || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ka: any) => {
    setConfirmState({
      isOpen: true,
      title: "Remove key account",
      message: `Remove "${ka.customer?.name}" from key accounts?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/key-accounts/${ka.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Key account removed"); load(); }
          else toast.error(data.message || "Remove failed");
        } catch { toast.error("Remove failed"); }
      },
    });
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Key Accounts Overview" subtitle="Strategic customer accounts with dedicated management">
        <div className="flex items-center gap-3">
          <Link href="/key-accounts/revenue-potential" className="text-[13px] text-[var(--accent)] hover:underline">Revenue view →</Link>
          {canManage && (
            <button onClick={openNew} className="btn-primary">
              <Plus size={16} /> Add Key Account
            </button>
          )}
        </div>
      </AnalyticsPageHeader>

      {/* Search + filter pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name..."
            className="input-field pl-9"
          />
        </div>
        <FilterPills
          options={["All", "High", "Medium", "Critical"]}
          value={importanceFilter}
          onChange={setImportanceFilter}
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : keyAccounts.length === 0 ? (
        <EmptyState message="No key accounts found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Accounts" value={summary.total} sublabel="in current filter" icon={<Building2 size={20} />} />
            <KPICard label="Total Revenue Potential" value={formatCurrency(summary.totalRevenue)} icon={<DollarSign size={20} />} />
            <KPICard label="Critical Accounts" value={summary.criticalCount} icon={<AlertTriangle size={20} />} />
            <KPICard label="Avg Next Review" value={summary.avgDays !== 0 ? `in ${Math.abs(summary.avgDays)} days` : "—"} sublabel={summary.avgDays < 0 ? "overdue" : undefined} icon={<CalendarClock size={20} />} />
          </div>

          {/* Chart: revenue by importance tier */}
          {chartData.length > 0 && (
            <ChartCard title="Revenue Potential by Strategic Importance" subtitle="Total revenue potential grouped by tier">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
                    cursor={{ fill: "var(--surface-2)" }}
                    formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} name="Revenue Potential">
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Table */}
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("customer")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Customer <SortIcon field="customer" />
                      </button>
                    </th>
                    <th className="crm-th">Account Manager</th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("revenue")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Revenue <SortIcon field="revenue" />
                      </button>
                    </th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("importance")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Importance <SortIcon field="importance" />
                      </button>
                    </th>
                    <th className="crm-th">Relationship</th>
                    <th className="crm-th">
                      <button onClick={() => toggleSort("nextReview")} className="inline-flex items-center hover:text-[var(--text-primary)]">
                        Next Review <SortIcon field="nextReview" />
                      </button>
                    </th>
                    {canManage && <th className="crm-th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((ka) => (
                    <tr key={ka.id} className="crm-tr">
                      <td className="crm-td">
                        <Link href={`/key-accounts/${ka.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{ka.customer?.name}</Link>
                        {ka.customer?.city && <div className="text-[11px] text-[var(--text-muted)]">{ka.customer.city}</div>}
                      </td>
                      <td className="crm-td">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-[var(--text-primary)]">{ka.accountManager?.name || "—"}</span>
                          {ka.accountManager?.role && <StatusPill status={ka.accountManager.role} />}
                        </div>
                      </td>
                      <td className="crm-td">
                        <div className="flex items-center gap-2">
                          <MiniBar value={ka.revenuePotential ?? 0} max={maxRevenue} />
                          <span className="text-[12px] text-[var(--text-secondary)] whitespace-nowrap w-24 text-right">{formatCurrency(ka.revenuePotential ?? 0)}</span>
                        </div>
                      </td>
                      <td className="crm-td"><StatusPill status={ka.strategicImportance} /></td>
                      <td className="crm-td"><StatusPill status={normalizeRelationshipStatus(ka.relationshipStatus)} /></td>
                      <td className="crm-td text-[var(--text-secondary)]">
                        {ka.nextReviewDate ? new Date(ka.nextReviewDate).toLocaleDateString() : "—"}
                      </td>
                      {canManage && (
                        <td className="crm-td text-right">
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => openEdit(ka)} className="action-icon-btn" title="Edit"><Pencil size={16} /></button>
                            <button onClick={() => handleDelete(ka)} className="action-icon-btn row-action-btn-danger" title="Remove"><Trash2 size={16} /></button>
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

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="font-medium text-[var(--text-primary)]">{editing ? "Edit Key Account" : "Add Key Account"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              {!editing && (
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Customer *</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                    <input value={customerSearch} onChange={(e) => searchCustomers(e.target.value)} placeholder="Search customer..." className="input-field pl-9" />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-[var(--border)] rounded-lg mt-1">
                      {customerResults.map((c: any) => (
                        <button key={c.id} onClick={() => { setForm({ ...form, customerId: c.id }); setCustomerSearch(c.name); setCustomerResults([]); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--surface-2)]">
                          <span className="font-medium">{c.name}</span> <span className="text-[var(--text-muted)]">({c.customerCode})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Account Manager *</label>
                <select value={form.accountManagerId} onChange={(e) => setForm({ ...form, accountManagerId: e.target.value })} className="select-field">
                  <option value="">— Select —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Revenue Potential</label>
                <input type="number" value={form.revenuePotential} onChange={(e) => setForm({ ...form, revenuePotential: e.target.value })} placeholder="0" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Strategic Importance</label>
                  <select value={form.strategicImportance} onChange={(e) => setForm({ ...form, strategicImportance: e.target.value })} className="select-field">
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Relationship Status</label>
                  <select value={form.relationshipStatus} onChange={(e) => setForm({ ...form, relationshipStatus: e.target.value })} className="select-field">
                    <option value="Strong">Strong</option>
                    <option value="Growing">Growing</option>
                    <option value="Developing">Developing</option>
                    <option value="Stable">Stable</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Next Review Date</label>
                <input type="date" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input-field" />
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
