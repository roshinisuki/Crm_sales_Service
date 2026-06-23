"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  report: "M9 17v-6m3 6V6m3 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
};

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  MISSED: "bg-red-100 text-red-700",
  CHECKED_OUT: "bg-green-100 text-green-700",
};

const statusOptions = ["PLANNED", "CHECKED_IN", "COMPLETED", "MISSED"];

export default function VisitsListPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const statusFilter = searchParams.get("status") || "";

  const loadVisits = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await fetch(`/api/visits?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setVisits(data.data);
    } catch { toast.error("Failed to load visits"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadVisits();
    if (process.env.NODE_ENV === "development") {
      fetch("/api/cron/visits-missed").catch(() => {});
    }
  }, [statusFilter]);

  const handleDelete = (id: string, customerName: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Visit",
      message: `Are you sure you want to delete the visit for "${customerName}"?`,
      action: async () => {
        try {
          const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Visit deleted"); loadVisits(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Customer Visits</h1><p className="text-sm text-slate-500 mt-0.5">Manage customer visit tracking</p></div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/visits/reports")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"><Ico d={icons.report} size={16} /> Reports</button>
          <button onClick={() => router.push("/visits/new")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"><Ico d={icons.plus} size={16} /> New Visit</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => router.push("/visits")} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${!statusFilter ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>All</button>
        {statusOptions.map((s) => (
          <button key={s} onClick={() => router.push(`/visits?status=${s}`)} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${statusFilter === s ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{s.replace("_", " ")}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Purpose</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Priority</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Meeting Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Check-In</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Check-Out</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            : visits.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No visits found</td></tr>
            : visits.map((v: any) => (
              <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{v.customer?.name || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.purpose}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.priority}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.meetingType || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.checkInTime ? new Date(v.checkInTime).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : "—"}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[v.status] || "bg-gray-100 text-gray-600"}`}>{v.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => router.push(`/visits/${v.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer" title="View"><Ico d={icons.eye} size={15} /></button><button onClick={() => handleDelete(v.id, v.customer?.name || "")} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Delete"><Ico d={icons.trash} size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageContainer>
  );
}
