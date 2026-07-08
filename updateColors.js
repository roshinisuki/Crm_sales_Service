const fs = require('fs');
const content = fs.readFileSync('components/dashboards/SalesWidgets.tsx', 'utf-8');

const start1 = content.indexOf('export function PipelinePieChart');
const end1 = content.indexOf('export function CustomerScoreTrendChart');
const start2 = content.indexOf('export function CrossModuleBentoGrid');
const end2 = content.indexOf('export function OverallCRMHealthScore');

if (start1 === -1 || end1 === -1 || start2 === -1 || end2 === -1) {
    console.error("Could not find bounds");
    process.exit(1);
}

const pipelineReplacement = `export function PipelinePieChart({ funnel }: { funnel: any[] }) {
  const [accentColor, setAccentColor] = useState('#2563EB');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };

      updateColors();
      const observer = new MutationObserver(() => updateColors());
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
      return () => observer.disconnect();
    }
  }, []);

  if (!funnel || funnel.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-full flex flex-col items-center justify-center">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-4">Pipeline Performance</h3>
        <AnalyticsEmptyState>No pipeline data yet.</AnalyticsEmptyState>
      </div>
    );
  }

  const total = funnel.reduce((sum: number, f: any) => sum + (f.count || 0), 0);
  
  // Dynamic palette based on accent color (opacity variations)
  const palette = [
    accentColor, 
    accentColor + 'CC', // 80%
    accentColor + '99', // 60%
    accentColor + '66', // 40%
    accentColor + '33', // 20%
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
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-full flex flex-col justify-between shadow-sm transition-colors duration-300">
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
            <span className="w-3 h-3 rounded-sm transition-colors duration-300" style={{ backgroundColor: stage.color }} />
            <span className="text-[10px] font-bold text-slate-500">{stage.stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Customer Score Trend Line Chart ─────────────────────────────────────────
`;

const gridReplacement = `export function CrossModuleBentoGrid({ crossModule }: { crossModule: any }) {
  const [accentColor, setAccentColor] = useState('#2563EB');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };

      updateColors();
      const observer = new MutationObserver(() => updateColors());
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
      return () => observer.disconnect();
    }
  }, []);

  if (!crossModule) return null;

  const labels = [
    "Active Accounts", 
    "Active Contacts", 
    "Pending Samples", 
    "Total Samples", 
    "Pending RFQs", 
    "Total RFQs", 
    "Pending Tasks", 
    "Total Visits", 
    "Active Products"
  ];

  const dataValues = [
    crossModule.accounts?.total || 0,
    crossModule.accounts?.contacts || 0,
    crossModule.samples?.pending || 0,
    crossModule.samples?.total || 0,
    crossModule.rfq?.pending || 0,
    crossModule.rfq?.total || 0,
    crossModule.activities?.pending || 0,
    crossModule.visits?.total || 0,
    crossModule.catalogue?.activeProducts || 0
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Metrics',
        data: dataValues,
        backgroundColor: accentColor,
        borderRadius: 4,
        barThickness: 16,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => \` \${ctx.raw}\`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148,163,184,0.1)',
        },
        ticks: {
          font: { size: 10 },
          color: '#94a3b8'
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 11, weight: 'bold' as const },
          color: '#475569'
        }
      }
    }
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-full shadow-sm flex flex-col transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">System Overview</h3>
      </div>
      <div className="flex-1 w-full min-h-[300px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

`;

let newContent = content.substring(0, start1) + pipelineReplacement + content.substring(end1);
const newStart2 = newContent.indexOf('export function CrossModuleBentoGrid');
const newEnd2 = newContent.indexOf('export function OverallCRMHealthScore');
newContent = newContent.substring(0, newStart2) + gridReplacement + newContent.substring(newEnd2);

fs.writeFileSync('components/dashboards/SalesWidgets.tsx', newContent);
console.log('Replaced both charts successfully');
