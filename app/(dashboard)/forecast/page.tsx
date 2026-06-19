"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = { plus: "M12 4v16m8-8H4", edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6", x: "M6 18L18 6M6 6l12 12", chart: "M9 19v-6m3 6V6m3 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const forecastTypes = ["Revenue", "Opportunity", "Sales"];

export default function ForecastListPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), forecastType: "", assignedUserId: "" });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", filters.year);
      if (filters.forecastType) params.set("forecastType", filters.forecastType);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      const res = await fetch(`/api/forecast?${params}`);
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEntries(); }, [filters.year, filters.forecastType, filters.assignedUserId]);

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true, title: "Delete Forecast Entry", message: "Are you sure?",
      action: async () => {
        try {
          const res = await fetch(`/api/forecast/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Deleted"); loadEntries(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const achievementColor = (percent: number) => {
    if (percent >= 80) return "bg-green-100 text-green-700";
    if (percent >= 50) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Forecasting</h1><p className="text-sm text-slate-500 mt-0.5">Manage forecast targets and track achievement</p></div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/forecast/target-vs-achievement")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.chart} size={16} /> Target vs Achievement</button>
          <button onClick={() => router.push("/forecast/new")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.plus} size={16} /> Add Forecast Entry</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex gap-3 flex-wrap items-end">
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Year</label><input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Forecast Type</label><select value={filters.forecastType} onChange={(e) => setFilters({ ...filters, forecastType: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20"><option value="">All</option>{forecastTypes.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Assigned User</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20"><option value="">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Month</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Year</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Type</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Target ({preferredCurrency})</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achieved ({preferredCurrency})</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achievement %</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Assigned To</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : entries.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No forecast entries found</td></tr>
            : entries.map((e: any) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm text-slate-700">{months[e.month - 1]}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{e.year}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{e.forecastType}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(e.targetAmount)}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(e.achievedAmount)}</td>
                <td className="px-4 py-3 text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${achievementColor(e.targetAmount > 0 ? (e.achievedAmount / e.targetAmount) * 100 : 0)}`}>{e.targetAmount > 0 ? Math.round((e.achievedAmount / e.targetAmount) * 100) : 0}%</span></td>
                <td className="px-4 py-3 text-sm text-slate-700">{e.assignedUser?.name || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => router.push(`/forecast/${e.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><Ico d={icons.edit} size={15} /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Ico d={icons.x} size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })} isDestructive={true} />
    </PageContainer>
  );
}