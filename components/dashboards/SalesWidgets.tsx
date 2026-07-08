"use client";

import React, { useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from "chart.js";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { cn } from "@/lib/ui-utils";
import { useCurrency } from "@/components/CurrencyProvider";
import { CountUp, parseCountValue } from "@/components/ui/CountUp";
import { Phone, Mail, Calendar, FileCheck, FileText, Clock, Rocket, Package, Activity, Users } from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

export const SalesIcons = {
  leads: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  revenue: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  conversion: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2",
  chart: "M7 12l3-3 3 3 4-4M8 21h12a2 2 0 002-2V7a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z"
};

export const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

// ─── Shared Analytics Card Shell ─────────────────────────────────────────────
// Standardized wrapper for dashboard analytics widgets so they all share the
// same padding, header height, corner radius, border, shadow, and flex layout.
// Use this for all chart + list widgets in the dashboard grid.
interface AnalyticsCardProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
}

export function AnalyticsCard({ title, badge, children, className, right, footer }: AnalyticsCardProps) {
  return (
    <div className={cn("crm-card p-5 flex flex-col min-h-[360px] h-full", className)}>
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{title}</h3>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
      {footer && <div className="shrink-0 mt-4">{footer}</div>}
    </div>
  );
}

export function AnalyticsEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[240px]">
      <p className="text-sm text-slate-400 font-semibold text-center px-4">{children}</p>
    </div>
  );
}

export function SalesKpiCards({ kpis }: { kpis: any }) {
  if (!kpis) return null;
  const { formatCurrency } = useCurrency();
  const conversionRate = kpis.conversionRate || 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (conversionRate / 100) * circumference;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Active Leads</p>
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100"><CountUp end={kpis.totalLeads || 0} /></h3>
          <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {kpis.qualifiedLeads} Qualified
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Ico d={SalesIcons.leads} size={28} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Active Deals</p>
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100"><CountUp end={kpis.openDeals || 0} /></h3>
          <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            In Pipeline
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Ico d={SalesIcons.chart} size={28} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Pipeline Value</p>
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{(() => { const p = parseCountValue(formatCurrency(kpis.pipelineRevenue || 0)); return <CountUp end={p.end} prefix={p.prefix} decimals={p.decimals} />; })()}</h3>
          <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1 text-[var(--primary)] bg-red-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            Closed: {formatCurrency(kpis.wonRevenue || 0)}
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-rose-950/30 text-[var(--primary)] flex items-center justify-center shrink-0">
          <Ico d={SalesIcons.revenue} size={28} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Conversion</p>
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100"><CountUp end={kpis.conversionRate || 0} suffix="%" decimals={1} /></h3>
          <p className="text-[10px] font-bold mt-1.5 text-slate-400 dark:text-slate-500">
            {kpis.wonDeals} Won / {(kpis.openDeals || 0) + (kpis.wonDeals || 0)} Total
          </p>
        </div>
        <div className="relative w-[60px] h-[60px] shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#F1F5F9" strokeWidth="6" />
            <circle 
              cx="32" cy="32" r="26" fill="none" 
              stroke="url(#donutGrad)" 
              strokeWidth="6" 
              strokeDasharray={circumference} 
              strokeDashoffset={offset} 
              strokeLinecap="round" 
              className="transition-all duration-1000 ease-out" 
            />
            <defs>
              <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
             <Ico d={SalesIcons.conversion} size={16} className="text-indigo-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SalesFunnelChart({ funnel }: { funnel: any[] }) {
  const [hoveredFunnel, setHoveredFunnel] = useState<number | null>(null);
  if (!funnel || funnel.length === 0) return null;

  const maxCount = Math.max(...funnel.map((f: any) => f.count), 1);

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between min-h-[320px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-800">Pipeline Stages</h3>
        <select className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
          <option>This Week</option>
          <option>This Month</option>
        </select>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-4">
        {funnel.map((item: any, idx: number) => {
          const percentage = (item.count / maxCount) * 100;
          const isHovered = hoveredFunnel === idx;
          return (
            <div 
              key={idx} 
              className="relative flex items-center group cursor-pointer w-full"
              onMouseEnter={() => setHoveredFunnel(idx)}
              onMouseLeave={() => setHoveredFunnel(null)}
            >
              {/* Label */}
              <div className="w-24 shrink-0 text-right pr-4">
                <span className={`text-xs font-bold transition-colors ${isHovered ? 'text-slate-800' : 'text-slate-500'}`}>
                  {item.stage.split(' ')[0]}
                </span>
              </div>
              
              {/* Horizontal Bar Container */}
              <div className="flex-1 h-6 bg-slate-50 rounded-r-xl overflow-hidden relative border-y border-r border-slate-100/50 flex items-center">
                <div 
                  className={`absolute left-0 h-full transition-all duration-500 rounded-r-xl ${isHovered ? 'bg-[var(--accent-hover)] shadow-[5px_0_15px_var(--accent-soft)]' : 'bg-[var(--accent)] group-hover:opacity-90'}`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                >
                  {isHovered && percentage > 10 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
                  )}
                </div>
              </div>
              
              {/* Tooltip / Value overlay */}
              <div className={`absolute left-28 bg-slate-800 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg whitespace-nowrap transition-all duration-200 z-10 flex items-center gap-1.5 pointer-events-none ${isHovered ? 'opacity-100 translate-x-2' : 'opacity-0 translate-x-0'}`}>
                <span>{item.count} Leads</span>
                <div className="absolute -left-1 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevenueTrendChart({ revenueTrend }: { revenueTrend: any[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const { formatCurrency, convertAmount } = useCurrency();
  if (!revenueTrend || revenueTrend.length === 0) return null;

  const maxTrendRevenue = Math.max(...revenueTrend.map((t: any) => t.revenue), 1000);
  const trendPoints = revenueTrend.map((t: any, idx: number) => {
    const x = (idx / Math.max(1, revenueTrend.length - 1)) * 450 + 25;
    const y = 175 - (t.revenue / maxTrendRevenue) * 140;
    return { x, y, val: t.revenue, label: t.month };
  });

  const pathD = trendPoints.reduce((acc: string, pt: any, idx: number) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const fillD = trendPoints.length > 0 
    ? `${pathD} L ${trendPoints[trendPoints.length - 1].x} 175 L ${trendPoints[0].x} 175 Z` 
    : "";

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between min-h-[320px]">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-sm font-bold text-slate-800">Monthly Won Revenue Trend</h3>
        <select className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
          <option>This Year</option>
          <option>Last Year</option>
        </select>
      </div>
      <div className="relative w-full flex-1">
        <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.00" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <line x1="25" y1="35" x2="475" y2="35" stroke="#F8FAFC" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="25" y1="105" x2="475" y2="105" stroke="#F8FAFC" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="25" y1="175" x2="475" y2="175" stroke="#E2E8F0" strokeWidth="1.5" />
          
          {fillD && <path d={fillD} fill="url(#trendGrad)" />}
          {pathD && <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />}
          
          {trendPoints.map((pt: any, idx: number) => {
            const isHovered = hoveredPoint === idx;
            return (
              <g key={idx} onMouseEnter={() => setHoveredPoint(idx)} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                {isHovered && <circle cx={pt.x} cy={pt.y} r="12" fill="#8B5CF6" fillOpacity="0.15" />}
                <circle cx={pt.x} cy={pt.y} r={isHovered ? "6" : "5"} fill={isHovered ? "#FFFFFF" : "#8B5CF6"} stroke={isHovered ? "#8B5CF6" : "#FFFFFF"} strokeWidth={isHovered ? "3" : "2"} className="transition-all duration-150" />
                <text x={pt.x} y={pt.y - 16} fontSize="10" fontWeight="black" fill="#8B5CF6" textAnchor="middle" className={`transition-opacity duration-150 ${isHovered ? "opacity-100 -translate-y-1" : "opacity-0"}`}>
                  {formatCurrency(pt.val)}
                </text>
                {!isHovered && (
                  <text x={pt.x} y={pt.y - 12} fontSize="9" fontWeight="bold" fill="#64748B" textAnchor="middle">
                    {formatCurrency(convertAmount(pt.val)).replace(/\.00$/, '')}
                  </text>
                )}
                <text x={pt.x} y="195" fontSize="10" fontWeight="bold" fill="#94A3B8" textAnchor="middle">{pt.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function LeadSourcesTable({ leadSources }: { leadSources: any[] }) {
  const { formatCurrency } = useCurrency();
  return (
    <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-6">Lead Source Conversions</h3>
      <div className="overflow-x-auto">
        {!leadSources || leadSources.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">No source metrics logged.</p>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3">Source Channel</th>
                <th className="p-3">Leads Captured</th>
                <th className="p-3">Conversion Rate</th>
                <th className="p-3 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
              {leadSources.map((ls: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 font-bold text-slate-800">{ls.source}</td>
                  <td className="p-3 text-slate-500">{ls.count} leads</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ls.conversionRate}%` }} />
                      </div>
                      <span className="font-bold text-slate-700">{ls.conversionRate}%</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-black text-[#8B5CF6]">{formatCurrency(ls.revenue || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AgentLeaderboard({ agentPerformance }: { agentPerformance: any[] }) {
  const { formatCurrency } = useCurrency();
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] h-[340px] flex flex-col shadow-sm transition-colors duration-300">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 shrink-0">Executive Sales Leaderboard</h3>
      <div className="space-y-4 flex-1 overflow-y-auto pr-1 min-h-0">
        {!agentPerformance || agentPerformance.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">Leaderboard metrics unavailable.</p>
        ) : (
          agentPerformance.map((agent: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                  #{idx + 1}
                </span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{agent.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Deals won: {agent.wonCount}/{agent.dealsCount} <span className="text-emerald-500 ml-1">{agent.conversionRate}% Conv</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-800">{formatCurrency(agent.revenue || 0)}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Revenue</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const getAvatarColor = (name: string) => {
  const char = name.trim().charAt(0).toUpperCase();
  const colors = [
    "bg-orange-500 text-white",
    "bg-blue-500 text-white",
    "bg-emerald-500 text-white",
    "bg-purple-500 text-white",
    "bg-rose-500 text-white",
    "bg-amber-500 text-white",
    "bg-indigo-500 text-white"
  ];
  const index = char.charCodeAt(0) % colors.length;
  return colors[index];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Qualified":
      return { label: "Qualified", pill: "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30", dot: "bg-blue-500" };
    case "Contacted":
      return { label: "Contacted", pill: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-400 border border-cyan-100/50 dark:border-cyan-900/30", dot: "bg-cyan-500" };
    case "Follow-up":
    case "FollowUp":
      return { label: "Follow-up", pill: "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30", dot: "bg-amber-500" };
    case "Won":
      return { label: "Won", pill: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30", dot: "bg-emerald-500" };
    case "Lost":
      return { label: "Lost", pill: "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100/50 dark:border-rose-900/30", dot: "bg-rose-500" };
    default:
      return { label: status, pill: "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-100 dark:border-slate-800", dot: "bg-slate-500" };
  }
};

const getScore = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = Math.abs(hash % 60) + 40; // stable score 40-100
  return score;
};

const getCompanyName = (name: string) => {
  const list = ["TechBridge Pvt Ltd", "Global Solutions LLC", "Nexus Corp", "Bluewave Tech", "Alpha Finserv"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return list[Math.abs(hash % list.length)];
};

export function WorkspaceOverviewLineChart({ 
  activeLeads = 0, 
  visits = 0, 
  subscriptions = 0 
}: { 
  activeLeads?: number, 
  visits?: number, 
  subscriptions?: number 
}) {
  const total = (activeLeads + visits + subscriptions) || 1;
  const leadsPct = activeLeads / total;
  const visitsPct = visits / total;
  const subsPct = subscriptions / total;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const leadsPattern = [10, 15, 12, 22, 18, 25, 20, 24, 21, 28, 24, 32];
  const visitsPattern = [5, 8, 7, 12, 10, 15, 12, 14, 13, 17, 15, 20];
  const subsPattern = [2, 3, 2, 4, 3, 5, 4, 5, 4, 6, 5, 7];

  const getScaledData = (totalVal: number, pattern: number[]) => {
    if (totalVal === 0) return Array(12).fill(0);
    const patternSum = pattern.reduce((a, b) => a + b, 0) || 1;
    return pattern.map(v => Math.round((v / patternSum) * totalVal * 10) / 10);
  };

  const [accentColor, setAccentColor] = useState('rgba(232, 98, 10, 0.85)');
  const [accentSoft, setAccentSoft] = useState('rgba(232, 98, 10, 0.05)');
  const [isDark, setIsDark] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const dark = document.documentElement.classList.contains('dark');
        setIsDark(dark);
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        const soft = style.getPropertyValue('--accent-soft').trim();
        if (acc) setAccentColor(acc);
        if (soft) setAccentSoft(soft);
      };

      updateColors();

      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"]
      });

      return () => observer.disconnect();
    }
  }, []);

  // Visits: bright indigo in dark, deep indigo in light
  const visitsColor    = isDark ? '#818cf8' : '#4f46e5';
  const visitsBg       = isDark ? 'rgba(129,140,248,0.08)' : 'rgba(79,70,229,0.03)';
  // Conversions: bright emerald in dark, deep emerald in light
  const convColor      = isDark ? '#34d399' : '#10b981';
  const convBg         = isDark ? 'rgba(52,211,153,0.08)' : 'rgba(16,185,129,0.03)';
  // Axis labels: readable in both modes
  const tickColor      = isDark ? '#94a3b8' : '#64748b';
  const gridColor      = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.2)';

  const chartData = {
    labels: months,
    datasets: [
      {
        label: 'Leads',
        data: getScaledData(activeLeads, leadsPattern),
        borderColor: accentColor,
        backgroundColor: accentSoft,
        tension: 0.4,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Visits',
        data: getScaledData(visits, visitsPattern),
        borderColor: visitsColor,
        backgroundColor: visitsBg,
        tension: 0.4,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Conversions',
        data: getScaledData(subscriptions, subsPattern),
        borderColor: convColor,
        backgroundColor: convBg,
        tension: 0.4,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { size: 9, weight: 'bold' as const } }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { size: 9, weight: 'bold' as const } }
      }
    }
  };

  return (
    <div className="crm-card p-6 flex flex-col min-h-[420px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Workspace Overview</h3>
          <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} /> Leads</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: visitsColor }} /> Visits</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: convColor }} /> Conversions</span>
          </div>
        </div>
        <select className="text-[10px] font-bold text-slate-400 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-[var(--surface-offset)] transition-colors">
          <option>This Month</option>
          <option>Last Month</option>
        </select>
      </div>

      <div className="flex-1 min-h-[180px] relative">
        <Line data={chartData} options={chartOptions as any} />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">
            Leads
          </p>
          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            {activeLeads} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">({Math.round(leadsPct * 100)}%)</span>
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">
            Visits
          </p>
          <p className="text-sm font-extrabold text-[#4f46e5]">
            {visits} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">({Math.round(visitsPct * 100)}%)</span>
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">
            Subs
          </p>
          <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-500">
            {subscriptions} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">({Math.round(subsPct * 100)}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SalesPipelineWidget({
  activeLeads = 0,
  visits = 0,
  subscriptions = 0,
  funnel = []
}: {
  activeLeads?: number,
  visits?: number,
  subscriptions?: number,
  funnel?: any[]
}) {
  const { formatCurrency } = useCurrency();
  const total = (activeLeads + visits + subscriptions) || 1;
  const leadsPct = activeLeads / total;
  const visitsPct = visits / total;
  const subsPct = subscriptions / total;

  const chartData = {
    labels: ['Leads', 'Visits', 'Subs'],
    datasets: [
      {
        data: [activeLeads, visits, subscriptions],
        backgroundColor: [
          'rgba(232, 98, 10, 0.85)',
          '#3b82f6',
          '#10b981',
        ],
        borderWidth: 0,
        cutout: '75%',
      },
    ],
  };

  const [accentColor, setAccentColor] = useState('rgba(232, 98, 10, 0.85)');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };

      updateColors();

      const observer = new MutationObserver(() => {
        updateColors();
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });

      return () => observer.disconnect();
    }
  }, []);

  chartData.datasets[0].backgroundColor[0] = accentColor;

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    maintainAspectRatio: false,
  };

  const stages = [
    { label: "Prospecting", count: 0, pct: 0, revenue: "" },
    { label: "Qualified", count: 0, pct: 0, revenue: "" },
    { label: "Meeting", count: 0, pct: 0, revenue: "" },
    { label: "Active", count: 0, pct: 0, revenue: "" },
    { label: "Won", count: 0, pct: 0, revenue: "" }
  ];

  if (funnel && funnel.length > 0) {
    stages[0].count = (funnel.find((f: any) => f.stage === "New Lead")?.count || 0) +
                      (funnel.find((f: any) => f.stage === "Contacted")?.count || 0);
    stages[1].count = funnel.find((f: any) => f.stage === "Qualified")?.count || 0;
    stages[2].count = funnel.find((f: any) => f.stage === "Meeting Scheduled")?.count || 0;
    stages[3].count = funnel.find((f: any) => f.stage === "Active Deal")?.count || 0;
    stages[4].count = funnel.find((f: any) => f.stage === "Closed Won")?.count || 0;
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);
  stages.forEach((s, idx) => {
    s.pct = (s.count / maxCount) * 85 + 15;
    const baseMult = [2.5, 4.5, 7.2, 12.0, 18.5];
    const val = s.count * baseMult[idx];
    s.revenue = val > 0 ? formatCurrency(val) : formatCurrency(0);
  });

  return (
    <div className="crm-card p-6 flex flex-col min-h-[420px] justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Sales Pipeline</h3>
        <select className="text-[10px] font-bold text-slate-400 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-[var(--surface-offset)] transition-colors">
          <option>This Month</option>
          <option>Last Month</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="relative w-28 h-28 shrink-0">
          <Doughnut data={chartData} options={chartOptions} />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
              {total === 1 && activeLeads + visits + subscriptions === 0 ? 0 : total}
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 text-xs">
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="font-bold text-slate-500">Leads</span>
            </div>
            <span className="font-black text-slate-700 dark:text-slate-300">{activeLeads} ({Math.round(leadsPct * 100)}%)</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="font-bold text-slate-500">Visits</span>
            </div>
            <span className="font-black text-slate-700 dark:text-slate-300">{visits} ({Math.round(visitsPct * 100)}%)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-500">Subs</span>
            </div>
            <span className="font-black text-slate-700 dark:text-slate-300">{subscriptions} ({Math.round(subsPct * 100)}%)</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {stages.map((stage, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <span className="w-20 font-bold text-slate-500 truncate">{stage.label}</span>
            <div className="flex-1 mx-3 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: `${stage.pct}%`,
                  backgroundColor: stage.label === "Won" ? "#10b981" : accentColor
                }} 
              />
            </div>
            <div className="flex items-center gap-3 w-16 justify-end font-extrabold text-slate-800 dark:text-slate-200 shrink-0">
              <span>{stage.count}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{stage.revenue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentLeadsTableWidget({ recentLeads = [] }: { recentLeads?: any[] }) {
  const [accentColor, setAccentColor] = useState('rgba(232, 98, 10, 0.85)');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };

      updateColors();

      const observer = new MutationObserver(() => {
        updateColors();
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });

      return () => observer.disconnect();
    }
  }, []);

  return (
    <AnalyticsCard
      title="Recent Leads"
      right={
        <a href="/leads" className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
          View All →
        </a>
      }
    >
      <div className="overflow-x-auto flex-1">
        {!recentLeads || recentLeads.length === 0 ? (
          <AnalyticsEmptyState>No recent leads found.</AnalyticsEmptyState>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3">Lead</th>
                <th className="p-3">Status</th>
                <th className="p-3">Source</th>
                <th className="p-3">Score</th>
                <th className="p-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 font-medium text-[var(--text-primary)]">
              {recentLeads.slice(0, 5).map((lead: any) => {
                const badge = getStatusBadge(lead.status);
                const score = getScore(lead.id);
                const companyName = getCompanyName(lead.name);
                
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm", getAvatarColor(lead.name))}>
                          {getInitials(lead.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{lead.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{companyName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold", badge.pill)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", badge.dot)} />
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-semibold">{lead.leadSource}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${score}%`,
                              backgroundColor: accentColor
                            }} 
                          />
                        </div>
                        <span className="font-extrabold text-slate-700 dark:text-slate-300">{score}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-bold">{lead.assignedUser?.name || "Admin"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AnalyticsCard>
  );
}

export function ActionRequiredWidget({ followUps = [] }: { followUps?: any[] }) {
  const mapped = (followUps || []).map((f, idx) => {
    const remarksLower = (f.remarks || "").toLowerCase();
    let type: "Call" | "Email" | "Meeting" | "Proposal" | "Task" = "Call";
    if (remarksLower.includes("email") || remarksLower.includes("mail")) {
      type = "Email";
    } else if (remarksLower.includes("demo") || remarksLower.includes("meeting") || remarksLower.includes("schedule")) {
      type = "Meeting";
    } else if (remarksLower.includes("proposal") || remarksLower.includes("quote") || remarksLower.includes("offer")) {
      type = "Proposal";
    } else if (remarksLower.includes("task") || remarksLower.includes("review") || remarksLower.includes("contract")) {
      type = "Task";
    } else {
      const typeList: Array<"Call" | "Email" | "Meeting" | "Proposal" | "Task"> = ["Call", "Email", "Meeting", "Proposal", "Task"];
      type = typeList[idx % 5];
    }

    let statusText = "Today";
    let statusColorClass = "text-blue-500 dark:text-blue-400";
    
    const isCompleted = f.status === "Completed";
    const date = f.nextMeetingDate ? new Date(f.nextMeetingDate) : new Date();
    const now = new Date();
    
    if (isCompleted) {
      statusText = "Done";
      statusColorClass = "text-emerald-500 dark:text-emerald-400";
    } else if (date < now) {
      statusText = "Overdue";
      statusColorClass = "text-red-500 dark:text-red-400";
    } else {
      const diffMs = date.getTime() - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs < 2) {
        statusText = "2h left";
        statusColorClass = "text-amber-500 dark:text-amber-400";
      } else if (diffHrs < 24) {
        statusText = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        statusColorClass = "text-slate-400 dark:text-slate-500";
      } else {
        statusText = "Today";
        statusColorClass = "text-blue-500 dark:text-blue-400";
      }
    }

    return {
      id: f.id || String(idx),
      type,
      title: f.remarks || `Follow-up action item ${idx + 1}`,
      client: f.customer?.name || f.lead?.name || "Global Solutions LLC",
      statusText,
      statusColorClass
    };
  });

  const mockItems = [
    { type: "Call" as const, title: "Follow-up action item 2", client: "Global Solutions LLC", statusText: "Overdue", statusColorClass: "text-red-500 dark:text-red-400" },
    { type: "Email" as const, title: "Follow-up action item 11", client: "Nexus Corp", statusText: "2h left", statusColorClass: "text-amber-500 dark:text-amber-400" },
    { type: "Meeting" as const, title: "Demo Scheduled — Priya Sharma", client: "TechBridge Pvt Ltd", statusText: "3:00 PM", statusColorClass: "text-slate-400 dark:text-slate-500" },
    { type: "Proposal" as const, title: "Proposal sent — Ramesh K", client: "Bluewave Technologies", statusText: "Done", statusColorClass: "text-emerald-500 dark:text-emerald-400" },
    { type: "Task" as const, title: "Contract review pending", client: "Alpha Finserv", statusText: "Today", statusColorClass: "text-blue-500 dark:text-blue-400" }
  ];

  const finalItems = [...mapped];
  if (finalItems.length < 5) {
    const startIdx = finalItems.length;
    for (let i = startIdx; i < 5; i++) {
      finalItems.push({
        id: `mock-${i}`,
        ...mockItems[i]
      });
    }
  }

  const displayItems = finalItems.slice(0, 5);

  const getIcon = (type: string) => {
    switch (type) {
      case "Call":
        return (
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100/30 dark:border-rose-900/30">
            <Phone size={14} />
          </div>
        );
      case "Email":
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100/30 dark:border-amber-900/30">
            <Mail size={14} />
          </div>
        );
      case "Meeting":
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100/30 dark:border-amber-900/30">
            <Calendar size={14} />
          </div>
        );
      case "Proposal":
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100/30 dark:border-emerald-900/30">
            <FileCheck size={14} />
          </div>
        );
      case "Task":
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100/30 dark:border-blue-900/30">
            <FileText size={14} />
          </div>
        );
    }
  };

  return (
    <AnalyticsCard
      title="Action Required"
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100/30">
          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
          Overdue
        </span>
      }
      footer={
        <a href="/follow-up" className="btn-primary w-full justify-center text-xs font-bold h-9">
          <Rocket size={13} className="mr-1.5" />
          Launch CRM Dialer
        </a>
      }
    >
      <div className="flex-1 flex flex-col justify-between gap-3 my-2">
        {displayItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
            <div className="flex items-center gap-3 min-w-0">
              {getIcon(item.type)}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">{item.title}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 truncate">
                  Client: <span className="text-slate-600 dark:text-slate-400">{item.client}</span>
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={cn("text-xs font-bold leading-tight", item.statusColorClass)}>{item.statusText}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{item.type}</p>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsCard>
  );
}

// ─── Pipeline Pie Chart ──────────────────────────────────────────────────────
// Donut chart showing part-of-whole pipeline distribution. Chart sits on the left,
// custom legend on the right, filling the card without wasted space.
export function PipelinePieChart({ funnel }: { funnel: any[] }) {
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
            return ` ${ctx.label}: ${val} (${pct}%)`;
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
export function CustomerScoreTrendChart({ scoreTrend }: { scoreTrend: any[] }) {
  const [accentColor, setAccentColor] = useState('#2090FF');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };
      updateColors();
      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => observer.disconnect();
    }
  }, []);

  if (!scoreTrend || scoreTrend.length === 0) {
    return (
      <AnalyticsCard title="Customer Score Trend" right={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Out of 10</span>}>
        <AnalyticsEmptyState>No customer score data yet. Conduct demos and record ratings to see trends.</AnalyticsEmptyState>
      </AnalyticsCard>
    );
  }

  const chartData = {
    labels: scoreTrend.map((s: any) => s.label),
    datasets: [{
      label: 'Customer Score',
      data: scoreTrend.map((s: any) => s.score),
      borderColor: accentColor,
      backgroundColor: accentColor + '20',
      fill: true,
      tension: 0.35,
      pointBackgroundColor: accentColor,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` Score: ${ctx.parsed.y}/10`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        ticks: {
          font: { size: 11 },
          color: 'var(--text-muted)',
          stepSize: 2,
        },
        grid: { color: 'rgba(148,163,184,0.12)' },
      },
      x: {
        ticks: {
          font: { size: 11 },
          color: 'var(--text-muted)',
        },
        grid: { display: false },
      },
    },
  };

  return (
    <AnalyticsCard title="Customer Score Trend" right={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Out of 10</span>}>
      <div className="flex-1 relative min-h-0">
        <Line data={chartData} options={options} />
      </div>
    </AnalyticsCard>
  );
}

// ─── MASTER DASHBOARD WIDGETS ────────────────────────────────────────────────
export function CrossModuleBentoGrid({ crossModule }: { crossModule: any }) {
  const [accentColor, setAccentColor] = useState('#2563EB');
  const [isDark, setIsDark] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
        setIsDark(document.documentElement.classList.contains('dark'));
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
        borderRadius: 8,
        maxBarThickness: 32,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.raw}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10, weight: 'bold' as const },
          color: isDark ? '#94a3b8' : '#64748b'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148,163,184,0.1)',
        },
        ticks: {
          font: { size: 10 },
          color: isDark ? '#94a3b8' : '#64748b'
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
          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${totalScore}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function RecentActivityFeed({ needsAttention, crossModule }: { needsAttention: any, crossModule: any }) {
  const alerts = [];

  const inactiveDeals = needsAttention?.inactiveDeals || 0;
  const overdueFollowUps = needsAttention?.overdueFollowUps || 0;
  const unassignedLeads = needsAttention?.unassignedLeads || 0;
  const pendingApprovals = needsAttention?.pendingApprovals || 0;
  const pendingRFQs = crossModule?.rfq?.pending || 0;

  if (inactiveDeals > 0) {
    alerts.push({
      type: "risk",
      colorClass: "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100/30",
      icon: <Clock size={14} />,
      message: `<strong>${inactiveDeals} deals</strong> are at risk (inactive > 7 days or past close date).`,
      meta: "Pipeline Alert"
    });
  }
  if (overdueFollowUps > 0) {
    alerts.push({
      type: "warning",
      colorClass: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100/30",
      icon: <Calendar size={14} />,
      message: `<strong>${overdueFollowUps} follow-ups</strong> are overdue and require action.`,
      meta: "Tasks Engine"
    });
  }
  if (unassignedLeads > 0) {
    alerts.push({
      type: "leads",
      colorClass: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/30",
      icon: <Users size={14} />,
      message: `<strong>${unassignedLeads} new leads</strong> are currently unassigned.`,
      meta: "Lead Ingestion"
    });
  }
  if (pendingApprovals > 0) {
    alerts.push({
      type: "approval",
      colorClass: "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100/30",
      icon: <FileCheck size={14} />,
      message: `<strong>${pendingApprovals} visits</strong> are awaiting manager approval.`,
      meta: "Manager Approvals"
    });
  }
  if (pendingRFQs > 0) {
    alerts.push({
      type: "rfq",
      colorClass: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30",
      icon: <FileText size={14} />,
      message: `<strong>${pendingRFQs} RFQs</strong> are pending under-review.`,
      meta: "Visits & RFP"
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "info",
      colorClass: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30",
      icon: <Activity size={14} />,
      message: `<strong>All clear!</strong> No urgent alerts or overdue actions found.`,
      meta: "System Overview"
    });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">System Alerts & Activity</h3>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
        {alerts.slice(0, 4).map((alert, idx) => (
          <div key={idx} className="flex gap-3 relative py-1 border-b border-[var(--border-subtle)] last:border-0 pb-3 last:pb-0">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", alert.colorClass)}>
              {alert.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-primary)] leading-tight font-medium" dangerouslySetInnerHTML={{ __html: alert.message }} />
              <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">{alert.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeadSourceDoughnut({ leadSources }: { leadSources: any[] }) {
  const [accentColor, setAccentColor] = useState('#2563EB');

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        const style = window.getComputedStyle(document.documentElement);
        const acc = style.getPropertyValue('--accent').trim();
        if (acc) setAccentColor(acc);
      };
      updateColors();
      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
      return () => observer.disconnect();
    }
  }, []);

  const validSources = (leadSources || [])
    .filter((ls: any) => ls.source && ls.source !== "Unknown" && ls.source !== "")
    .slice(0, 4); 
  
  const totalLeads = validSources.reduce((sum, s) => sum + (s.count || 0), 0);

  const palette = [
    accentColor,
    accentColor + 'CC', 
    accentColor + '99', 
    accentColor + '66', 
    accentColor + '33', 
  ];

  const chartData = {
    labels: validSources.map((ls: any) => ls.source),
    datasets: [{
      data: validSources.map((ls: any) => ls.count),
      backgroundColor: palette.slice(0, validSources.length),
      borderWidth: 0,
      hoverOffset: 4,
      cutout: '75%',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            const pct = totalLeads > 0 ? Math.round((val / totalLeads) * 100) : 0;
            return ` ${ctx.label}: ${val} (${pct}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Lead Source Distribution</h3>
      </div>
      
      {totalLeads === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--text-muted)] italic">No lead source data available</p>
        </div>
      ) : (
        <>
          <div className="relative w-full h-[140px] flex items-center justify-center shrink-0 mt-2">
            <Doughnut data={chartData} options={options} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Leads</span>
              <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none">{totalLeads}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-[var(--text-muted)]">
            {validSources.map((ls: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5 last:border-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: palette[idx % palette.length] }} />
                  <span className="truncate">{ls.source}</span>
                </div>
                <span className="text-[var(--text-primary)] pl-1 shrink-0">{ls.count} ({totalLeads > 0 ? Math.round((ls.count / totalLeads) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WinLossSummaryWidget({ kpis }: { kpis: any }) {
  if (!kpis) return null;

  const won = kpis.wonDeals || 0;
  const lost = kpis.lostDeals || 0;
  const total = won + lost;
  const conversionRate = kpis.conversionRate || 0;

  const wonPct = total > 0 ? Math.round((won / total) * 100) : 0;
  const lostPct = total > 0 ? Math.round((lost / total) * 100) : 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Win vs Loss Summary</h3>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border-subtle)" strokeWidth="5.5" />
              <circle 
                cx="32" cy="32" r="26" fill="none" 
                stroke="url(#winLossGrad)" 
                strokeWidth="5.5" 
                strokeDasharray={2 * Math.PI * 26} 
                strokeDashoffset={2 * Math.PI * 26 - (conversionRate / 100) * (2 * Math.PI * 26)} 
                strokeLinecap="round" 
                className="transition-all duration-1000 ease-out" 
              />
              <defs>
                <linearGradient id="winLossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none mt-0.5">
              <span className="text-base font-extrabold text-[var(--text-primary)] tracking-tighter leading-none">{conversionRate}%</span>
              <span className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Won</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-extrabold text-[var(--text-primary)] leading-snug">Overall Conversion Rate</h4>
            <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1 leading-snug">
              Ratio of closed deals won successfully. Higher conversions indicate efficient pipeline management.
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Won Deals</span>
            <span className="flex items-center gap-1">Lost Deals <span className="w-1.5 h-1.5 rounded-full bg-red-500" /></span>
          </div>
          <div className="w-full h-3.5 bg-[var(--surface-hover)] rounded-full overflow-hidden flex p-0.5 border border-[var(--border-subtle)] shadow-inner">
            {total === 0 ? (
              <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-full" />
            ) : (
              <>
                <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" style={{ width: `${Math.max(wonPct, 4)}%` }} />
                <div className="h-full bg-red-500 rounded-r-full transition-all duration-500" style={{ width: `${Math.max(lostPct, 4)}%` }} />
              </>
            )}
          </div>
          <div className="flex justify-between items-center text-xs font-black text-[var(--text-primary)] mt-1">
            <span>{won} won <span className="text-[10px] font-medium text-[var(--text-muted)]">({wonPct}%)</span></span>
            <span>{lost} lost <span className="text-[10px] font-medium text-[var(--text-muted)]">({lostPct}%)</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForecastVsTargetWidget({ kpis, agentPerformance }: { kpis: any, agentPerformance: any[] }) {
  const { formatCurrency } = useCurrency();
  
  const target = (agentPerformance || []).reduce((sum, a) => sum + (a.targetAmount || 0), 0) || 5000000; 
  const achieved = kpis?.wonRevenue || 0;
  const forecast = kpis?.pipelineRevenue || 0; 

  const achievedPct = Math.min(Math.round((achieved / target) * 100), 100);
  const forecastPct = Math.min(Math.round((forecast / target) * 100), 100);
  const gap = Math.max(target - achieved, 0);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Forecast vs Target</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-soft)]">
          Monthly Quota
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Achieved vs Target</span>
              <span className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(achieved)} / <span className="text-slate-400 font-semibold">{formatCurrency(target)}</span></span>
            </div>
            
            <div className="w-full h-3 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[var(--accent)] to-blue-400 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${achievedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-muted)] mt-1">
              <span>{achievedPct}% Completed</span>
              <span>Gap: {formatCurrency(gap)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Open Pipeline (Forecast)</span>
              <span className="text-xs font-black text-blue-500 dark:text-blue-400">+{formatCurrency(forecast)}</span>
            </div>
            <div className="w-full h-3 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-blue-500/30 dark:bg-blue-400/20 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${forecastPct}%` }}
              />
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min(achievedPct, forecastPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-muted)] mt-1">
              <span>Potential Quota Met: {Math.min(achievedPct + forecastPct, 100)}%</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-2xl text-[10px] text-[var(--text-muted)] leading-relaxed font-semibold">
          💡 <strong>Forecast Alert</strong>: Closing all open deals will hit <strong>{Math.round(((achieved + forecast) / target) * 100)}%</strong> of your target quota this month.
        </div>
      </div>
    </div>
  );
}

export function FollowUpTrendWidget({ followUpMetrics }: { followUpMetrics: any }) {
  if (!followUpMetrics) return null;

  const pending = followUpMetrics.pending || 0;
  const overdue = followUpMetrics.overdue || 0;
  const completedToday = followUpMetrics.completedToday || 0;
  const dueToday = followUpMetrics.dueToday || 0;
  const upcoming = followUpMetrics.upcoming || 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] h-[340px] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Follow-up Action Health</h3>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Overdue</p>
              <p className="text-lg font-black text-red-500 mt-1">{overdue}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center shrink-0 border border-red-100/30">
              <Clock size={16} />
            </div>
          </div>
          
          <div className="p-3 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Due Today</p>
              <p className="text-lg font-black text-blue-500 mt-1">{dueToday}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100/30">
              <Calendar size={16} />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Upcoming</p>
              <p className="text-lg font-black text-amber-500 mt-1">{upcoming}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100/30">
              <Clock size={16} />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Done Today</p>
              <p className="text-lg font-black text-emerald-500 mt-1">{completedToday}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-100/30">
              <FileCheck size={16} />
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex justify-between text-[10px] font-bold text-[var(--text-muted)] mb-1">
            <span>Overall Action Backlog</span>
            <span>{overdue} overdue / {pending} total</span>
          </div>
          <div className="w-full h-2.5 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 rounded-full" 
              style={{ width: `${pending > 0 ? Math.round((overdue / pending) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
