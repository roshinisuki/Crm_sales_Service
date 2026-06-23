"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  plus: "M12 4v16m8-8H4",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  search: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z",
};

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

  if (loading) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Loading...</div></PageContainer>;
  if (!territory) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Not found.</div></PageContainer>;

  return (
    <PageContainer className="space-y-4 p-0">
      <Link href="/territories" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
        <Ico d={icons.back} size={14} /> Back to territories
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{territory.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{territory.region} · {territory._count?.accounts ?? 0} accounts</p>
        </div>
        {canManage && !editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">
            <Ico d={icons.edit} size={16} /> Edit
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b mb-5">
        {(["overview", "accounts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t === "accounts" ? `Territory Accounts (${territory.accounts?.length ?? 0})` : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Territory Details</h4>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Region *</label>
                  <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">States / Area</label>
                  <input value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
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
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Name</span><span className="font-medium text-gray-800">{territory.name}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Region</span><span className="font-medium text-gray-800">{territory.region}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">States / Area</span><span className="font-medium text-gray-800 text-right">{territory.states || "—"}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Assigned User</span><span className="font-medium text-gray-800">{territory.assignedUser?.name || "—"}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded-full text-xs ${territory.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{territory.isActive ? "Active" : "Inactive"}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Sales Targets</h4>
            {territory.salesTargets?.length ? (
              <div className="space-y-2 text-sm">
                {territory.salesTargets.map((st: any) => (
                  <div key={st.id} className="flex justify-between py-1.5 border-b last:border-0">
                    <span className="text-gray-600">{st.targetType} · {st.period}</span>
                    <span className="font-medium text-gray-800">{formatCurrency(st.targetAmount)} <span className="text-gray-400">/ {formatCurrency(st.achievedAmount)}</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No sales targets set.</p>}
          </div>
        </div>
      )}

      {tab === "accounts" && (
        <div>
          <div className="flex justify-end mb-3">
            {canManage && (
              <button onClick={() => setAddAccountOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
                <Ico d={icons.plus} size={16} /> Add Account
              </button>
            )}
          </div>
          {territory.accounts?.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Customer Code</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">City</th>
                    <th className="px-4 py-3 font-semibold">Assigned Exec</th>
                    <th className="px-4 py-3 font-semibold">Revenue (Won)</th>
                    {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {territory.accounts.map((a: any) => {
                    const revenue = a.customer.deals?.reduce((s: number, d: any) => s + d.dealValue, 0) ?? 0;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{a.customer.customerCode}</td>
                        <td className="px-4 py-3 font-medium">{a.customer.name}</td>
                        <td className="px-4 py-3 text-gray-600">{a.customer.city || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{a.customer.assignedUser?.name || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(revenue)}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleRemoveAccount(a.id, a.customer.name)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Remove"><Ico d={icons.trash} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">No accounts assigned to this territory.</div>
          )}
        </div>
      )}

      {addAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">Add Account to Territory</h3>
              <button onClick={() => setAddAccountOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search Customer</label>
                <div className="relative">
                  <Ico d={icons.search} size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={customerSearch}
                    onChange={(e) => searchCustomers(e.target.value)}
                    placeholder="Type customer name or code..."
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {customerResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  {customerResults.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(c.name); setCustomerResults([]); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedCustomer === c.id ? "bg-blue-50" : ""}`}
                    >
                      <span className="font-medium">{c.name}</span> <span className="text-gray-400">({c.customerCode})</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <p className="text-sm text-green-600">✓ Customer selected</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setAddAccountOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddAccount} disabled={addingAccount || !selectedCustomer} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
                {addingAccount ? "Adding..." : "Add to Territory"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}
