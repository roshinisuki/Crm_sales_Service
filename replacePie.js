const fs = require('fs');
const content = fs.readFileSync('components/dashboards/SalesWidgets.tsx', 'utf-8');

const startIndex = content.indexOf('export function PipelinePieChart({ funnel }: { funnel: any[] }) {');
const endIndex = content.indexOf('// ─── Customer Score Trend Line Chart ─────────────────────────────────────────');

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find bounds");
    process.exit(1);
}

const replacement = `export function PipelinePieChart({ funnel }: { funnel: any[] }) {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-full flex flex-col items-center justify-center">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-4">Pipeline Performance</h3>
        <AnalyticsEmptyState>No pipeline data yet.</AnalyticsEmptyState>
      </div>
    );
  }

  const total = funnel.reduce((sum: number, f: any) => sum + (f.count || 0), 0);
  
  const palette = [
    '#84CC16', // Lime green
    '#0F766E', // Dark green
    '#F97316', // Orange
    '#3B82F6', // Blue (fallback)
    '#EAB308', // Yellow (fallback)
  ];

  const stageItems = funnel.map((f: any, i: number) => ({
    ...f,
    color: palette[i % palette.length],
    pct: total > 0 ? Math.round((f.count / total) * 100) : 0,
  }));

  const chartData = {
    labels: funnel.map((f: any) => f.stage),
    datasets: [{
      data: funnel.map((f: any) => f.count),
      backgroundColor: stageItems.map((s: any) => s.color),
      borderColor: 'transparent',
      borderWidth: 0,
      hoverOffset: 4,
      cutout: '75%',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 10 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return \` \${ctx.label}: \${val} (\${pct}%)\`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-full flex flex-col justify-between shadow-sm">
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 text-center mb-6">Pipeline Performance</h3>

      {/* Chart & Center Label */}
      <div className="relative w-full h-[180px] flex items-center justify-center shrink-0">
        <Doughnut data={chartData} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
          <span className="text-[11px] font-bold text-slate-500 mb-0.5">Total Count</span>
          <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">{total}</span>
        </div>
      </div>

      {/* Footer Text & Button */}
      <div className="mt-8 text-center space-y-4">
        <p className="text-[11px] font-medium text-slate-500 px-4 leading-relaxed">
          Here are some tips on how to<br/>improve your score.
        </p>
        <button className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors">
          Guide Views
        </button>
      </div>

      {/* Horizontal Legend */}
      <div className="flex items-center justify-center gap-3 mt-6">
        {stageItems.slice(0, 3).map((stage: any, idx: number) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: stage.color }} />
            <span className="text-[10px] font-bold text-slate-500">{stage.stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('components/dashboards/SalesWidgets.tsx', newContent);
console.log('Replaced PipelinePieChart successfully');
