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
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
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

const tabs = ["overview", "deals", "quotations", "visits", "activities", "documents"] as const;
type Tab = typeof tabs[number];

export default function KeyAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [ka, setKa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ accountManagerId: "", revenuePotential: "", strategicImportance: "High", relationshipStatus: "Active", nextReviewDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/key-accounts/${id}`);
      const data = await res.json();
      if (data.success) {
        setKa(data.data);
        setForm({
          accountManagerId: data.data.accountManagerId,
          revenuePotential: data.data.revenuePotential?.toString() || "",
          strategicImportance: data.data.strategicImportance,
          relationshipStatus: data.data.relationshipStatus || "",
          nextReviewDate: data.data.nextReviewDate ? new Date(data.data.nextReviewDate).toISOString().split("T")[0] : "",
          notes: data.data.notes || "",
        });
      } else toast.error("Key account not found");
    } catch {
      toast.error("Failed to load key account");
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
    setSaving(true);
    try {
      const res = await fetch(`/api/key-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Key Account updated");
        setEditing(false);
        load();
      } else toast.error(data.message || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  if (loading) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Loading...</div></PageContainer>;
  if (!ka) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Not found.</div></PageContainer>;

  const c = ka.customer;

  return (
    <PageContainer className="space-y-4 p-0">
      <Link href="/key-accounts" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
        <Ico d={icons.back} size={14} /> Back to key accounts
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{c.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{c.city || "—"} · {c.customerCode}</p>
        </div>
        {canManage && !editing && tab === "overview" && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">
            <Ico d={icons.edit} size={16} /> Edit
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Customer Info</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between py-1.5"><span className="text-gray-500">Name</span><span className="font-medium text-gray-800">{c.name}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">Code</span><span className="font-medium text-gray-800">{c.customerCode}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">City</span><span className="font-medium text-gray-800">{c.city || "—"}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-800">{c.phone || "—"}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">Email</span><span className="font-medium text-gray-800">{c.email || "—"}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">Assigned User</span><span className="font-medium text-gray-800">{c.assignedUser?.name || "—"}</span></div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Key Account Details</h4>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Manager</label>
                  <select value={form.accountManagerId} onChange={(e) => setForm({ ...form, accountManagerId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Revenue Potential (₹)</label>
                  <input type="number" value={form.revenuePotential} onChange={(e) => setForm({ ...form, revenuePotential: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Strategic Importance</label>
                  <select value={form.strategicImportance} onChange={(e) => setForm({ ...form, strategicImportance: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option>High</option><option>Medium</option><option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Relationship Status</label>
                  <select value={form.relationshipStatus} onChange={(e) => setForm({ ...form, relationshipStatus: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Active</option><option>At Risk</option><option>Growing</option><option>Dormant</option>
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
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Account Manager</span><span className="font-medium text-gray-800">{ka.accountManager?.name || "—"}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Revenue Potential</span><span className="font-medium text-gray-800">{formatCurrency(ka.revenuePotential ?? 0)}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Strategic Importance</span><span className={`px-2 py-0.5 rounded-full text-xs ${importanceColors[ka.strategicImportance] || ""}`}>{ka.strategicImportance}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Relationship Status</span>{ka.relationshipStatus && <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[ka.relationshipStatus] || ""}`}>{ka.relationshipStatus}</span>}</div>
                <div className="flex justify-between py-1.5"><span className="text-gray-500">Next Review</span><span className="font-medium text-gray-800">{ka.nextReviewDate ? new Date(ka.nextReviewDate).toLocaleDateString() : "—"}</span></div>
                <div className="py-1.5"><span className="text-gray-500 block mb-1">Notes</span><p className="text-gray-700 whitespace-pre-wrap">{ka.notes || "—"}</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "deals" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-3 font-semibold">Deal Name</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold text-right">Value</th><th className="px-4 py-3 font-semibold">Close Date</th></tr>
            </thead>
            <tbody className="divide-y">
              {c.deals?.length ? c.deals.map((d: any) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.dealName}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{d.status}</span></td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(d.dealValue)}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(d.expectedCloseDate).toLocaleDateString()}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No deals found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "quotations" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-3 font-semibold">Quotation Code</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold text-right">Amount</th><th className="px-4 py-3 font-semibold">Valid Until</th></tr>
            </thead>
            <tbody className="divide-y">
              {c.quotations?.length ? c.quotations.map((q: any) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{q.quotationCode}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{q.status}</span></td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(q.finalAmount || q.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(q.validUntil).toLocaleDateString()}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No quotations found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "visits" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Purpose</th><th className="px-4 py-3 font-semibold">Outcome</th><th className="px-4 py-3 font-semibold">Host</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {c.customerVisits?.length ? c.customerVisits.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(v.checkInTime).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">{v.purpose}</td>
                  <td className="px-4 py-3 text-gray-600">{v.outcome || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{v.host?.name || "—"}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{v.status}</span></td>
                </tr>
              )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No visits found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "activities" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Channel</th><th className="px-4 py-3 font-semibold">Direction</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Content</th><th className="px-4 py-3 font-semibold">By</th></tr>
            </thead>
            <tbody className="divide-y">
              {c.communicationLogs?.length ? c.communicationLogs.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(a.sentAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">{a.channel}</td>
                  <td className="px-4 py-3 text-gray-600">{a.direction}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{a.status}</span></td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs"><div className="line-clamp-2">{a.content}</div></td>
                  <td className="px-4 py-3 text-gray-600">{a.sentByUser?.name || "—"}</td>
                </tr>
              )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No activities found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "documents" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Download</th></tr>
            </thead>
            <tbody className="divide-y">
              {c.documents?.length ? c.documents.map((d: any) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.documentType}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Download <Ico d={icons.download} size={12} /></a></td>
                </tr>
              )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No documents found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}
