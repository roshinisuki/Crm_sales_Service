"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { validateCurrency, validateNumeric } from "@/lib/formValidation";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const icons = { back: "M10 19l-7-7m0 0l7-7m-7 7h18" };
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const forecastTypes = ["Revenue", "Opportunity", "Sales"];

export default function NewForecastPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ month: "1", year: String(new Date().getFullYear()), forecastType: "Revenue", targetAmount: "", assignedUserId: "", notes: "" });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.targetAmount || parseFloat(form.targetAmount) <= 0) { toast.error("Target amount must be positive"); return; }
    const amtErr = validateCurrency(form.targetAmount, "Target Amount");
    if (amtErr) { toast.error(amtErr); return; }
    const yearErr = validateNumeric(form.year, "Year");
    if (yearErr) { toast.error(yearErr); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { toast.success("Forecast entry created"); router.push("/forecast"); }
      else toast.error(data.message || "Failed");
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/forecast")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.back} size={18} /></button>
        <div><h1 className="text-2xl font-bold text-slate-800">New Forecast Entry</h1><p className="text-sm text-slate-500 mt-0.5">Set a forecast target</p></div>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5 max-w-xl">
        <div className="grid grid-cols-2 gap-5">
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Month *</label><select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Year *</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Forecast Type *</label><select value={form.forecastType} onChange={(e) => setForm({ ...form, forecastType: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">{forecastTypes.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Amount (₹) *</label><input type="number" step="0.01" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} required className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
          <div className="col-span-2"><label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label><select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"><option value="">-- None --</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
        </div>
        <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" /></div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-70 cursor-pointer">{saving ? "Creating..." : "Create Entry"}</button>
          <button type="button" onClick={() => router.push("/forecast")} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
        </div>
      </form>
    </PageContainer>
  );
}
