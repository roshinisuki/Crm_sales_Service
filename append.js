const fs = require('fs');

const masterWidgets = `
// ─── MASTER DASHBOARD WIDGETS ────────────────────────────────────────────────
export function CrossModuleBentoGrid({ crossModule }: { crossModule: any }) {
  if (!crossModule) return null;

  const data = [
    { label: "Active Accounts", value: crossModule.accounts?.total || 0, icon: <FileCheck size={20} />, color: "var(--accent)", bg: "var(--accent-soft)" },
    { label: "Active Contacts", value: crossModule.accounts?.contacts || 0, icon: <Phone size={20} />, color: "var(--accent)", bg: "var(--accent-soft)" },
    { label: "Pending Samples", value: crossModule.samples?.pending || 0, icon: <Package size={20} />, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
    { label: "Total Samples", value: crossModule.samples?.total || 0, icon: <Rocket size={20} />, color: "var(--accent)", bg: "var(--accent-soft)" },
    { label: "Pending RFQs", value: crossModule.rfq?.pending || 0, icon: <FileText size={20} />, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
    { label: "Total RFQs", value: crossModule.rfq?.total || 0, icon: <Calendar size={20} />, color: "var(--accent)", bg: "var(--accent-soft)" },
    { label: "Pending Tasks", value: crossModule.activities?.pending || 0, icon: <Clock size={20} />, color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
    { label: "Total Visits", value: crossModule.visits?.total || 0, icon: <Activity size={20} />, color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
    { label: "Active Products", value: crossModule.catalogue?.activeProducts || 0, icon: <FileText size={20} />, color: "var(--accent)", bg: "var(--accent-soft)" }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5 h-full">
      {data.map((item, idx) => (
        <div key={idx} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] flex flex-col justify-center items-center text-center hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-110" style={{ background: item.bg, color: item.color }}>
            {item.icon}
          </div>
          <h4 className="text-3xl font-black text-[var(--text-primary)] mb-1 tracking-tight">{item.value}</h4>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function OverallCRMHealthScore({ kpis, crossModule }: { kpis: any, crossModule: any }) {
  const conversionScore = Math.min((kpis?.conversionRate || 0) * 1.5, 50);
  const activityScore = Math.min(((crossModule?.samples?.total || 0) + (crossModule?.rfq?.total || 0)) * 2, 50);
  const totalScore = Math.round(conversionScore + activityScore);
  
  let quality = "Good";
  let color = "#10b981";
  
  if (totalScore > 85) { quality = "Excellent"; color = "var(--accent)"; }
  else if (totalScore < 50) { quality = "Needs Attention"; color = "#f59e0b"; }
  else if (totalScore < 30) { quality = "Critical"; color = "#ef4444"; }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] mb-6 flex flex-col h-[180px] justify-between">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">CRM Health Score</h3>
        <span className="w-8 h-8 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
          <Activity size={14} />
        </span>
      </div>
      
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">System Vitality</p>
            <h4 className="text-xl font-black" style={{ color }}>{quality}</h4>
          </div>
          <div className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{totalScore}%</div>
        </div>
        <div className="w-full h-3 bg-[var(--border-subtle)] rounded-full overflow-hidden flex shadow-inner">
          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: \`\${totalScore}%\`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function RecentActivityFeed({ crossModule }: { crossModule: any }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Live Activity Feed</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {/* Placeholder activities based on the metrics */}
        <div className="flex gap-4 relative">
          <div className="w-px h-full bg-[var(--border-subtle)] absolute left-[15px] top-8"></div>
          <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0 z-10 outline outline-4 outline-[var(--surface)]">
            <FileText size={14} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]"><strong>{crossModule?.rfq?.pending || 0} RFQs</strong> are pending review.</p>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-0.5">System generated • Just now</p>
          </div>
        </div>
        
        <div className="flex gap-4 relative">
          <div className="w-px h-full bg-[var(--border-subtle)] absolute left-[15px] top-8"></div>
          <div className="w-8 h-8 rounded-full bg-[rgba(239,68,68,0.12)] text-[#ef4444] flex items-center justify-center shrink-0 z-10 outline outline-4 outline-[var(--surface)]">
            <Clock size={14} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]"><strong>{crossModule?.activities?.pending || 0} tasks</strong> remain incomplete.</p>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-0.5">Task Engine • 2h ago</p>
          </div>
        </div>

        <div className="flex gap-4 relative">
          <div className="w-8 h-8 rounded-full bg-[rgba(16,185,129,0.12)] text-[#10b981] flex items-center justify-center shrink-0 z-10 outline outline-4 outline-[var(--surface)]">
            <Activity size={14} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]"><strong>{crossModule?.visits?.total || 0} visits</strong> logged recently.</p>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-0.5">Visit Module • Today</p>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.appendFileSync('components/dashboards/SalesWidgets.tsx', masterWidgets);
console.log('Appended Master Widgets');
