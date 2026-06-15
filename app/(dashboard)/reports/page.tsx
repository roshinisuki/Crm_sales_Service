import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { BarChart3, TrendingUp, PieChart, Activity, Download } from "lucide-react";

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      subtitle="Analytics and business intelligence"
      action={
        <button className="btn-secondary text-xs flex items-center gap-2">
          <Download size={14} /> Export Report
        </button>
      }
    >
      <PageContainer className="space-y-4 p-0">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Revenue" value="—" icon={<TrendingUp size={20} />} variant="orange" subtitle="All time" />
        <SummaryCard label="Won Deals" value="—" icon={<BarChart3 size={20} />} variant="dark" subtitle="Closed won" />
        <SummaryCard label="Conversion Rate" value="—%" icon={<PieChart size={20} />} variant="light" subtitle="Lead to deal" />
        <SummaryCard label="Active Leads" value="—" icon={<Activity size={20} />} variant="light" subtitle="Currently in pipeline" />
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: "Revenue by Month",   icon: <BarChart3 size={28} className="text-blue-400" />,  desc: "Monthly revenue trend chart" },
          { title: "Leads by Status",    icon: <PieChart size={28} className="text-purple-400" />,  desc: "Pipeline distribution chart" },
          { title: "Deal Conversion",    icon: <TrendingUp size={28} className="text-green-400" />, desc: "Win/loss trend over time" },
          { title: "Follow-up Activity", icon: <Activity size={28} className="text-orange-400" />,  desc: "Daily activity heatmap" },
        ].map(chart => (
          <div key={chart.title} className="crm-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">{chart.title}</h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">Coming Soon</span>
            </div>
            <div className="flex flex-col items-center justify-center py-14 px-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                {chart.icon}
              </div>
              <p className="text-xs font-semibold text-slate-400">{chart.desc}</p>
            </div>
          </div>
        ))}
      </div>
      </PageContainer>
    </PageShell>
  );
}
