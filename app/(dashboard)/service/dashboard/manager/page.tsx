"use client";

import React, { useState, useEffect } from "react";
import { ServiceQueueCard } from "@/components/shared/ServiceComponents";
import { ServiceKPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { 
  Users, BarChart2, CheckCircle2, ShieldAlert, 
  HelpCircle, Sparkles, AlertTriangle, Hammer, Inbox 
} from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function ManagerServiceDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [engineerWorkloads, setEngineerWorkloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [reqsRes, compRes, defRes, instRes, visRes, engRes] = await Promise.all([
          fetch("/api/service/requests"),
          fetch("/api/service/complaints"),
          fetch("/api/service/defects"),
          fetch("/api/service/installations"),
          fetch("/api/service/visits"),
          fetch("/api/service/reports/engineer-performance"),
        ]);
        if (reqsRes.ok) setRequests(await reqsRes.json());
        if (compRes.ok) setComplaints(await compRes.json());
        if (defRes.ok) setDefects(await defRes.json());
        if (instRes.ok) setInstallations(await instRes.json());
        if (visRes.ok) setVisits(await visRes.json());
        if (engRes.ok) {
          const engData = await engRes.json();
          setEngineerWorkloads(engData.map((e: any) => ({
            id: e.id,
            name: e.name,
            team: e.team,
            openCount: e.assigned - e.resolved,
            status: (e.assigned - e.resolved) >= 3 ? "High Load" : "Available",
          })));
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const allTickets = [...requests, ...complaints, ...defects];
  const openTickets = allTickets.filter(t => t.status?.name !== "Closed" && t.status?.name !== "Resolved").length;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const escalationsThisWeek = complaints.filter(c => {
    const created = new Date(c.createdAt || c.created);
    return created >= weekAgo && (c.status?.name === "Escalated" || c.status?.name === "Escalated to Defect");
  }).length + defects.filter(d => new Date(d.createdAt || d.created) >= weekAgo).length;
  const overdueVisits = visits.filter(v => {
    const statusName = v.status?.name || "Unknown";
    return (statusName === "Scheduled" || statusName === "Assigned") && v.scheduledDate && new Date(v.scheduledDate) < new Date();
  }).length;
  const slaCompliance = allTickets.length > 0
    ? Math.round((allTickets.filter(t => t.status?.name === "Closed" || t.status?.name === "Resolved").length / allTickets.length) * 100)
    : 0;

  const workloadColumns: ColumnDef<any>[] = [
    { header: "Engineer", accessorKey: "name" },
    { header: "Specialized Team", accessorKey: "team" },
    { header: "Open Assignments", accessorKey: "openCount" },
    { 
      header: "Status", 
      cell: (row) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
          row.status === "High Load" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
        )}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)]">Service Operations Manager Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)]">Oversee team workloads, service contracts, and SLA compliance metrics.</p>
      </div>

      {/* KPI summaries */}
      {loading ? (
        <div className="p-4 text-center text-sm text-[var(--text-muted)] animate-pulse">Loading KPIs...</div>
      ) : (
        <ServiceKPIGrid>
          <ServiceKPICard label="Total Open Tickets" value={openTickets} icon={<Inbox size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={() => {}} active={false} />
          <ServiceKPICard label="Team SLA Compliance %" value={slaCompliance} icon={<CheckCircle2 size={20} className="text-green-500" />} color="bg-green-500/10" onClick={() => {}} active={false} />
          <ServiceKPICard label="Escalations This Week" value={escalationsThisWeek} icon={<ShieldAlert size={20} className="text-red-500" />} color="bg-red-500/10" onClick={() => {}} active={false} />
          <ServiceKPICard label="Overdue Visits" value={overdueVisits} icon={<AlertTriangle size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={() => {}} active={false} />
        </ServiceKPIGrid>
      )}

      {/* Operations Queue Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Operational Queue Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ServiceQueueCard 
            title="Service Requests" 
            count={requests.length} 
            icon={<Inbox size={20} className="text-blue-400" />} 
          />
          <ServiceQueueCard 
            title="Pneumatic Complaints" 
            count={complaints.length} 
            icon={<AlertTriangle size={20} className="text-amber-400" />} 
          />
          <ServiceQueueCard 
            title="Pending Installations" 
            count={installations.length} 
            icon={<Hammer size={20} className="text-green-400" />} 
          />
        </div>
      </div>

      {/* Detailed Workload panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Workloads */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Engineer Workload & Allocation
          </h3>
          <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <DataTable data={engineerWorkloads} columns={workloadColumns} />
          </div>
        </div>

        {/* Right Side: Escalations Alerts */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4.5 space-y-3.5 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            Escalation Monitor
          </h3>
          <div className="space-y-3">
            {complaints.filter(c => c.status?.name === "Escalated" || c.status?.name === "Escalated to Defect").slice(0, 5).map(c => (
              <div key={c.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs space-y-1 text-red-500">
                <span className="font-bold uppercase tracking-wide block">Escalation: {c.title}</span>
                <p className="opacity-90 text-[var(--text-secondary)]">Customer: {c.customer?.name || "Unknown"} | Status: {c.status?.name}</p>
              </div>
            ))}
            {defects.filter(d => d.status?.name === "Escalated").slice(0, 3).map(d => (
              <div key={d.id} className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs space-y-1 text-orange-500">
                <span className="font-bold uppercase tracking-wide block">Defect Escalation: {d.title}</span>
                <p className="opacity-90 text-[var(--text-secondary)]">Customer: {d.customer?.name || "Unknown"}</p>
              </div>
            ))}
            {complaints.filter(c => c.status?.name === "Escalated" || c.status?.name === "Escalated to Defect").length === 0 && defects.filter(d => d.status?.name === "Escalated").length === 0 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-500">
                No active escalations. All clear!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
