import React from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell 
} from 'recharts';

interface AnalyticsData {
  ticketVolume: { date: string; count: number }[];
  resolutionTime: { '0-2h': number; '2-6h': number; '6-12h': number; '12h+': number };
  slaStatus: { met: number; breached: number };
}

export function ServiceAnalyticsCharts({ data }: { data: AnalyticsData }) {
  if (!data) return null;

  // Format volume data
  const volumeData = data.ticketVolume.map(item => ({
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: item.count
  }));

  // Format resolution time data
  const resTimeData = [
    { name: '0-2h', value: data.resolutionTime['0-2h'], color: '#22c55e' }, // green-500
    { name: '2-6h', value: data.resolutionTime['2-6h'], color: '#3b82f6' }, // blue-500
    { name: '6-12h', value: data.resolutionTime['6-12h'], color: '#f59e0b' }, // amber-500
    { name: '12h+', value: data.resolutionTime['12h+'], color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  // Format SLA data
  const slaData = [
    { name: 'Met', value: data.slaStatus.met, color: '#22c55e' }, // green-500
    { name: 'Breached', value: data.slaStatus.breached, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  // Custom label for accessibility/readability on pie charts
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
    if (percent === 0) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Ticket Volume Line Chart */}
      <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2" aria-label="Ticket volume trend over the last 30 days">
          Ticket Volume Trend
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.2)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                name="New Tickets" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resolution Time Donut */}
      <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2" aria-label="Resolution time breakdown showing tickets closed in different hour brackets">
          Resolution Time Breakdown
        </h3>
        <div className="h-64 w-full relative">
          {resTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resTimeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {resTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">No resolution data available</div>
          )}
        </div>
      </div>

      {/* SLA Tracking Donut */}
      <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2" aria-label="SLA tracking showing the proportion of tickets that met, breached, or are at risk of breaching SLA">
          SLA Tracking
        </h3>
        <div className="h-64 w-full relative">
          {slaData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {slaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">No SLA data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
