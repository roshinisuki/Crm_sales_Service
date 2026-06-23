"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function NewTargetPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    targetType: "Monthly",
    month: String(new Date().getMonth() + 1).padStart(2, "0"),
    quarter: "Q1",
    year: String(new Date().getFullYear()),
    targetAmount: "",
    assignedUserId: "",
    territoryId: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (d.success) setUsers(d.data || []); });
    fetch("/api/territories?isActive=true").then(r => r.json()).then(d => { if (d.success) setTerritories(d.data || []); });
  }, []);

  const getPeriod = () => {
    if (form.targetType === "Monthly") return `${form.year}-${form.month}`;
    if (form.targetType === "Quarterly") return `${form.year}-${form.quarter}`;
    return form.year;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.targetAmount || parseFloat(form.targetAmount) <= 0) return toast.error("Target amount must be positive");
    setSaving(true);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: form.targetType,
          period: getPeriod(),
          targetAmount: form.targetAmount,
          assignedUserId: form.assignedUserId || null,
          territoryId: form.territoryId || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Target created successfully");
        router.push("/targets");
      } else {
        toast.error(data.message || "Failed to create target");
      }
    } catch {
      toast.error("Failed to create target");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <a href="/targets" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
        <Ico d={icons.back} size={14} /> Back to targets
      </a>
      <h1 className="text-2xl font-bold text-slate-800">New Sales Target</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target Type *</label>
          <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {form.targetType === "Monthly" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month *</label>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
            </div>
          )}
          {form.targetType === "Quarterly" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quarter *</label>
              <select value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Q1">Q1 (Jan–Mar)</option>
                <option value="Q2">Q2 (Apr–Jun)</option>
                <option value="Q3">Q3 (Jul–Sep)</option>
                <option value="Q4">Q4 (Oct–Dec)</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year *</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Period: <span className="font-mono font-medium">{getPeriod()}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target Amount (₹) *</label>
          <input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} placeholder="0" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
          <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— All Users —</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Territory</label>
          <select value={form.territoryId} onChange={(e) => setForm({ ...form, territoryId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— No Territory —</option>
            {territories.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.region})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={() => router.push("/targets")} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
            {saving && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" /></svg>}
            {saving ? "Saving..." : "Create Target"}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
