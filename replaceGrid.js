const fs = require('fs');
const content = fs.readFileSync('components/dashboards/SalesWidgets.tsx', 'utf-8');

const startIndex = content.indexOf('export function CrossModuleBentoGrid({ crossModule }: { crossModule: any }) {');
const endIndex = content.indexOf('export function OverallCRMHealthScore');

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find bounds");
    process.exit(1);
}

const replacement = `export function CrossModuleBentoGrid({ crossModule }: { crossModule: any }) {
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
        backgroundColor: '#84CC16', // Lime green from user's image
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
          font: { size: 11, weight: '500' },
          color: '#475569'
        }
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 h-full shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[15px] font-bold text-slate-900">System Overview</h3>
      </div>
      <div className="flex-1 w-full min-h-[300px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('components/dashboards/SalesWidgets.tsx', newContent);
console.log('Replaced CrossModuleBentoGrid successfully');
