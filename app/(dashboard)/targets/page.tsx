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
  chart: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
};

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-24 bg-gray-100 rounded-full h-2.5 relative">
      <div className={`${color} rounded-full h-2.5 transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function TargetsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("type") as "Monthly" | "Quarterly" | "Yearly") || "Monthly";
  const [tab, setTab] = useState<"Monthly" | "Quarterly" | "Yearly">(initialTab);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/targets?targetType=${tab}`);
      const data = await res.json();
      if (data.success) setTargets(data.data);
    } catch {
      toast.error("Failed to load targets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const handleDelete = (t: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete target",
      message: `Delete ${t.targetType} target for ${t.period}?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/targets/${t.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Target deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Targets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage monthly, quarterly, and yearly sales targets</p>
        </div>
        <div className="flex gap-2">
          <Link href="/targets/achievement" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">
            <Ico d={icons.chart} size={16} /> Achievement Tracking
          </Link>
          {canManage && (
            <Link href="/targets/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
              <Ico d={icons.plus} size={16} /> Add Target
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {(["Monthly", "Quarterly", "Yearly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No {tab.toLowerCase()} targets found.</p>
          {canManage && (
            <Link href="/targets/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
              <Ico d={icons.plus} size={16} /> Create your first target
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Assigned User</th>
                <th className="px-4 py-3 font-semibold">Territory</th>
                <th className="px-4 py-3 font-semibold text-right">Target Amount</th>
                <th className="px-4 py-3 font-semibold text-right">Achieved</th>
                <th className="px-4 py-3 font-semibold text-right">Achievement %</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {targets.map((t) => {
                const pct = t.targetAmount > 0 ? Math.round((t.achievedAmount / t.targetAmount) * 100) : 0;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.period}</td>
                    <td className="px-4 py-3 text-gray-600">{t.assignedUser?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{t.territory?.name || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(t.targetAmount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(t.achievedAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${pct >= 80 ? "bg-green-50 text-green-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{pct}%</span>
                    </td>
                    <td className="px-4 py-3"><ProgressBar pct={pct} /></td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <Link href={`/targets/${t.id}`} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></Link>
                          <button onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Ico d={icons.trash} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}
