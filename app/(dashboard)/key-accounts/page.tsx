"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  plus: "M12 4v16m8-8H4",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  search: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z",
};

const importanceColors: Record<string, string> = {
  High: "bg-blue-50 text-blue-700",
  Medium: "bg-gray-100 text-gray-600",
  Critical: "bg-red-50 text-red-700",
};

const statusColors: Record<string, string> = {
  Active: "bg-green-50 text-green-700",
  "At Risk": "bg-red-50 text-red-700",
  Growing: "bg-blue-50 text-blue-700",
  Dormant: "bg-gray-100 text-gray-600",
};

export default function KeyAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const importanceFilter = searchParams.get("importance") || "All";
  const [keyAccounts, setKeyAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ customerId: "", accountManagerId: "", revenuePotential: "", strategicImportance: "High", relationshipStatus: "Active", nextReviewDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (importanceFilter !== "All") params.set("importance", importanceFilter);
      if (view === "revenue") params.set("view", "revenue");
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

  useEffect(() => { load(); loadUsers(); }, [importanceFilter, view]);

  const openNew = () => {
    setEditing(null);
    setForm({ customerId: "", accountManagerId: "", revenuePotential: "", strategicImportance: "High", relationshipStatus: "Active", nextReviewDate: "", notes: "" });
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
      relationshipStatus: ka.relationshipStatus || "",
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
        // Exclude already key accounts
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

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Key Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Strategic customer accounts with dedicated management</p>
        </div>
        <Link href="/key-accounts?view=revenue" className="text-sm text-blue-600 hover:underline">Revenue view →</Link>
      </div>

      {/* Revenue chart */}
      {view === "revenue" && keyAccounts.length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Top 10 Key Accounts — Revenue Potential vs Achieved</h4>
          <div className="space-y-2">
            {keyAccounts.slice(0, 10).map((ka) => {
              const potential = ka.revenuePotential ?? 0;
              const achieved = ka.achievedRevenue ?? 0;
              const maxVal = Math.max(potential, achieved, 1);
              return (
                <div key={ka.id} className="flex items-center gap-3 text-sm">
                  <div className="w-32 truncate text-gray-600">{ka.customer?.name}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 w-16">Potential</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                        <div className="bg-blue-500 rounded-full h-4" style={{ width: `${(potential / maxVal) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-20 text-right">{formatCurrency(potential)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 w-16">Achieved</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                        <div className="bg-green-500 rounded-full h-4" style={{ width: `${(achieved / maxVal) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-20 text-right">{formatCurrency(achieved)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1">
          {["All", "High", "Medium", "Critical"].map(imp => (
            <Link
              key={imp}
              href={imp === "All" ? "/key-accounts" : `/key-accounts?importance=${imp}`}
              className={`px-3 py-1.5 text-sm rounded-lg ${importanceFilter === imp ? "bg-[var(--primary)] text-white" : "border hover:bg-gray-50"}`}
            >
              {imp}
            </Link>
          ))}
        </div>
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] ml-auto">
            <Ico d={icons.plus} size={16} /> Add Key Account
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
      ) : keyAccounts.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No key accounts found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Account Manager</th>
                <th className="px-4 py-3 font-semibold text-right">Revenue Potential</th>
                <th className="px-4 py-3 font-semibold">Strategic Importance</th>
                <th className="px-4 py-3 font-semibold">Relationship Status</th>
                <th className="px-4 py-3 font-semibold">Next Review</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keyAccounts.map((ka) => (
                <tr key={ka.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/key-accounts/${ka.id}`} className="font-medium text-blue-600 hover:underline">{ka.customer?.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ka.accountManager?.name || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(ka.revenuePotential ?? 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${importanceColors[ka.strategicImportance] || "bg-gray-100 text-gray-600"}`}>{ka.strategicImportance}</span>
                  </td>
                  <td className="px-4 py-3">
                    {ka.relationshipStatus && <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[ka.relationshipStatus] || "bg-gray-100 text-gray-600"}`}>{ka.relationshipStatus}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ka.nextReviewDate ? new Date(ka.nextReviewDate).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(ka)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></button>
                          <button onClick={() => handleDelete(ka)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Remove"><Ico d={icons.trash} /></button>
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
              <h3 className="font-semibold">{editing ? "Edit Key Account" : "Add Key Account"}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4 max-h-[70vh] overflow-y-auto">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
                  <div className="relative">
                    <Ico d={icons.search} size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      value={customerSearch}
                      onChange={(e) => searchCustomers(e.target.value)}
                      placeholder="Search customer..."
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-lg mt-1">
                      {customerResults.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setForm({ ...form, customerId: c.id }); setCustomerSearch(c.name); setCustomerResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium">{c.name}</span> <span className="text-gray-400">({c.customerCode})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Manager *</label>
                <select value={form.accountManagerId} onChange={(e) => setForm({ ...form, accountManagerId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Revenue Potential (₹)</label>
                <input type="number" value={form.revenuePotential} onChange={(e) => setForm({ ...form, revenuePotential: e.target.value })} placeholder="0" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Strategic Importance</label>
                <select value={form.strategicImportance} onChange={(e) => setForm({ ...form, strategicImportance: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Relationship Status</label>
                <select value={form.relationshipStatus} onChange={(e) => setForm({ ...form, relationshipStatus: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Active">Active</option>
                  <option value="At Risk">At Risk</option>
                  <option value="Growing">Growing</option>
                  <option value="Dormant">Dormant</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next Review Date</label>
                <input type="date" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
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
