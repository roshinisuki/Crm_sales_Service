"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const icons = { download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l-4 4m0 0l-4-4m4 4V4" };
const forecastTypes = ["Revenue", "Opportunity", "Sales"];

export default function TargetVsAchievementPage() {
  const toast = useToast();
  const { formatCurrency, convertAmount, preferredCurrency } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), forecastType: "Revenue", assignedUserId: "" });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", filters.year);
      if (filters.forecastType) params.set("forecastType", filters.forecastType);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      const res = await fetch(`/api/forecast/achievement?${params}`);
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [filters.year, filters.forecastType, filters.assignedUserId]);

  // Draw chart on canvas
  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = 300;
    const padding = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => Math.max(d.targetAmount, d.achievedAmount)), 1);
    const barGroupWidth = chartW / data.length;
    const barWidth = barGroupWidth * 0.3;
    const barGap = barGroupWidth * 0.05;

    // Y-axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const val = (maxVal / 5) * i;
      const y = padding.top + chartH - (chartH / 5) * i;
      ctx.fillText(`${formatCurrency(val).replace(/\.00$/, '')}`, padding.left - 8, y + 3);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    // Bars
    data.forEach((d, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2;

      // Target bar (blue)
      const targetH = (d.targetAmount / maxVal) * chartH;
      ctx.fillStyle = "#185FA5";
      ctx.fillRect(x - barWidth - barGap, padding.top + chartH - targetH, barWidth, targetH);

      // Achieved bar (green)
      const achievedH = (d.achievedAmount / maxVal) * chartH;
      ctx.fillStyle = "#1D9E75";
      ctx.fillRect(x + barGap, padding.top + chartH - achievedH, barWidth, achievedH);

      // X-axis label
      ctx.fillStyle = "#64748b";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.monthName, x, padding.top + chartH + 18);
    });

    // Legend
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#185FA5";
    ctx.fillRect(padding.left, 8, 12, 12);
    ctx.fillStyle = "#475569";
    ctx.fillText("Target", padding.left + 16, 18);
    ctx.fillStyle = "#1D9E75";
    ctx.fillRect(padding.left + 70, 8, 12, 12);
    ctx.fillStyle = "#475569";
    ctx.fillText("Achieved", padding.left + 86, 18);
  }, [data]);

  const handleExport = () => {
    const headers = ["Month", `Target (${preferredCurrency})`, `Achieved (${preferredCurrency})`, `Gap (${preferredCurrency})`, "Achievement %"];
    const rows = data.map(d => [d.monthName, d.targetAmount, d.achievedAmount, d.gap, `${d.achievementPercent}%`]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `target-vs-achievement-${filters.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Target vs Achievement</h1><p className="text-sm text-slate-500 mt-0.5">Compare forecast targets with actual achievement</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] cursor-pointer"><Ico d={icons.download} size={16} /> Export CSV</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex gap-3 flex-wrap items-end">
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Year</label><input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Forecast Type</label><select value={filters.forecastType} onChange={(e) => setFilters({ ...filters, forecastType: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20">{forecastTypes.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">User</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20"><option value="">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        {loading ? <p className="text-center text-slate-400 py-8">Loading...</p> : data.length === 0 ? <p className="text-center text-slate-400 py-8">No data available</p> : (
          <canvas ref={canvasRef} style={{ width: "100%", height: 300 }} />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Month</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Target ({preferredCurrency})</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achieved ({preferredCurrency})</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Gap ({preferredCurrency})</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achievement %</th>
          </tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm text-slate-700">{d.monthName}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(d.targetAmount)}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{formatCurrency(d.achievedAmount)}</td>
                <td className={`px-4 py-3 text-sm text-right ${d.gap >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(d.gap)}</td>
                <td className="px-4 py-3 text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${d.achievementPercent >= 80 ? "bg-green-100 text-green-700" : d.achievementPercent >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{d.achievementPercent}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
