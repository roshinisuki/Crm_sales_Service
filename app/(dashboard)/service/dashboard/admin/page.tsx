"use client";

import React, { useState, useEffect } from "react";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Users, ShieldAlert, FileText, Activity
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function AdminServiceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/service/analytics/admin");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const healthColumns: ColumnDef<any>[] = [
    { header: "Module", accessorKey: "name", sortable: true },
    { header: "Open Items", accessorKey: "openCount", sortable: true, align: "center" },
    { header: "Avg Resolution Time", accessorKey: "avgResTime", align: "center", cell: (row) => row.avgResTime !== "-" ? `${row.avgResTime} hrs` : "-" },
    { header: "SLA Compliance", accessorKey: "slaCompliance", align: "center", cell: (row) => row.slaCompliance !== "-" && row.slaCompliance !== null ? `${row.slaCompliance}%` : "-" }
  ];

  // Colors for the bar chart matching SUKI CRM palette roughly
  const barColors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">Service Operations Admin Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)]">Cross-module rollup of service health, operations, and escalations.</p>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading Admin Data...</div>
      ) : data ? (
        <>
          {/* KPI summaries */}
          <ServiceKPIGrid>
            <ServiceKPICard 
              label="Total Open Items" 
              value={data.kpis.totalOpen} 
              icon={<FileText size={20} className="text-blue-500" />} 
              color="bg-blue-500/10" 
              onClick={() => {}} active={false} 
            />
            <ServiceKPICard 
              label="Escalations" 
              value={data.kpis.totalEscalations} 
              icon={<ShieldAlert size={20} className="text-red-500" />} 
              color="bg-red-500/10" 
              onClick={() => {}} active={false} 
            />
            <ServiceKPICard 
              label="Active Engineers" 
              value={data.kpis.activeEngineers} 
              icon={<Users size={20} className="text-green-500" />} 
              color="bg-green-500/10" 
              onClick={() => {}} active={false} 
            />
            <ServiceKPICard 
              label="Active AMC Contracts" 
              value={data.kpis.activeAmc} 
              icon={<Activity size={20} className="text-purple-500" />} 
              color="bg-purple-500/10" 
              onClick={() => {}} active={false} 
            />
          </ServiceKPIGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2" aria-label="Open items distribution across different service modules">
                Open Items per Module
              </h3>
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.moduleHealth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      cursor={{ fill: 'rgba(128,128,128,0.1)' }}
                    />
                    <Bar dataKey="openCount" name="Open Items" radius={[4, 4, 0, 0]}>
                      {data.moduleHealth.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Module Health Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                Module Health Overview
              </h3>
              <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] flex-1 mt-2">
                <DataTable 
                  data={data.moduleHealth} 
                  columns={healthColumns}
                  defaultSortKey="name"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4 text-center text-sm text-[var(--text-muted)]">Failed to load admin data</div>
      )}
    </div>
  );
}
