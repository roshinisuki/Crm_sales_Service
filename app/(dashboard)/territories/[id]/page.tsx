"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2, Search, X } from "lucide-react";

export default function TerritoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [territory, setTerritory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "accounts">("overview");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Inline edit
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", states: "", assignedUserId: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Add account
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/territories/${id}`);
      const data = await res.json();
      if (data.success) {
        setTerritory(data.data);
        setForm({
          name: data.data.name,
          region: data.data.region,
          states: data.data.states || "",
          assignedUserId: data.data.assignedUserId || "",
          isActive: data.data.isActive,
        });
      } else toast.error("Territory not found");
    } catch {
      toast.error("Failed to load territory");
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

  useEffect(() => { if (id) { load(); loadUsers(); } }, [id]);

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required");
    if (!form.region) return toast.error("Region is required");
    setSaving(true);
    try {
      const res = await fetch(`/api/territories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Territory updated");
        setEditing(false);
        load();
      } else toast.error(data.message || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const searchCustomers = async (val: string) => {
    setCustomerSearch(val);
    if (val.length < 2) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.success) setCustomerResults(data.data?.customers ?? []);
    } catch { /* ignore */ }
  };

  const handleAddAccount = async () => {
    if (!selectedCustomer) return toast.error("Select a customer");
    setAddingAccount(true);
    try {
      const res = await fetch(`/api/territories/${id}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Account added to territory");
        setAddAccountOpen(false);
        setSelectedCustomer("");
        setCustomerSearch("");
        setCustomerResults([]);
        load();
      } else toast.error(data.message || "Add failed");
    } catch {
      toast.error("Add failed");
    } finally {
      setAddingAccount(false);
    }
  };

  const handleRemoveAccount = (accountRecordId: string, customerName: string) => {
    setConfirmState({
      isOpen: true,
      title: "Remove account",
      message: `Remove "${customerName}" from this territory?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/territories/${id}/accounts?accountRecordId=${accountRecordId}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Account removed"); load(); }
          else toast.error(data.message || "Remove failed");
        } catch { toast.error("Remove failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  if (loading) return <PageShell title="Territory Details"><div className="py-12 text-center text-sm text-slate-500 dark:text-[var(--text-secondary)]">Loading...</div></PageShell>;
  if (!territory) return <PageShell title="Territory Details"><div className="py-12 text-center text-sm text-slate-500 dark:text-[var(--text-secondary)]">Not found.</div></PageShell>;

  return (
    <PageShell title={territory.name}>
      <Link href="/territories" className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
        <ArrowLeft size={14} /> Back to territories
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[var(--text-primary)]">{territory.name}</h1>
          <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)] mt-0.5">{territory.region} · {territory._count?.accounts ?? 0} accounts</p>
        </div>
        {canManage && !editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 dark:border-[var(--border)] rounded-lg hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-colors">
            <Pencil size={16} /> Edit
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-[var(--border)] mb-5">
        {(["overview", "accounts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t 
                ? "border-[var(--primary)] text-[var(--primary)]" 
                : "border-transparent text-slate-500 dark:text-[var(--text-secondary)] hover:text-slate-700 dark:hover:text-[var(--text-primary)]"
            }`}
          >
            {t === "accounts" ? `Territory Accounts (${territory.accounts?.length ?? 0})` : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[var(--text-secondary)] mb-3">Territory Details</h4>
            {editing ? (
              <div className="space-y-3">
                <FormField label="Name *">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </FormField>
                <FormField label="Region *">
                  <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </FormField>
                <FormField label="States / Area">
                  <Input value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} />
                </FormField>
                <FormField label="Assigned User">
                  <Select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </Select>
                </FormField>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-[var(--text-primary)]">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" />
                  Active
                </label>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm border border-slate-200 dark:border-[var(--border)] rounded-lg hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1.5"><span className="text-slate-500 dark:text-[var(--text-secondary)]">Name</span><span className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{territory.name}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-slate-500 dark:text-[var(--text-secondary)]">Region</span><span className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{territory.region}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-slate-500 dark:text-[var(--text-secondary)]">States / Area</span><span className="font-medium text-slate-800 dark:text-[var(--text-primary)] text-right">{territory.states || "—"}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-slate-500 dark:text-[var(--text-secondary)]">Assigned User</span><span className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{territory.assignedUser?.name || "—"}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-slate-500 dark:text-[var(--text-secondary)]">Status</span><span className={`px-2 py-0.5 rounded-full text-xs ${territory.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-[var(--surface-2)] dark:text-[var(--text-secondary)]"}`}>{territory.isActive ? "Active" : "Inactive"}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[var(--text-secondary)] mb-3">Sales Targets</h4>
            {territory.salesTargets?.length ? (
              <div className="space-y-2 text-sm">
                {territory.salesTargets.map((st: any) => (
                  <div key={st.id} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[var(--border)] last:border-0">
                    <span className="text-slate-600 dark:text-[var(--text-secondary)]">{st.targetType} · {st.period}</span>
                    <span className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{formatCurrency(st.targetAmount)} <span className="text-slate-400 dark:text-[var(--text-muted)]">/ {formatCurrency(st.achievedAmount)}</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400 dark:text-[var(--text-muted)]">No sales targets set.</p>}
          </div>
        </div>
      )}

      {tab === "accounts" && (
        <div>
          <div className="flex justify-end mb-3">
            {canManage && (
              <button onClick={() => setAddAccountOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity">
                <Plus size={16} /> Add Account
              </button>
            )}
          </div>
          {territory.accounts?.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Assigned Exec</TableHead>
                    <TableHead>Revenue (Won)</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {territory.accounts.map((a: any) => {
                    const revenue = a.customer.deals?.reduce((s: number, d: any) => s + d.dealValue, 0) ?? 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{a.customer.customerCode}</TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{a.customer.name}</TableCell>
                        <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{a.customer.city || "—"}</TableCell>
                        <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{a.customer.assignedUser?.name || "—"}</TableCell>
                        <TableCell className="text-slate-600 dark:text-[var(--text-secondary)]">{formatCurrency(revenue)}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <button onClick={() => handleRemoveAccount(a.id, a.customer.name)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors" title="Remove"><Trash2 size={16} /></button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-[var(--text-secondary)]">No accounts assigned to this territory.</div>
          )}
        </div>
      )}

      <Modal
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        title="Add Account to Territory"
      >
        <div className="space-y-3">
          <FormField label="Search Customer">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={customerSearch}
                onChange={(e) => searchCustomers(e.target.value)}
                placeholder="Type customer name or code..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-[var(--border)] rounded-lg bg-white dark:bg-[var(--surface-2)] text-slate-800 dark:text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all"
              />
            </div>
          </FormField>
          {customerResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-[var(--border)] rounded-lg bg-white dark:bg-[var(--surface)]">
              {customerResults.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(c.name); setCustomerResults([]); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-colors ${
                    selectedCustomer === c.id ? "bg-orange-50 dark:bg-orange-900/20" : ""
                  }`}
                >
                  <span className="font-medium text-slate-800 dark:text-[var(--text-primary)]">{c.name}</span> <span className="text-slate-400 dark:text-[var(--text-muted)]">({c.customerCode})</span>
                </button>
              ))}
            </div>
          )}
          {selectedCustomer && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ Customer selected</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setAddAccountOpen(false)} className="px-3 py-1.5 text-sm border border-slate-200 dark:border-[var(--border)] rounded-lg hover:bg-slate-50 dark:hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
          <button onClick={handleAddAccount} disabled={addingAccount || !selectedCustomer} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {addingAccount ? "Adding..." : "Add to Territory"}
          </button>
        </div>
      </Modal>

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageShell>
  );
}
